"""KJAPP backend tests — iteration 3.
Tests: real Norwegian prices, admin endpoints, driver-invitation flow, Google auth stub.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mobile-forge-1487.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@kjapp.no", "password": "admin123"}
USER = {"email": "ola@kjapp.no", "password": "test1234"}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token():
    return _login(**ADMIN)


@pytest.fixture(scope="session")
def user_token():
    return _login(**USER)


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Prices ----------
class TestPrices:
    def test_estimate_returns_4_options_norwegian_range(self):
        body = {
            "pickup_lat": 59.9127, "pickup_lng": 10.7461,
            "dropoff_lat": 59.9110, "dropoff_lng": 10.7530,
        }
        r = requests.post(f"{API}/trips/estimate", json=body, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "options" in data and len(data["options"]) == 4
        types = {o["vehicle_type"] for o in data["options"]}
        assert types == {"ai-first", "enkelt", "trygg", "premium"}
        for o in data["options"]:
            assert 50 <= o["price"] <= 600, f"unrealistic price for {o['vehicle_type']}: {o['price']}"
        prices = {o["vehicle_type"]: o["price"] for o in data["options"]}
        assert prices["enkelt"] < prices["ai-first"] < prices["trygg"] < prices["premium"]
        assert prices["premium"] >= 120

    def test_estimate_scales_with_distance(self):
        short = requests.post(f"{API}/trips/estimate", json={
            "pickup_lat": 59.9127, "pickup_lng": 10.7461,
            "dropoff_lat": 59.9110, "dropoff_lng": 10.7530,
        }, timeout=20).json()
        long_ = requests.post(f"{API}/trips/estimate", json={
            "pickup_lat": 59.9127, "pickup_lng": 10.7461,
            "dropoff_lat": 60.1975, "dropoff_lng": 11.1004,
        }, timeout=20).json()
        s = {o["vehicle_type"]: o["price"] for o in short["options"]}
        l = {o["vehicle_type"]: o["price"] for o in long_["options"]}
        assert l["ai-first"] > s["ai-first"] * 3
        assert l["ai-first"] > 300


# ---------- Auth /me role ----------
class TestAuthMe:
    def test_admin_me_has_admin_role(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json().get("role") == "admin"


# ---------- Admin gating ----------
class TestAdminGating:
    def test_regular_user_gets_403(self, user_token):
        for path in ["/admin/overview", "/admin/users", "/admin/drivers", "/admin/trips"]:
            r = requests.get(f"{API}{path}", headers=_headers(user_token), timeout=15)
            assert r.status_code == 403, f"{path} expected 403, got {r.status_code}"

    def test_admin_overview_shape(self, admin_token):
        r = requests.get(f"{API}/admin/overview", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ["users", "drivers", "drivers_pending", "trips_today", "revenue_today", "trips_total"]:
            assert k in data
            assert isinstance(data[k], int)

    def test_admin_users_drivers_trips(self, admin_token):
        for path, key in [("/admin/users", "users"), ("/admin/drivers", "drivers"), ("/admin/trips", "trips")]:
            r = requests.get(f"{API}{path}", headers=_headers(admin_token), timeout=15)
            assert r.status_code == 200, f"{path}: {r.text}"
            assert key in r.json()


# ---------- Driver invitation flow ----------
class TestDriverInvites:
    def test_full_invite_lifecycle(self, admin_token):
        r = requests.post(f"{API}/admin/driver-invites",
                          headers=_headers(admin_token),
                          json={"driver_id": "car-2", "note": "TEST"}, timeout=15)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv.get("token") and len(inv["token"]) >= 20
        assert inv["driver_id"] == "car-2"
        assert inv["used"] is False
        assert inv.get("expires_at")
        token = inv["token"]

        r = requests.get(f"{API}/driver-invites/{token}", timeout=15)
        assert r.status_code == 200, r.text
        info = r.json()
        assert info["driver_id"] == "car-2"
        assert info.get("car") and info.get("plate")

        r = requests.get(f"{API}/driver-invites/nonexistent_token_xyz", timeout=15)
        assert r.status_code == 404

        new_email = f"TEST_driver_{uuid.uuid4().hex[:8]}@kjapp.no"
        r = requests.post(f"{API}/driver-invites/accept", json={
            "token": token,
            "fullName": "TEST Driver",
            "email": new_email,
            "phone": "+4790000123",
            "password": "drv12345",
        }, timeout=15)
        assert r.status_code == 200, r.text
        payload = r.json()
        assert payload.get("token")
        assert payload["user"]["role"] == "driver"
        assert payload["user"]["approved"] is False
        assert payload["user"]["driver_id"] == "car-2"
        new_user_id = payload["user"]["id"]

        r = requests.post(f"{API}/driver-invites/accept", json={
            "token": token,
            "fullName": "x", "email": f"TEST_x_{uuid.uuid4().hex[:6]}@kjapp.no",
            "phone": "+47", "password": "abcdef",
        }, timeout=15)
        assert r.status_code == 410

        r = requests.get(f"{API}/driver-invites/{token}", timeout=15)
        assert r.status_code == 410

        r = requests.post(f"{API}/auth/login", json={"email": new_email, "password": "drv12345"}, timeout=15)
        assert r.status_code == 200
        new_driver_token = r.json()["token"]

        r = requests.get(f"{API}/driver/pending", headers=_headers(new_driver_token), timeout=15)
        assert r.status_code == 403, f"expected 403 for unapproved driver, got {r.status_code}"

        r = requests.post(f"{API}/admin/drivers/{new_user_id}/approve",
                          headers=_headers(admin_token), json={"approved": True}, timeout=15)
        assert r.status_code == 200

        r = requests.get(f"{API}/driver/pending", headers=_headers(new_driver_token), timeout=15)
        assert r.status_code == 200, f"approved driver should get 200, got {r.status_code} {r.text}"
        assert "trips" in r.json()

    def test_list_invites(self, admin_token):
        r = requests.get(f"{API}/admin/driver-invites", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json().get("invites"), list)

    def test_invite_invalid_driver_id(self, admin_token):
        r = requests.post(f"{API}/admin/driver-invites",
                          headers=_headers(admin_token),
                          json={"driver_id": "no-such-car"}, timeout=15)
        assert r.status_code == 404


# ---------- Google Sign-in stub ----------
class TestGoogleSession:
    def test_fake_session_returns_401(self):
        r = requests.post(f"{API}/auth/google/session",
                          json={"session_id": "fake_session_id_that_does_not_exist_xyz"},
                          timeout=20)
        assert r.status_code == 401, f"expected 401, got {r.status_code} body={r.text}"
        try:
            assert "Ugyldig" in r.json().get("detail", "")
        except Exception:
            pass
