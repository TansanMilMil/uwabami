import hashlib
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address

from db import repo
from models import UserCreate, User

limiter = Limiter(key_func=get_remote_address)

JWT_SECRET_KEY = os.environ.get("NINA_NJAA_JWT_SECRET_KEY", "dummy_secret_key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = int(os.environ.get("NINA_NJAA_JWT_EXPIRE_DAYS", "7"))
SECURE_COOKIE = os.environ.get("NINA_NJAA_SECURE_COOKIE", "true").lower() == "true"


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(user_id: int, username: str) -> str:
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "username": username, "exp": expire}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(request: Request) -> dict:
    token = request.cookies.get("auth_token")
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            user_id = int(payload["sub"])
            user = repo.get_user_by_id(user_id)
            if user:
                return user
        except (JWTError, ValueError):
            pass
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


def get_optional_user(request: Request) -> dict | None:
    token = request.cookies.get("auth_token")
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            user_id = int(payload["sub"])
            return repo.get_user_by_id(user_id)
        except (JWTError, ValueError):
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
    
    token = create_access_token(user_id, body.username)
    response.set_cookie(
        "auth_token",
        token,
        httponly=True,
        samesite="lax",
        secure=SECURE_COOKIE,
        max_age=JWT_EXPIRE_DAYS * 24 * 3600,
    )
    return {"id": user_id, "username": body.username}


@router.post("/api/auth/login")
@limiter.limit("5/minute")
def login(request: Request, body: UserCreate, response: Response):
    user = repo.get_user_by_username(body.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user["password_hash"] != hash_password(body.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user["id"], user["username"])
    response.set_cookie(
        "auth_token",
        token,
        httponly=True,
        samesite="lax",
        secure=SECURE_COOKIE,
        max_age=JWT_EXPIRE_DAYS * 24 * 3600,
    )
    return {"id": user["id"], "username": user["username"]}


@router.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("auth_token", httponly=True, samesite="lax", secure=SECURE_COOKIE)
    return {"ok": True}


@router.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "username": user["username"]}
