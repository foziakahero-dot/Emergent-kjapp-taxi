"""Iter9 — Google OAuth session endpoint + auth regression tests."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://github-app-builder-28.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Google OAuth session (called from /auth/callback) ---
class TestGoogleSession:
    def test_invalid_session_returns_401(self, client):
        r = client.post(f"{API}/auth/google/session", json={"session_id": "not-a-real-id"})
        assert r.status_code == 401, f"Expected 401 got {r.status_code} body={r.text[:200]}"
        body = r.json()
        detail = body.get("detail", "")
        assert "Ugyldig Google-økt" in detail, f"Unexpected detail: {detail}"

    def test_missing_session_id_returns_422(self, client):
        r = client.post(f"{API}/auth/google/session", json={})
        assert r.status_code in (400, 422)


# --- Auth regression: login / register / logout / me ---
class TestAuthRegression:
    def test_login_ola(self, client):
        r = client.post(f"{API}/auth/login", json={"email": "ola@kjapp.no", "password": "test1234"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data or "access_token" in data
        token = data.get("token") or data.get("access_token")
        assert isinstance(token, str) and len(token) > 20
        user = data.get("user", {})
        assert user.get("role") == "user"
        assert user.get("email") == "ola@kjapp.no"

    def test_me_endpoint(self, client):
        r = client.post(f"{API}/auth/login", json={"email": "ola@kjapp.no", "password": "test1234"})
        token = r.json().get("token") or r.json().get("access_token")
        r2 = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200, r2.text
        me = r2.json()
        assert me.get("email") == "ola@kjapp.no"

    def test_register_new_user(self, client):
        email = f"TEST_iter9_{int(time.time()*1000)}@kjapp.no"
        r = client.post(f"{API}/auth/register", json={
            "email": email, "password": "test12345", "fullName": "Iter9 Tester", "phone": "+4790000009"
        })
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert (data.get("user") or {}).get("email", "").lower() == email.lower() or data.get("email", "").lower() == email.lower()

    def test_logout(self, client):
        r = client.post(f"{API}/auth/login", json={"email": "ola@kjapp.no", "password": "test1234"})
        token = r.json().get("token") or r.json().get("access_token")
        r2 = client.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code in (200, 204), r2.text
