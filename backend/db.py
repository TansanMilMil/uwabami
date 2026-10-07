import os
import hashlib
import bcrypt

from repository.sqlite import SQLiteDrinkRepository

# bcrypt>=5 raises on inputs over 72 bytes; passlib silently truncated, so keep that for existing hashes.
def _bcrypt_input(password: str) -> bytes:
    return password.encode()[:72]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(_bcrypt_input(password), bcrypt.gensalt()).decode()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # Check for legacy sha256 hashes (64 hex chars)
        if len(hashed_password) == 64 and all(c in '0123456789abcdefABCDEF' for c in hashed_password):
            return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password
        return bcrypt.checkpw(_bcrypt_input(plain_password), hashed_password.encode())
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
