import os
import hashlib

from repository.sqlite import SQLiteDrinkRepository

DB_PATH = os.environ.get("UWABAMI_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "db", "drinks.db"))
repo = SQLiteDrinkRepository(DB_PATH)

# Initialize default user
basic_user = os.environ.get("UWABAMI_BASIC_AUTH_USER")
basic_pass = os.environ.get("UWABAMI_BASIC_AUTH_PASS")

if basic_user and basic_pass:
    if not repo.get_user_by_username(basic_user):
        hashed_pw = hashlib.sha256(basic_pass.encode()).hexdigest()
        repo.create_user(basic_user, hashed_pw)
