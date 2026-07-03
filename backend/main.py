import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from routers import auth, drinks, drink_logs, taste_types

limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Nginx からの X-Forwarded-For を信頼してクライアント実IPを取得する
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://os3-386-26416.vs.sakura.ne.jp:8090"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(drinks.router)
app.include_router(drink_logs.router)
app.include_router(taste_types.router)

uploads_dir = os.environ.get("UPLOADS_DIR", "/app/uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
