import base64
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from db import repo

limiter = Limiter(key_func=get_remote_address)

JWT_SECRET_KEY = os.environ.get("UWABAMI_JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise RuntimeError("環境変数 UWABAMI_JWT_SECRET_KEY を設定してください")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("UWABAMI_JWT_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("UWABAMI_REFRESH_TOKEN_EXPIRE_DAYS", "30"))
SECURE_COOKIE = os.environ.get("UWABAMI_SECURE_COOKIE", "true").lower() == "true"
AUTH_COOKIE_PATH = "/api/auth"

GOOGLE_CLIENT_ID = os.environ.get("UWABAMI_GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("UWABAMI_GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.environ.get("UWABAMI_GOOGLE_REDIRECT_URI")
if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REDIRECT_URI:
    raise RuntimeError(
        "環境変数 UWABAMI_GOOGLE_CLIENT_ID・UWABAMI_GOOGLE_CLIENT_SECRET・UWABAMI_GOOGLE_REDIRECT_URI を設定してください"
    )


def _parse_allowed_accounts(raw: str) -> dict[str, str]:
    if not raw.strip():
        raise RuntimeError("環境変数 UWABAMI_GOOGLE_ALLOWED_ACCOUNTS を設定してください (例: me@gmail.com=admin)")
    accounts: dict[str, str] = {}
    for entry in raw.split(","):
        email, sep, username = entry.strip().partition("=")
        if not sep or not email.strip() or not username.strip():
            raise RuntimeError(f"UWABAMI_GOOGLE_ALLOWED_ACCOUNTS の形式が不正です: {entry!r}")
        accounts[email.strip().lower()] = username.strip()
    return accounts


ALLOWED_ACCOUNTS = _parse_allowed_accounts(os.environ.get("UWABAMI_GOOGLE_ALLOWED_ACCOUNTS", ""))
ALLOWED_USERNAMES = frozenset(ALLOWED_ACCOUNTS.values())

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")
OAUTH_COOKIE = "google_oauth"
OAUTH_COOKIE_PATH = "/api/auth/google"
OAUTH_STATE_EXPIRE_MINUTES = 10

ACCESS_COOKIE_NAME = "auth_token"
REFRESH_COOKIE_NAME = "refresh_token"
_ACCESS_COOKIE_KWARGS = {"httponly": True, "samesite": "lax", "secure": SECURE_COOKIE}
_REFRESH_COOKIE_KWARGS = {"httponly": True, "samesite": "lax", "secure": SECURE_COOKIE, "path": AUTH_COOKIE_PATH}
# Googleからのリダイレクトはクロスサイトのトップレベル遷移なので、Strictだとコールバックに送られない
_OAUTH_COOKIE_KWARGS = {"httponly": True, "samesite": "lax", "secure": SECURE_COOKIE, "path": OAUTH_COOKIE_PATH}


def create_access_token(user_id: int, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "username": username, "type": "access", "exp": expire}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: int, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "username": username, "type": "refresh", "exp": expire}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: int, username: str) -> None:
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        create_access_token(user_id, username),
        max_age=JWT_EXPIRE_MINUTES * 60,
        **_ACCESS_COOKIE_KWARGS,
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        create_refresh_token(user_id, username),
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        **_REFRESH_COOKIE_KWARGS,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE_NAME, **_ACCESS_COOKIE_KWARGS)
    response.delete_cookie(REFRESH_COOKIE_NAME, **_REFRESH_COOKIE_KWARGS)


def _get_allowed_user(user_id: int) -> dict | None:
    user = repo.get_user_by_id(user_id)
    if user is None or user["username"] not in ALLOWED_USERNAMES:
        return None
    return user


def _decode_user(token: str | None, token_type: str) -> dict | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != token_type:
            return None
        return _get_allowed_user(int(payload["sub"]))
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None


def get_current_user(request: Request) -> dict:
    user = get_optional_user(request)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def get_optional_user(request: Request) -> dict | None:
    return _decode_user(request.cookies.get(ACCESS_COOKIE_NAME), "access")


def _get_or_create_user(username: str) -> dict:
    user = repo.get_user_by_username(username)
    if user is not None:
        return user
    # パスワードログインは廃止したので、password_hash は照合されない空文字で作る
    return {"id": repo.create_user(username, ""), "username": username}


router = APIRouter()


def _login_failed(reason: str) -> RedirectResponse:
    response = RedirectResponse(f"/?login_error={reason}", status_code=status.HTTP_302_FOUND)
    response.delete_cookie(OAUTH_COOKIE, **_OAUTH_COOKIE_KWARGS)
    return response


def _verify_id_token(id_token: str, nonce: str) -> dict:
    # トークンエンドポイントからTLSで直接受け取ったIDトークンなので署名検証は省略できる (OIDC Core 3.1.3.7)
    claims = jwt.decode(
        id_token,
        options={
            "verify_signature": False,
            "verify_aud": True,
            "verify_iss": True,
            "verify_exp": True,
            "require": ["iss", "aud", "exp", "email", "nonce"],
        },
        audience=GOOGLE_CLIENT_ID,
        issuer=GOOGLE_ISSUERS,
    )
    if not secrets.compare_digest(str(claims["nonce"]).encode(), nonce.encode()):
        raise jwt.InvalidTokenError("nonce mismatch")
    return claims


@router.get("/api/auth/google/login")
@limiter.limit("10/minute")
def google_login(request: Request):
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest()).rstrip(b"=").decode()
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email",
        "state": state,
        "nonce": nonce,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    response = RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}", status_code=status.HTTP_302_FOUND)
    oauth_token = jwt.encode(
        {
            "state": state,
            "nonce": nonce,
            "verifier": code_verifier,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=OAUTH_STATE_EXPIRE_MINUTES),
        },
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )
    response.set_cookie(OAUTH_COOKIE, oauth_token, max_age=OAUTH_STATE_EXPIRE_MINUTES * 60, **_OAUTH_COOKIE_KWARGS)
    return response


@router.get("/api/auth/google/callback")
@limiter.limit("10/minute")
def google_callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    if error == "access_denied":
        return _login_failed("cancelled")
    if error or not code or not state:
        return _login_failed("failed")

    try:
        saved = jwt.decode(request.cookies.get(OAUTH_COOKIE, ""), JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if not secrets.compare_digest(state.encode(), str(saved["state"]).encode()):
            return _login_failed("failed")
    except (jwt.InvalidTokenError, KeyError):
        return _login_failed("failed")

    try:
        token_res = httpx.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
                "code_verifier": saved["verifier"],
            },
            timeout=10,
        )
        token_res.raise_for_status()
        claims = _verify_id_token(token_res.json()["id_token"], str(saved["nonce"]))
    except (httpx.HTTPError, KeyError, ValueError, jwt.InvalidTokenError):
        return _login_failed("failed")

    username = ALLOWED_ACCOUNTS.get(str(claims["email"]).lower())
    if claims.get("email_verified") is not True or username is None:
        return _login_failed("forbidden")

    user = _get_or_create_user(username)
    response = RedirectResponse("/", status_code=status.HTTP_302_FOUND)
    response.delete_cookie(OAUTH_COOKIE, **_OAUTH_COOKIE_KWARGS)
    set_auth_cookies(response, user["id"], user["username"])
    return response


@router.post("/api/auth/refresh")
@limiter.limit("20/minute")
def refresh(request: Request, response: Response):
    user = _decode_user(request.cookies.get(REFRESH_COOKIE_NAME), "refresh")
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    set_auth_cookies(response, user["id"], user["username"])
    return {"id": user["id"], "username": user["username"]}


@router.post("/api/auth/logout")
def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "username": user["username"]}
