import os
import hashlib
from passlib.context import CryptContext

from repository.sqlite import SQLiteDrinkRepository

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # Check for legacy sha256 hashes (64 hex chars)
        if len(hashed_password) == 64 and all(c in '0123456789abcdefABCDEF' for c in hashed_password):
            return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

DB_PATH = os.environ.get("UWABAMI_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "db", "drinks.db"))
repo = SQLiteDrinkRepository(DB_PATH)

# Initialize default user
basic_user = os.environ.get("UWABAMI_BASIC_AUTH_USER")
basic_pass = os.environ.get("UWABAMI_BASIC_AUTH_PASS")

if basic_user and basic_pass:
    if not repo.get_user_by_username(basic_user):
        hashed_pw = hash_password(basic_pass)
        repo.create_user(basic_user, hashed_pw)
