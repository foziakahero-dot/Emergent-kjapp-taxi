"""KJAPP Iter 15 — Fleet driver-invite UI backend, /api/fleet/drivers online/GPS fields,
full E2E passenger-order + driver-accept + trip lifecycle."""
import os
import time
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

USER = {"email": "ola@kjapp.no", "password": "test1234"}
DRIVER = {"email": "sjafor@kjapp.no", "password": "sjafor1234"}
FLEET = {"email": "floteier1@kjapp.no", "password": "fleet1234"}
ADMIN = {"email": "admin@kjapp.no", "password": "admin123"}

MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "kjapp")]


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.text}"
    return r.json()


def _hdr(t): return {"Authorization": f"Bearer {t}"}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def user_token(): return _login(**USER)["token"]

@pytest.fixture(scope="session")
def driver_token(): return _login(**DRIVER)["token"]

@pytest.fixture(scope="session")
def fleet_token(): return _login(**FLEET)["token"]

@pytest.fixture(scope="session")
def user_id(user_token):
    return requests.get(f"{API}/auth/me", headers=_hdr(user_token), timeout=15).json()["id"]

@pytest.fixture(scope="session")
def driver_id(driver_token):
    return requests.get(f"{API}/auth/me", headers=_hdr(driver_token), timeout=15).json()["id"]


def _cancel_stale(uid):
    DB.trips.update_many(
        {"user_id": uid, "status": {"$in": ["searching", "booking", "driver_on_way", "in_trip", "arrived"]}},
        {"$set": {"status": "cancelled"}},
    )


def _cancel_driver_stale(did):
    DB.trips.update_many(
        {"driver_id": did, "status": {"$in": ["driver_on_way", "in_trip", "arrived"]}},
        {"$set": {"status": "cancelled"}},
    )


# ---------- Fleet driver-invite (iter15 primary) ----------
class TestFleetDriverInvites:
    def test_create_invite_returns_token(self, fleet_token):
        payload = {
            "car": "TEST_Tesla Model Y",
            "plate": "TEST15",
            "vehicle_type": "premium",
            "email": "TEST_newdriver@kjapp.test",
            "note": "TEST_Velkommen",
        }
        r = requests.post(f"{API}/fleet/driver-invites", json=payload, headers=_hdr(fleet_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("token") and isinstance(data["token"], str) and len(data["token"]) >= 20
        assert data["car"] == "TEST_Tesla Model Y"
        assert data["plate"] == "TEST15"
        assert data["vehicle_type"] == "premium"
        assert data["used"] is False
        assert data.get("fleet_id")
        # cleanup
        DB.driver_invites.delete_one({"token": data["token"]})

    def test_list_invites_scoped_to_fleet(self, fleet_token):
        # Create then list
        r = requests.post(f"{API}/fleet/driver-invites", json={"car": "TEST_Camry", "plate": "TEST99", "vehicle_type": "ai-first"}, headers=_hdr(fleet_token), timeout=15)
        assert r.status_code == 200
        token = r.json()["token"]
        try:
            lr = requests.get(f"{API}/fleet/driver-invites", headers=_hdr(fleet_token), timeout=15)
            assert lr.status_code == 200
            invites = lr.json().get("invites", [])
            tokens = [i["token"] for i in invites]
            assert token in tokens
            # verify structure has needed keys for UI
            row = next(i for i in invites if i["token"] == token)
            for k in ("car", "plate", "used", "email_sent"):
                assert k in row
        finally:
            DB.driver_invites.delete_one({"token": token})

    def test_regular_user_forbidden(self, user_token):
        r = requests.post(f"{API}/fleet/driver-invites", json={"car": "X", "plate": "Y", "vehicle_type": "ai-first"}, headers=_hdr(user_token), timeout=15)
        assert r.status_code == 403


# ---------- Fleet drivers endpoint (iter15 shape) ----------
class TestFleetDriversEndpoint:
    def test_returns_drivers_with_expected_fields(self, fleet_token, driver_token):
        # Bring driver online + push a location so last_lat/lng/heading are populated
        requests.post(f"{API}/driver/online", json={"online": True}, headers=_hdr(driver_token), timeout=10)
        requests.post(f"{API}/driver/location", json={"lat": 59.9127, "lng": 10.7461, "heading": 90.0}, headers=_hdr(driver_token), timeout=10)

        r = requests.get(f"{API}/fleet/drivers", headers=_hdr(fleet_token), timeout=15)
        assert r.status_code == 200, r.text
        drivers = r.json().get("drivers", [])
        assert isinstance(drivers, list)
        assert len(drivers) >= 1, "fleet floteier1 should have at least one driver"
        d = next((x for x in drivers if x.get("email") == DRIVER["email"]), drivers[0])
        # Required for UI
        for k in ("id", "fullName", "plate", "car", "online", "last_lat", "last_lng", "today_income", "today_trips"):
            assert k in d, f"missing {k} in driver row: {d.keys()}"
        assert d["online"] is True
        assert d["last_lat"] == 59.9127
        assert d["last_lng"] == 10.7461
        assert d.get("last_heading") == 90.0

    def test_forbidden_for_regular_user(self, user_token):
        r = requests.get(f"{API}/fleet/drivers", headers=_hdr(user_token), timeout=15)
        assert r.status_code == 403


# ---------- E2E: passenger → driver-accept → start → arrive ----------
class TestE2ETripLifecycle:
    def test_full_lifecycle(self, user_token, user_id, driver_token, driver_id):
        _cancel_stale(user_id)
        _cancel_driver_stale(driver_id)

        # Ensure driver online + GPS
        assert requests.post(f"{API}/driver/online", json={"online": True}, headers=_hdr(driver_token), timeout=10).status_code == 200
        assert requests.post(f"{API}/driver/location", json={"lat": 59.9127, "lng": 10.7461, "heading": 0}, headers=_hdr(driver_token), timeout=10).status_code == 200

        # Passenger creates trip
        body = {
            "pickup_address": "TEST_Karl Johans gate 1",
            "pickup_lat": 59.9127, "pickup_lng": 10.7461,
            "dropoff_address": "TEST_Aker Brygge",
            "dropoff_lat": 59.9106, "dropoff_lng": 10.7285,
            "vehicle_type": "ai-first",
        }
        r = requests.post(f"{API}/trips/request", json=body, headers=_hdr(user_token), timeout=20)
        assert r.status_code == 200, r.text
        trip = r.json()
        trip_id = trip["trip_id"]
        assert trip["status"] == "searching"
        assert trip.get("driver_id") is None

        try:
            # Driver sees it as pending
            pending = requests.get(f"{API}/driver/pending", headers=_hdr(driver_token), timeout=10)
            assert pending.status_code == 200
            pending_ids = [t["trip_id"] for t in pending.json().get("trips", [])]
            assert trip_id in pending_ids

            # Driver accepts
            acc = requests.post(f"{API}/driver/accept", json={"trip_id": trip_id}, headers=_hdr(driver_token), timeout=15)
            assert acc.status_code == 200, acc.text
            after = acc.json()
            assert after["status"] == "driver_on_way"
            assert after["driver_id"] == driver_id
            assert after.get("driver_lat") is not None
            assert after.get("driver_lng") is not None
            assert after.get("driver", {}).get("plate") == "EL12345"
            assert after.get("driver", {}).get("car") == "Tesla Model Y"

            # Driver pings new location → trip.driver_lat/lng updates
            requests.post(f"{API}/driver/location", json={"lat": 59.9120, "lng": 10.7450, "heading": 180.0}, headers=_hdr(driver_token), timeout=10)
            time.sleep(0.5)
            got = requests.get(f"{API}/trips/{trip_id}", headers=_hdr(user_token), timeout=10)
            assert got.status_code == 200
            live = got.json()
            assert live["driver_lat"] == 59.9120
            assert live["driver_lng"] == 10.7450

            # Driver starts trip
            st = requests.post(f"{API}/driver/trip/{trip_id}/start", headers=_hdr(driver_token), timeout=10)
            assert st.status_code == 200, st.text
            # Verify
            g = requests.get(f"{API}/trips/{trip_id}", headers=_hdr(user_token), timeout=10).json()
            assert g["status"] == "in_trip"

            # Driver arrives
            ar = requests.post(f"{API}/driver/trip/{trip_id}/arrive", headers=_hdr(driver_token), timeout=10)
            assert ar.status_code == 200, ar.text
            g2 = requests.get(f"{API}/trips/{trip_id}", headers=_hdr(user_token), timeout=10).json()
            assert g2["status"] == "arrived"
            assert g2.get("price", 0) > 0
        finally:
            DB.trips.update_one({"trip_id": trip_id}, {"$set": {"status": "cancelled"}})
            _cancel_driver_stale(driver_id)


# ---------- Regression: iter14/13/10 quickies ----------
class TestRegression:
    def test_places_still_work(self):
        r = requests.get(f"{API}/places?featured_only=true", timeout=10)
        assert r.status_code == 200
        assert len(r.json().get("places", [])) >= 3

    def test_payment_methods_verified_field(self, user_token):
        r = requests.get(f"{API}/payment-methods", headers=_hdr(user_token), timeout=10)
        assert r.status_code == 200
        for m in r.json():
            assert isinstance(m.get("verified"), bool)

    def test_superadmin_gate(self, user_token):
        r = requests.get(f"{API}/superadmin/fleet-applications", headers=_hdr(user_token), timeout=10)
        assert r.status_code == 403

    def test_fleet_overview(self, fleet_token):
        r = requests.get(f"{API}/fleet/overview", headers=_hdr(fleet_token), timeout=10)
        assert r.status_code == 200
        j = r.json()
        for k in ("drivers_total", "drivers_online", "today", "week", "commission_pct"):
            assert k in j
