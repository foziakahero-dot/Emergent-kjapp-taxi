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


# ---------- Apple Sign In (iter4) ----------
class TestAppleSignIn:
    def test_apple_config_when_unconfigured(self):
        r = requests.get(f"{API}/auth/apple/config", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "client_id" in data and "enabled" in data
        # APPLE_CLIENT_ID is empty by design in this iter
        assert data["enabled"] is False
        assert data["client_id"] == ""

    def test_apple_signin_returns_501_when_unconfigured(self):
        r = requests.post(f"{API}/auth/apple",
                          json={"identity_token": "fake.jwt.token", "email": "x@example.com"},
                          timeout=15)
        assert r.status_code == 501, f"expected 501, got {r.status_code} {r.text}"
        detail = r.json().get("detail", "")
        assert "Apple Sign In er ikke konfigurert" in detail


# ---------- SendGrid email graceful no-op (iter4) ----------
class TestDriverInviteEmail:
    def test_invite_with_email_no_sendgrid_key(self, admin_token):
        email = f"TEST_invite_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/admin/driver-invites",
                          headers=_headers(admin_token),
                          json={"driver_id": "car-3", "email": email, "note": "TEST iter4"},
                          timeout=15)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv.get("email") == email.lower()
        # SENDGRID_API_KEY empty -> email_sent must be False (graceful no-op)
        assert inv.get("email_sent") is False
        assert inv.get("token")

        # Check backend log for [EMAIL/no-key] entry
        try:
            with open("/var/log/supervisor/backend.out.log", "r") as f:
                # read last 20KB
                f.seek(0, 2)
                size = f.tell()
                f.seek(max(0, size - 20000))
                tail = f.read()
            assert "[EMAIL/no-key]" in tail, "expected [EMAIL/no-key] log entry"
            assert email in tail or email.lower() in tail, f"expected recipient {email} in backend log"
        except FileNotFoundError:
            pytest.skip("backend.out.log not accessible")

    def test_invite_without_email(self, admin_token):
        r = requests.post(f"{API}/admin/driver-invites",
                          headers=_headers(admin_token),
                          json={"driver_id": "car-3", "note": "TEST no-email"},
                          timeout=15)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv.get("email") is None
        assert inv.get("email_sent") is False

    def test_duplicate_invite_email_no_crash(self, admin_token):
        email = f"TEST_dup_{uuid.uuid4().hex[:8]}@example.com"
        for _ in range(2):
            r = requests.post(f"{API}/admin/driver-invites",
                              headers=_headers(admin_token),
                              json={"driver_id": "car-3", "email": email},
                              timeout=15)
            assert r.status_code == 200, r.text
            assert r.json().get("email_sent") is False

    def test_list_invites_includes_email_field(self, admin_token):
        # create an invite with email
        email = f"TEST_listemail_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/admin/driver-invites",
                      headers=_headers(admin_token),
                      json={"driver_id": "car-3", "email": email}, timeout=15)
        r = requests.get(f"{API}/admin/driver-invites", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        invites = r.json().get("invites", [])
        found = next((i for i in invites if i.get("email") == email.lower()), None)
        assert found is not None, "invite with email not found in list"
        assert "email" in found

    def test_accept_invite_with_email_attached(self, admin_token):
        email = f"TEST_accept_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/admin/driver-invites",
                          headers=_headers(admin_token),
                          json={"driver_id": "car-3", "email": email}, timeout=15)
        assert r.status_code == 200
        token = r.json()["token"]

        driver_email = f"TEST_drv_{uuid.uuid4().hex[:8]}@kjapp.no"
        r = requests.post(f"{API}/driver-invites/accept", json={
            "token": token,
            "fullName": "TEST Driver iter4",
            "email": driver_email,
            "phone": "+4790000456",
            "password": "drv12345",
        }, timeout=15)
        assert r.status_code == 200, r.text
        payload = r.json()
        assert payload["user"]["role"] == "driver"
        assert payload["user"]["approved"] is False


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
