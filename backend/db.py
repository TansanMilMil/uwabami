import os

from repository.sqlite import SQLiteDrinkRepository

DB_PATH = os.environ.get("NINA_NJAA_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "db", "drinks.db"))
repo = SQLiteDrinkRepository(DB_PATH)
