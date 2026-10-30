import os
import secrets
import sqlite3
import time
from typing import List, Optional

_SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS drinks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        origin TEXT,
        price INTEGER,
        memo TEXT,
        image_path TEXT,
        created_by INTEGER NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS taste_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS drink_taste_types (
        drink_id INTEGER NOT NULL,
        taste_type_id INTEGER NOT NULL,
        FOREIGN KEY (drink_id) REFERENCES drinks(id) ON DELETE CASCADE,
        FOREIGN KEY (taste_type_id) REFERENCES taste_types(id) ON DELETE CASCADE,
        PRIMARY KEY (drink_id, taste_type_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS drink_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        drink_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        drunk_date TEXT NOT NULL,
        star_rating REAL NOT NULL,
        memo TEXT,
        FOREIGN KEY (drink_id) REFERENCES drinks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        refresh_jti TEXT NOT NULL,
        prev_refresh_jti TEXT,
        rotated_at INTEGER,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at)",
)

class SQLiteDrinkRepository:
    def __init__(self, db_path: str):
        if not os.path.exists(os.path.dirname(db_path)):
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        con = sqlite3.connect(self.db_path)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys = ON")
        return con

    def _ensure_schema(self) -> None:
        with self._connect() as con:
            for stmt in _SCHEMA_STATEMENTS:
                con.execute(stmt)
            # Migration
            try:
                con.execute("ALTER TABLE drinks ADD COLUMN image_path TEXT")
            except sqlite3.OperationalError:
                pass

    def get_user_by_username(self, username: str) -> Optional[dict]:
        with self._connect() as con:
            row = con.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
            return dict(row) if row else None

    def get_user_by_id(self, user_id: int) -> Optional[dict]:
        with self._connect() as con:
            row = con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return dict(row) if row else None

    def create_user(self, username: str, password_hash: str) -> int:
        with self._connect() as con:
            cur = con.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash))
            return cur.lastrowid

    def get_drinks(self, status: Optional[str] = None, q: Optional[str] = None, category: Optional[str] = None, sort: Optional[str] = None) -> List[dict]:
        query = """
            SELECT d.*,
                (SELECT dl.memo FROM drink_logs dl
                 WHERE dl.drink_id = d.id
                 ORDER BY dl.drunk_date DESC, dl.id DESC
                 LIMIT 1) AS latest_memo,
                (SELECT dl.star_rating FROM drink_logs dl
                 WHERE dl.drink_id = d.id
                 ORDER BY dl.drunk_date DESC, dl.id DESC
                 LIMIT 1) AS latest_star_rating,
                (SELECT dl.drunk_date FROM drink_logs dl
                 WHERE dl.drink_id = d.id
                 ORDER BY dl.drunk_date DESC, dl.id DESC
                 LIMIT 1) AS latest_drunk_date,
                (SELECT u.username FROM drink_logs dl
                 JOIN users u ON u.id = dl.user_id
                 WHERE dl.drink_id = d.id
                 ORDER BY dl.drunk_date DESC, dl.id DESC
                 LIMIT 1) AS latest_username
            FROM drinks d
        """
        conditions = []
        params = []
        if status:
            conditions.append("d.status = ?")
            params.append(status)
        if q:
            conditions.append("(d.name LIKE ? OR d.origin LIKE ? OR d.memo LIKE ? OR d.category LIKE ? OR EXISTS (SELECT 1 FROM drink_logs dl WHERE dl.drink_id = d.id AND dl.memo LIKE ?))")
            q_param = f"%{q}%"
            params.extend([q_param] * 5)
        if category:
            conditions.append("(d.category = ? OR d.category LIKE ? OR d.category LIKE ? OR d.category LIKE ?)")
            params.extend([category, f"{category},%", f"%,{category},%", f"%,{category}"])
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        if sort == "rating":
            query += " ORDER BY latest_star_rating DESC, d.id DESC"
        else:
            query += " ORDER BY d.id DESC"

        with self._connect() as con:
            rows = con.execute(query, tuple(params)).fetchall()
            drinks = [dict(r) for r in rows]
            for drink in drinks:
                drink["taste_types"] = self.get_drink_taste_types(drink["id"], con)
            return drinks

    def get_drink_categories(self) -> List[str]:
        with self._connect() as con:
            rows = con.execute("SELECT DISTINCT category FROM drinks").fetchall()
            cats = set()
            for r in rows:
                if r["category"]:
                    for c in r["category"].split(','):
                        c = c.strip()
                        if c:
                            cats.add(c)
            return sorted(list(cats))

    def get_drink_origins(self) -> List[str]:
        with self._connect() as con:
            rows = con.execute("SELECT DISTINCT origin FROM drinks WHERE origin IS NOT NULL AND origin != ''").fetchall()
            return sorted([r["origin"] for r in rows])


    def get_drink_by_id(self, drink_id: int) -> Optional[dict]:
        with self._connect() as con:
            row = con.execute("SELECT * FROM drinks WHERE id = ?", (drink_id,)).fetchone()
            if not row:
                return None
            drink = dict(row)
            drink["taste_types"] = self.get_drink_taste_types(drink_id, con)
            return drink

    def get_drink_taste_types(self, drink_id: int, con: sqlite3.Connection) -> List[dict]:
        query = """
            SELECT t.* FROM taste_types t
            JOIN drink_taste_types dt ON t.id = dt.taste_type_id
            WHERE dt.drink_id = ?
        """
        rows = con.execute(query, (drink_id,)).fetchall()
        return [dict(r) for r in rows]

    def create_drink(self, name: str, category: str, status: str, origin: Optional[str], price: Optional[int], memo: Optional[str], created_by: int, taste_type_ids: List[int]) -> int:
        with self._connect() as con:
            cur = con.execute(
                "INSERT INTO drinks (name, category, status, origin, price, memo, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (name, category, status, origin, price, memo, created_by)
            )
            drink_id = cur.lastrowid
            for t_id in taste_type_ids:
                con.execute("INSERT INTO drink_taste_types (drink_id, taste_type_id) VALUES (?, ?)", (drink_id, t_id))
            return drink_id

    def update_drink(self, drink_id: int, name: str, category: str, status: str, origin: Optional[str], price: Optional[int], memo: Optional[str], taste_type_ids: List[int]) -> None:
        with self._connect() as con:
            con.execute(
                "UPDATE drinks SET name = ?, category = ?, status = ?, origin = ?, price = ?, memo = ? WHERE id = ?",
                (name, category, status, origin, price, memo, drink_id)
            )
            con.execute("DELETE FROM drink_taste_types WHERE drink_id = ?", (drink_id,))
            for t_id in taste_type_ids:
                con.execute("INSERT INTO drink_taste_types (drink_id, taste_type_id) VALUES (?, ?)", (drink_id, t_id))

    def delete_drink(self, drink_id: int) -> None:
        with self._connect() as con:
            con.execute("DELETE FROM drinks WHERE id = ?", (drink_id,))

    def set_drink_image_path(self, drink_id: int, image_path: Optional[str]) -> None:
        with self._connect() as con:
            con.execute("UPDATE drinks SET image_path = ? WHERE id = ?", (image_path, drink_id))

    def get_taste_types(self) -> List[dict]:
        with self._connect() as con:
            rows = con.execute("SELECT * FROM taste_types ORDER BY name").fetchall()
            return [dict(r) for r in rows]

    def create_taste_type(self, name: str) -> int:
        with self._connect() as con:
            try:
                cur = con.execute("INSERT INTO taste_types (name) VALUES (?)", (name,))
                return cur.lastrowid
            except sqlite3.IntegrityError:
                # すでに存在する場合はそのidを返す
                row = con.execute("SELECT id FROM taste_types WHERE name = ?", (name,)).fetchone()
                return row["id"]

    def get_drink_logs(self, drink_id: int) -> List[dict]:
        with self._connect() as con:
            rows = con.execute(
                """
                SELECT dl.*, u.username
                FROM drink_logs dl
                JOIN users u ON u.id = dl.user_id
                WHERE dl.drink_id = ?
                ORDER BY dl.drunk_date DESC, dl.id DESC
                """,
                (drink_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def create_drink_log(self, drink_id: int, user_id: int, drunk_date: str, star_rating: float, memo: Optional[str]) -> int:
        with self._connect() as con:
            cur = con.execute(
                "INSERT INTO drink_logs (drink_id, user_id, drunk_date, star_rating, memo) VALUES (?, ?, ?, ?, ?)",
                (drink_id, user_id, drunk_date, star_rating, memo)
            )
            return cur.lastrowid

    def update_drink_log(self, log_id: int, drunk_date: str, star_rating: float, memo: Optional[str]) -> None:
        with self._connect() as con:
            con.execute(
                "UPDATE drink_logs SET drunk_date = ?, star_rating = ?, memo = ? WHERE id = ?",
                (drunk_date, star_rating, memo, log_id)
            )

    def delete_drink_log(self, log_id: int) -> None:
        with self._connect() as con:
            con.execute("DELETE FROM drink_logs WHERE id = ?", (log_id,))

    def get_log_by_id(self, log_id: int) -> Optional[dict]:
        with self._connect() as con:
            row = con.execute("SELECT * FROM drink_logs WHERE id = ?", (log_id,)).fetchone()
            return dict(row) if row else None

    def create_auth_session(self, user_id: int, expires_at: int) -> dict:
        session = {
            "id": secrets.token_urlsafe(32),
            "user_id": user_id,
            "refresh_jti": secrets.token_urlsafe(32),
            "expires_at": expires_at,
        }
        with self._connect() as con:
            con.execute(
                "INSERT INTO auth_sessions (id, user_id, refresh_jti, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
                (session["id"], user_id, session["refresh_jti"], int(time.time()), expires_at),
            )
        return session

    def get_auth_session(self, session_id: str) -> Optional[dict]:
        with self._connect() as con:
            row = con.execute(
                "SELECT id, user_id, refresh_jti, expires_at FROM auth_sessions WHERE id = ? AND expires_at > ?",
                (session_id, int(time.time())),
            ).fetchone()
            return dict(row) if row else None

    def rotate_refresh_jti(self, session_id: str, presented_jti: str, grace_seconds: int) -> Optional[dict]:
        """refresh token を使い捨てにする。使用済みの jti が猶予外で来たら盗用とみなしてセッションごと失効させる。

        猶予内の直前の jti は、複数タブがほぼ同時に refresh した場合なので、入れ替えずに現在のセッションを返す。
        """
        now = int(time.time())
        new_jti = secrets.token_urlsafe(32)
        with self._connect() as con:
            cur = con.execute(
                """
                UPDATE auth_sessions
                SET prev_refresh_jti = refresh_jti, refresh_jti = ?, rotated_at = ?
                WHERE id = ? AND refresh_jti = ? AND expires_at > ?
                """,
                (new_jti, now, session_id, presented_jti, now),
            )
            if cur.rowcount == 1:
                row = con.execute(
                    "SELECT id, user_id, refresh_jti, expires_at FROM auth_sessions WHERE id = ?", (session_id,)
                ).fetchone()
                return dict(row)
            row = con.execute(
                "SELECT id, user_id, refresh_jti, prev_refresh_jti, rotated_at, expires_at FROM auth_sessions WHERE id = ? AND expires_at > ?",
                (session_id, now),
            ).fetchone()
            if row is None:
                return None
            if row["prev_refresh_jti"] == presented_jti and now - row["rotated_at"] <= grace_seconds:
                return {k: row[k] for k in ("id", "user_id", "refresh_jti", "expires_at")}
            con.execute("DELETE FROM auth_sessions WHERE id = ?", (session_id,))
            return None

    def delete_auth_session(self, session_id: str) -> None:
        with self._connect() as con:
            con.execute("DELETE FROM auth_sessions WHERE id = ?", (session_id,))

    def delete_expired_auth_sessions(self) -> None:
        with self._connect() as con:
            con.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (int(time.time()),))
