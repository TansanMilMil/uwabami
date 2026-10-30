import os
import tempfile
import time
import unittest
from unittest.mock import patch

_tmpdir = tempfile.TemporaryDirectory()
os.environ.update(
    {
        "UWABAMI_DB_PATH": os.path.join(_tmpdir.name, "drinks.db"),
        "UWABAMI_JWT_SECRET_KEY": "test-secret-key-for-unit-tests-only-32b",
        "UWABAMI_GOOGLE_CLIENT_ID": "client-id",
        "UWABAMI_GOOGLE_CLIENT_SECRET": "client-secret",
        "UWABAMI_GOOGLE_REDIRECT_URI": "http://localhost/callback",
        "UWABAMI_GOOGLE_ALLOWED_ACCOUNTS": "me@example.com=alice",
        "UWABAMI_SECURE_COOKIE": "false",
    }
)

import jwt
from fastapi import FastAPI, Response
from fastapi.testclient import TestClient

from db import repo
from routers import auth

USER_ID = repo.create_user("alice", "")


def issue_cookies(expires_in=3600) -> dict[str, str]:
    session = repo.create_auth_session(USER_ID, int(time.time()) + expires_in)
    response = Response()
    auth.set_auth_cookies(response, session, "alice")
    return cookies_from(response)


def cookies_from(response) -> dict[str, str]:
    cookies = {}
    headers = response.headers
    for header in headers.getlist("set-cookie") if hasattr(headers, "getlist") else headers.get_list("set-cookie"):
        name, value = header.split(";", 1)[0].split("=", 1)
        cookies[name] = value
    return cookies


class AuthSessionTest(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.state.limiter = auth.limiter
        app.include_router(auth.router)
        self.client = TestClient(app)

    def send(self, method, path, cookies):
        self.client.cookies.clear()
        for name, value in cookies.items():
            self.client.cookies.set(name, value)
        return self.client.request(method, path)

    def me(self, cookies):
        return self.send("GET", "/api/auth/me", {auth.ACCESS_COOKIE_NAME: cookies[auth.ACCESS_COOKIE_NAME]})

    def refresh(self, cookies):
        return self.send("POST", "/api/auth/refresh", {auth.REFRESH_COOKIE_NAME: cookies[auth.REFRESH_COOKIE_NAME]})

    def test_access_token_is_accepted(self):
        self.assertEqual(self.me(issue_cookies()).status_code, 200)

    def test_logout_revokes_access_and_refresh_tokens(self):
        cookies = issue_cookies()
        self.assertEqual(self.send("POST", "/api/auth/logout", cookies).status_code, 200)
        self.assertEqual(self.me(cookies).status_code, 401)
        self.assertEqual(self.refresh(cookies).status_code, 401)

    def test_logout_with_only_refresh_token_revokes_session(self):
        cookies = issue_cookies()
        self.send("POST", "/api/auth/logout", {auth.REFRESH_COOKIE_NAME: cookies[auth.REFRESH_COOKIE_NAME]})
        self.assertEqual(self.me(cookies).status_code, 401)

    def test_logout_keeps_other_sessions(self):
        cookies = issue_cookies()
        other = issue_cookies()
        self.send("POST", "/api/auth/logout", cookies)
        self.assertEqual(self.me(other).status_code, 200)

    def test_refresh_rotates_token(self):
        cookies = issue_cookies()
        res = self.refresh(cookies)
        self.assertEqual(res.status_code, 200)
        rotated = cookies_from(res)
        self.assertNotEqual(rotated[auth.REFRESH_COOKIE_NAME], cookies[auth.REFRESH_COOKIE_NAME])
        self.assertEqual(self.refresh(rotated).status_code, 200)

    def test_concurrent_refresh_within_grace_is_allowed(self):
        cookies = issue_cookies()
        self.assertEqual(self.refresh(cookies).status_code, 200)
        res = self.refresh(cookies)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.me(cookies_from(res)).status_code, 200)

    def test_reused_refresh_token_revokes_session(self):
        cookies = issue_cookies()
        rotated = cookies_from(self.refresh(cookies))
        with patch("repository.sqlite.time.time", return_value=time.time() + auth.REFRESH_REUSE_GRACE_SECONDS + 1):
            self.assertEqual(self.refresh(cookies).status_code, 401)
        self.assertEqual(self.refresh(rotated).status_code, 401)
        self.assertEqual(self.me(rotated).status_code, 401)

    def test_refresh_does_not_extend_session_expiry(self):
        cookies = issue_cookies(expires_in=600)
        before = jwt.decode(cookies[auth.REFRESH_COOKIE_NAME], options={"verify_signature": False})
        after_cookies = cookies_from(self.refresh(cookies))
        after = jwt.decode(after_cookies[auth.REFRESH_COOKIE_NAME], options={"verify_signature": False})
        access = jwt.decode(after_cookies[auth.ACCESS_COOKIE_NAME], options={"verify_signature": False})
        self.assertEqual(after["exp"], before["exp"])
        self.assertLessEqual(access["exp"], before["exp"])

    def test_token_without_session_is_rejected(self):
        legacy = jwt.encode(
            {"sub": str(USER_ID), "username": "alice", "type": "access", "exp": int(time.time()) + 600},
            auth.JWT_SECRET_KEY,
            algorithm=auth.JWT_ALGORITHM,
        )
        self.assertEqual(self.me({auth.ACCESS_COOKIE_NAME: legacy}).status_code, 401)

    def test_token_with_other_user_id_is_rejected(self):
        cookies = issue_cookies()
        payload = jwt.decode(cookies[auth.ACCESS_COOKIE_NAME], auth.JWT_SECRET_KEY, algorithms=[auth.JWT_ALGORITHM])
        payload["sub"] = str(USER_ID + 1)
        forged = jwt.encode(payload, auth.JWT_SECRET_KEY, algorithm=auth.JWT_ALGORITHM)
        self.assertEqual(self.me({auth.ACCESS_COOKIE_NAME: forged}).status_code, 401)

    def test_refresh_token_cannot_be_used_as_access_token(self):
        cookies = issue_cookies()
        self.assertEqual(self.me({auth.ACCESS_COOKIE_NAME: cookies[auth.REFRESH_COOKIE_NAME]}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
