"""Backend tests for KJAPP taxi PWA - iteration 2 (driver + push + OSRM)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # fallback: read frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1]
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

PASSENGER = {"email": "ola@kjapp.no", "password": "test1234"}
DRIVER = {"email": "sjafor@kjapp.no", "password": "sjafor1234"}

# Oslo coords
PICKUP = {"lat": 59.9127, "lng": 10.7461, "addr": "Karl Johans gate 1"}
DROPOFF = {"lat": 59.9106, "lng": 10.7285, "addr": "Aker Brygge"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def passenger_token():
    return _login(PASSENGER)["token"]


@pytest.fixture(scope="module")
def driver_login():
    return _login(DRIVER)


@pytest.fixture(scope="module")
def driver_token(driver_login):
    return driver_login["token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- Auth / roles ----------------
def test_driver_login_has_role_and_driver_id(driver_login):
    u = driver_login["user"]
    assert u["role"] == "driver"
    assert u["driver_id"] == "car-1"


def test_driver_pending_forbids_regular_user(passenger_token):
    r = requests.get(f"{API}/driver/pending", headers=auth(passenger_token), timeout=15)
    assert r.status_code == 403


def test_driver_pending_allows_driver(driver_token):
    r = requests.get(f"{API}/driver/pending", headers=auth(driver_token), timeout=15)
    assert r.status_code == 200
    assert "trips" in r.json()


# ---------------- Estimate + OSRM ----------------
def test_trip_estimate_returns_options_and_maybe_geometry():
    r = requests.post(f"{API}/trips/estimate", json={
        "pickup_lat": PICKUP["lat"], "pickup_lng": PICKUP["lng"],
        "dropoff_lat": DROPOFF["lat"], "dropoff_lng": DROPOFF["lng"],
    }, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["distance_km"], (int, float)) and data["distance_km"] > 0
    assert isinstance(data["duration_min"], int) and data["duration_min"] >= 1
    assert len(data["options"]) == 4
    vts = {o["vehicle_type"] for o in data["options"]}
    assert vts == {"ai-first", "enkelt", "trygg", "premium"}
    geom = data.get("geometry")
    if geom is not None:
        # GeoJSON LineString
        assert geom.get("type") == "LineString"
        coords = geom.get("coordinates", [])
        assert len(coords) > 2, f"geometry coords too few: {len(coords)}"
    else:
        print("OSRM unreachable - geometry is null (acceptable fallback)")


# ---------------- Trip request stores geometry ----------------
def test_trip_request_stores_geometry(passenger_token):
    body = {
        "pickup_address": PICKUP["addr"],
        "pickup_lat": PICKUP["lat"], "pickup_lng": PICKUP["lng"],
        "dropoff_address": DROPOFF["addr"],
        "dropoff_lat": DROPOFF["lat"], "dropoff_lng": DROPOFF["lng"],
        "vehicle_type": "ai-first",
    }
    r = requests.post(f"{API}/trips/request", json=body, headers=auth(passenger_token), timeout=20)
    assert r.status_code == 200, r.text
    trip = r.json()
    assert "geometry" in trip  # may be None if OSRM failed
    if trip["geometry"] is not None:
        assert trip["geometry"]["type"] == "LineString"
    # cleanup: cancel
    requests.post(f"{API}/trips/{trip['trip_id']}/cancel", headers=auth(passenger_token), timeout=10)


# ---------------- Full driver flow ----------------
def test_full_driver_flow(passenger_token, driver_token):
    body = {
        "pickup_address": PICKUP["addr"],
        "pickup_lat": PICKUP["lat"], "pickup_lng": PICKUP["lng"],
        "dropoff_address": DROPOFF["addr"],
        "dropoff_lat": DROPOFF["lat"], "dropoff_lng": DROPOFF["lng"],
        "vehicle_type": "ai-first",
    }
    r = requests.post(f"{API}/trips/request", json=body, headers=auth(passenger_token), timeout=20)
    assert r.status_code == 200
    trip_id = r.json()["trip_id"]

    # wait ~4s for status -> booking
    found = False
    for _ in range(8):
        time.sleep(1)
        rp = requests.get(f"{API}/driver/pending", headers=auth(driver_token), timeout=10)
        assert rp.status_code == 200
        ids = [t["trip_id"] for t in rp.json()["trips"]]
        if trip_id in ids:
            found = True
            break
    assert found, f"trip {trip_id} not in pending within 8s"

    # accept
    ra = requests.post(f"{API}/driver/accept", json={"trip_id": trip_id}, headers=auth(driver_token), timeout=15)
    assert ra.status_code == 200, ra.text
    accepted = ra.json()
    assert accepted["status"] == "driver_on_way"
    assert accepted["driver_id"] == "car-1"
    assert accepted.get("driver", {}).get("name")

    # driver/current shows this trip
    rc = requests.get(f"{API}/driver/current", headers=auth(driver_token), timeout=10)
    assert rc.status_code == 200
    cur = rc.json()
    assert cur is not None and cur["trip_id"] == trip_id

    # start
    rs = requests.post(f"{API}/driver/trip/{trip_id}/start", headers=auth(driver_token), timeout=10)
    assert rs.status_code == 200, rs.text

    # verify status via passenger get trip
    rt = requests.get(f"{API}/trips/{trip_id}", headers=auth(passenger_token), timeout=10)
    assert rt.status_code == 200
    assert rt.json()["status"] == "in_trip"

    # arrive
    rar = requests.post(f"{API}/driver/trip/{trip_id}/arrive", headers=auth(driver_token), timeout=10)
    assert rar.status_code == 200, rar.text

    rt2 = requests.get(f"{API}/trips/{trip_id}", headers=auth(passenger_token), timeout=10)
    assert rt2.json()["status"] == "arrived"


# ---------------- Auto-assign fallback (~12s) ----------------
def test_auto_assign_fallback(passenger_token):
    """Passenger creates trip; no driver accepts. Expect status=driver_on_way within ~20s."""
    body = {
        "pickup_address": PICKUP["addr"],
        "pickup_lat": PICKUP["lat"], "pickup_lng": PICKUP["lng"],
        "dropoff_address": DROPOFF["addr"],
        "dropoff_lat": DROPOFF["lat"], "dropoff_lng": DROPOFF["lng"],
        "vehicle_type": "enkelt",
    }
    r = requests.post(f"{API}/trips/request", json=body, headers=auth(passenger_token), timeout=20)
    assert r.status_code == 200
    trip_id = r.json()["trip_id"]

    status = None
    for _ in range(25):
        time.sleep(1)
        rt = requests.get(f"{API}/trips/{trip_id}", headers=auth(passenger_token), timeout=10)
        if rt.status_code == 200:
            status = rt.json()["status"]
            if status == "driver_on_way":
                break
    assert status == "driver_on_way", f"final status: {status}"
    # cleanup
    requests.post(f"{API}/trips/{trip_id}/cancel", headers=auth(passenger_token), timeout=10)


# ---------------- Driver summary ----------------
def test_driver_summary_today(driver_token):
    r = requests.get(f"{API}/driver/summary/today", headers=auth(driver_token), timeout=10)
    assert r.status_code == 200
    data = r.json()
    for k in ("income", "trips", "satisfaction"):
        assert k in data
    assert isinstance(data["trips"], int)
    assert isinstance(data["income"], (int, float))


# ---------------- Push ----------------
def test_vapid_public_key():
    r = requests.get(f"{API}/push/vapid-public-key", timeout=10)
    assert r.status_code == 200
    key = r.json().get("public_key")
    assert key and isinstance(key, str)
    # base64url uncompressed EC P-256 pub key = 65 bytes -> 87 chars (unpadded b64url)
    assert 80 <= len(key) <= 90, f"unexpected key length: {len(key)}"


def test_push_subscribe_and_test(passenger_token):
    fake_sub = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/FAKE_ENDPOINT_TEST",
        "keys": {"p256dh": "BFAKEp256dhKEYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "auth": "FAKEauthKEYxxxxxxxxxxxx"},
    }
    r = requests.post(f"{API}/push/subscribe", json={"subscription": fake_sub}, headers=auth(passenger_token), timeout=10)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    # push/test should not crash even with fake sub
    rt = requests.post(f"{API}/push/test", headers=auth(passenger_token), timeout=15)
    assert rt.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
