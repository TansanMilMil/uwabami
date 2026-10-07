import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
import jwt
from slowapi import Limiter
from slowapi.util import get_remote_address

from db import repo, hash_password, verify_password
from models import UserCreate, User

limiter = Limiter(key_func=get_remote_address)

JWT_SECRET_KEY = os.environ.get("UWABAMI_JWT_SECRET_KEY", "dummy_secret_key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("UWABAMI_JWT_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("UWABAMI_REFRESH_TOKEN_EXPIRE_DAYS", "30"))
SECURE_COOKIE = os.environ.get("UWABAMI_SECURE_COOKIE", "true").lower() == "true"
AUTH_COOKIE_PATH = "/api/auth"

ACCESS_COOKIE_NAME = "auth_token"
REFRESH_COOKIE_NAME = "refresh_token"
_ACCESS_COOKIE_KWARGS = {"httponly": True, "samesite": "lax", "secure": SECURE_COOKIE}
_REFRESH_COOKIE_KWARGS = {"httponly": True, "samesite": "lax", "secure": SECURE_COOKIE, "path": AUTH_COOKIE_PATH}


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


def get_current_user(request: Request) -> dict:
    token = request.cookies.get(ACCESS_COOKIE_NAME)
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            if payload.get("type") == "access":
                user = repo.get_user_by_id(int(payload["sub"]))
                if user:
                    return user
        except (jwt.InvalidTokenError, ValueError):
            pass
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


def get_optional_user(request: Request) -> dict | None:
    token = request.cookies.get(ACCESS_COOKIE_NAME)
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            if payload.get("type") == "access":
                return repo.get_user_by_id(int(payload["sub"]))
        except (jwt.InvalidTokenError, ValueError):
            pass
    return None


router = APIRouter()

@router.post("/api/auth/register")
@limiter.limit("5/minute")
def register(request: Request, body: UserCreate, response: Response):
    if repo.get_user_by_username(body.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_pw = hash_password(body.password)
    user_id = repo.create_user(body.username, hashed_pw)

    set_auth_cookies(response, user_id, body.username)
    return {"id": user_id, "username": body.username}


@router.post("/api/auth/login")
@limiter.limit("5/minute")
def login(request: Request, body: UserCreate, response: Response):
    user = repo.get_user_by_username(body.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    set_auth_cookies(response, user["id"], user["username"])
    return {"id": user["id"], "username": user["username"]}


@router.post("/api/auth/refresh")
@limiter.limit("20/minute")
def refresh(request: Request, response: Response):
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = repo.get_user_by_id(user_id)
    if not user:
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
