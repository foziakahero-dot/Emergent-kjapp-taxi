"""Iter 35 — Demand heatmap + Push infrastructure tests."""
import os
import time
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://mobile-forge-1487.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

DRIVER = {"email": "sjafor@kjapp.no", "password": "sjafor1234"}
CUSTOMER = {"email": "ola@kjapp.no", "password": "test1234"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    j = r.json()
    return j.get("token") or j.get("access_token")


@pytest.fixture(scope="module")
def driver_token():
    return _login(DRIVER)


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER)


# ---------- Auth on /driver/demand ----------
def test_demand_requires_auth():
    r = requests.get(f"{API}/driver/demand", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


def test_demand_forbidden_for_customer(customer_token):
    r = requests.get(f"{API}/driver/demand", headers={"Authorization": f"Bearer {customer_token}"}, timeout=15)
    assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"


# ---------- Demand shape ----------
def test_demand_returns_expected_shape(driver_token):
    r = requests.get(
        f"{API}/driver/demand?lat=59.9139&lng=10.7522",
        headers={"Authorization": f"Bearer {driver_token}"}, timeout=30,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("cells", "zones", "total_recent", "total_typical", "drivers_online", "window_minutes"):
        assert k in d, f"missing {k}"
    assert d["window_minutes"] == 90
    assert isinstance(d["cells"], list)
    assert isinstance(d["zones"], list)
    for c in d["cells"]:
        assert 0.0 <= c["weight"] <= 1.0
    for z in d["zones"]:
        # distance_km must be present since lat/lng were supplied
        assert "distance_km" in z
        # No TEST_/demo labels
        if z.get("label"):
            assert "TEST_" not in z["label"]
            assert "demo" not in z["label"].lower()


def test_demand_no_test_data_in_cells(driver_token):
    r = requests.get(f"{API}/driver/demand", headers={"Authorization": f"Bearer {driver_token}"}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    # Ensure cells reference valid coords
    for c in d["cells"]:
        assert -90 < c["lat"] < 90
        assert -180 < c["lng"] < 180


# ---------- Demand consistency with new trip ----------
def _ensure_verified_pm(token):
    """Make sure the customer has a verified payment method (idempotent)."""
    h = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{API}/payment-methods", headers=h, timeout=15)
    if r.status_code == 200 and r.json():
        for pm in r.json():
            if pm.get("verified", True):
                return
    # Try to add one via test endpoint (best-effort)
    requests.post(f"{API}/payment-methods/dev-add-verified", headers=h, timeout=15)


def test_total_recent_increases_after_new_trip(driver_token, customer_token):
    hdrs_d = {"Authorization": f"Bearer {driver_token}"}
    before = requests.get(f"{API}/driver/demand", headers=hdrs_d, timeout=30).json()
    before_recent = before["total_recent"]

    _ensure_verified_pm(customer_token)
    hdrs_c = {"Authorization": f"Bearer {customer_token}"}
    payload = {
        "pickup_address": "Bogstadveien 1, Oslo",
        "pickup_lat": 59.9276, "pickup_lng": 10.7137,
        "dropoff_address": "Torggata 10, Oslo",
        "dropoff_lat": 59.9169, "dropoff_lng": 10.7508,
        "vehicle_type": "enkelt",
    }
    r = requests.post(f"{API}/trips/request", json=payload, headers=hdrs_c, timeout=45)
    if r.status_code == 402:
        pytest.skip(f"customer has no verified payment method: {r.text}")
    assert r.status_code == 200, r.text
    trip = r.json()
    trip_id = trip.get("trip_id")

    # Give backend a moment
    time.sleep(1)
    after = requests.get(f"{API}/driver/demand", headers=hdrs_d, timeout=30).json()
    assert after["total_recent"] >= before_recent + 1, (before_recent, after["total_recent"])

    # Cleanup — cancel the trip
    if trip_id:
        requests.post(f"{API}/trips/{trip_id}/cancel", headers=hdrs_c, timeout=15)


# ---------- Push infra ----------
def test_vapid_public_key(driver_token):
    r = requests.get(f"{API}/push/vapid-public-key", headers={"Authorization": f"Bearer {driver_token}"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "public_key" in d
    if d["public_key"] is not None:
        assert isinstance(d["public_key"], str) and len(d["public_key"]) > 10


def test_push_subscribe_dummy(driver_token):
    sub = {
        "subscription": {
            "endpoint": "https://fcm.googleapis.com/fcm/send/dummy-iter35-test",
            "keys": {"p256dh": "BNc" + "A" * 80, "auth": "AAAA" + "B" * 20},
        }
    }
    r = requests.post(
        f"{API}/push/subscribe", json=sub,
        headers={"Authorization": f"Bearer {driver_token}"}, timeout=15,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True


def test_trip_request_succeeds_even_with_bad_push_sub(customer_token, driver_token):
    """After a dummy sub is stored, a customer trip request must still return 200."""
    _ensure_verified_pm(customer_token)
    hdrs_c = {"Authorization": f"Bearer {customer_token}"}
    payload = {
        "pickup_address": "Bogstadveien 5, Oslo",
        "pickup_lat": 59.9278, "pickup_lng": 10.7132,
        "dropoff_address": "Karl Johans gate 1, Oslo",
        "dropoff_lat": 59.9111, "dropoff_lng": 10.7501,
        "vehicle_type": "enkelt",
    }
    r = requests.post(f"{API}/trips/request", json=payload, headers=hdrs_c, timeout=45)
    if r.status_code == 402:
        pytest.skip("no verified PM")
    assert r.status_code == 200, r.text
    tid = r.json().get("trip_id")
    if tid:
        requests.post(f"{API}/trips/{tid}/cancel", headers=hdrs_c, timeout=15)
