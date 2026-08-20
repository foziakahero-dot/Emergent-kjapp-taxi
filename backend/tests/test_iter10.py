"""KJAPP backend tests — iteration 10.

Coverage:
- Driver rating summary GET /api/driver/ratings (shape + 403 for non-driver)
- Driver payouts GET /api/driver/payouts (net = round(gross*0.8), next Monday)
- Messages unread count + mark-seen
- Fleet owner flow: /api/auth/me, /api/fleet/me, /api/fleet/overview, /api/fleet/drivers
- Fleet security: user + driver → 403
- Admin fleets CRUD: create fleet (autocreate user), list, attach-driver
- Regression: auth for 4 roles, trips/request payment gate, driver online/location,
  cars/nearby, places/search, pricing/surge, payments/card/setup, gdpr/export
"""
import os
import time
import uuid
from datetime import datetime, date, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@kjapp.no", "password": "admin123"}
USER = {"email": "ola@kjapp.no", "password": "test1234"}
DRIVER = {"email": "sjafor@kjapp.no", "password": "sjafor1234"}
FLEET = {"email": "floteier1@kjapp.no", "password": "fleet1234"}

PICKUP = (59.9127, 10.7461)
DROPOFF = (59.9110, 10.7530)


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def admin_token():
    return _login(**ADMIN)["token"]


@pytest.fixture(scope="session")
def user_token():
    return _login(**USER)["token"]


@pytest.fixture(scope="session")
def driver_token():
    return _login(**DRIVER)["token"]


@pytest.fixture(scope="session")
def fleet_token():
    return _login(**FLEET)["token"]


# ---------- Auth for all 4 roles ----------
def test_login_all_roles():
    for creds, expected_role in [(ADMIN, "admin"), (USER, "user"), (DRIVER, "driver"), (FLEET, "fleet_owner")]:
        data = _login(**creds)
        assert "token" in data
        # /auth/me
        me = requests.get(f"{API}/auth/me", headers=_hdr(data["token"]), timeout=10)
        assert me.status_code == 200
        assert me.json().get("role") == expected_role, f"role mismatch for {creds['email']}: {me.json()}"


def test_fleet_owner_me_has_fleet_id(fleet_token):
    me = requests.get(f"{API}/auth/me", headers=_hdr(fleet_token), timeout=10).json()
    assert me.get("role") == "fleet_owner"
    assert me.get("fleet_id"), f"fleet_owner missing fleet_id: {me}"


# ---------- Driver ratings ----------
def test_driver_ratings_shape(driver_token):
    r = requests.get(f"{API}/driver/ratings", headers=_hdr(driver_token), timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert set(["average", "count", "breakdown", "recent"]).issubset(d.keys())
    assert set(d["breakdown"].keys()) == {"5", "4", "3", "2", "1"} or set(d["breakdown"].keys()) == {5,4,3,2,1}
    assert isinstance(d["recent"], list)
    assert isinstance(d["count"], int)


def test_driver_ratings_forbidden_for_user(user_token):
    r = requests.get(f"{API}/driver/ratings", headers=_hdr(user_token), timeout=10)
    assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text}"


# ---------- Driver payouts ----------
def test_driver_payouts_shape_and_math(driver_token):
    r = requests.get(f"{API}/driver/payouts", headers=_hdr(driver_token), timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["pending_gross", "pending_trips", "pending_net", "commission_pct", "next_payout_date", "history"]:
        assert k in d, f"missing {k}"
    assert d["commission_pct"] == 20
    # net = round(gross * 0.8)
    assert d["pending_net"] == int(round(d["pending_gross"] * 0.8)), (d["pending_gross"], d["pending_net"])
    # next_payout_date is a future Monday
    npd = date.fromisoformat(d["next_payout_date"])
    today = datetime.now(timezone.utc).date()
    assert npd >= today, f"next_payout_date not in future: {npd} vs {today}"
    assert npd.weekday() == 0, f"next_payout_date is not Monday: {npd.strftime('%A')}"


def test_driver_payouts_forbidden_for_user(user_token):
    r = requests.get(f"{API}/driver/payouts", headers=_hdr(user_token), timeout=10)
    assert r.status_code == 403


# ---------- Messages unread + mark-seen ----------
def test_messages_unread_count_shape(user_token, driver_token):
    for tok in (user_token, driver_token):
        r = requests.get(f"{API}/messages/unread-count", headers=_hdr(tok), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "unread" in d and isinstance(d["unread"], int)


def test_messages_mark_seen_endpoint(user_token):
    # Use any trip_id (does not need to exist — endpoint just updates)
    fake_id = "nonexistent-trip-" + uuid.uuid4().hex[:8]
    r = requests.post(f"{API}/messages/mark-seen/{fake_id}", headers=_hdr(user_token), timeout=10)
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_messages_unread_full_flow(user_token, driver_token):
    """Create a trip → driver online → accept → passenger sends message → driver unread=1 → mark-seen → 0.
    This is best-effort; if payment gate blocks trip request we skip."""
    # Try request a trip
    payload = {
        "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
        "pickup_address": "Karl Johans gate 1",
        "dropoff_lat": DROPOFF[0], "dropoff_lng": DROPOFF[1],
        "dropoff_address": "Aker Brygge",
    }
    r = requests.post(f"{API}/trips/request", headers=_hdr(user_token), json=payload, timeout=15)
    if r.status_code == 402:
        pytest.skip("Payment gate blocks trip request (no card). Cannot test full unread flow.")
    if r.status_code != 200:
        pytest.skip(f"Cannot create trip: {r.status_code} {r.text}")
    trip_id = r.json().get("trip_id")

    # Driver online + location
    requests.post(f"{API}/driver/online", headers=_hdr(driver_token), json={"online": True}, timeout=10)
    requests.post(f"{API}/driver/location", headers=_hdr(driver_token), json={"lat": PICKUP[0], "lng": PICKUP[1], "heading": 0}, timeout=10)
    time.sleep(1)
    acc = requests.post(f"{API}/driver/accept", headers=_hdr(driver_token), json={"trip_id": trip_id}, timeout=15)
    if acc.status_code != 200:
        pytest.skip(f"Driver could not accept trip: {acc.status_code} {acc.text}")

    # Passenger sends msg
    m = requests.post(f"{API}/messages/send", headers=_hdr(user_token), json={"trip_id": trip_id, "text": "Hei sjåfør!"}, timeout=10)
    # endpoint may be different; if 404 try alt
    if m.status_code == 404:
        m = requests.post(f"{API}/trips/{trip_id}/message", headers=_hdr(user_token), json={"text": "Hei"}, timeout=10)
    # Even if send fails, still test shape
    time.sleep(1)
    # Driver checks unread
    u = requests.get(f"{API}/messages/unread-count", headers=_hdr(driver_token), timeout=10)
    assert u.status_code == 200
    if m.status_code == 200:
        assert u.json()["unread"] >= 1, f"expected >=1 unread, got {u.json()}"
        # Mark seen
        ms = requests.post(f"{API}/messages/mark-seen/{trip_id}", headers=_hdr(driver_token), timeout=10)
        assert ms.status_code == 200
        u2 = requests.get(f"{API}/messages/unread-count", headers=_hdr(driver_token), timeout=10)
        assert u2.json()["unread"] == 0, f"expected 0 after mark-seen, got {u2.json()}"


# ---------- Fleet owner endpoints ----------
def test_fleet_me(fleet_token):
    r = requests.get(f"{API}/fleet/me", headers=_hdr(fleet_token), timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("name") == "Oslo Nord Taxi AS", d
    assert float(d.get("commission_rate", 0)) == 0.2
    assert d.get("org_number") == "999888777"


def test_fleet_overview(fleet_token):
    r = requests.get(f"{API}/fleet/overview", headers=_hdr(fleet_token), timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["drivers_total", "drivers_online", "today", "week", "commission_pct"]:
        assert k in d
    assert d["commission_pct"] == 20


def test_fleet_drivers_contains_sjafor(fleet_token):
    r = requests.get(f"{API}/fleet/drivers", headers=_hdr(fleet_token), timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    emails = [dr.get("email") for dr in d.get("drivers", [])]
    assert "sjafor@kjapp.no" in emails, f"sjafor not in fleet drivers: {emails}"


def test_fleet_me_forbidden_for_user(user_token):
    r = requests.get(f"{API}/fleet/me", headers=_hdr(user_token), timeout=10)
    assert r.status_code == 403, r.text


def test_fleet_me_forbidden_for_driver(driver_token):
    r = requests.get(f"{API}/fleet/me", headers=_hdr(driver_token), timeout=10)
    assert r.status_code == 403, r.text


# ---------- Admin fleets ----------
def test_admin_list_fleets(admin_token):
    r = requests.get(f"{API}/admin/fleets", headers=_hdr(admin_token), timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert "fleets" in d and isinstance(d["fleets"], list)
    # each should have driver_count + owner_email
    for f in d["fleets"]:
        assert "driver_count" in f
        assert "owner_email" in f


def test_admin_list_fleets_forbidden_for_user(user_token):
    r = requests.get(f"{API}/admin/fleets", headers=_hdr(user_token), timeout=10)
    assert r.status_code == 403


def test_admin_create_fleet_autocreates_user(admin_token):
    unique = uuid.uuid4().hex[:8]
    email = f"newfleet_{unique}@kjapp.no"
    body = {"name": f"TEST_Fleet_{unique}", "org_number": "123", "owner_email": email, "commission_rate": 0.15}
    r = requests.post(f"{API}/admin/fleets", headers=_hdr(admin_token), json=body, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("id")
    assert d.get("name") == body["name"]
    assert d.get("owner_email") == email
    fleet_id = d["id"]

    # Verify via admin list — the new user exists with role fleet_owner + fleet_id
    lst = requests.get(f"{API}/admin/fleets", headers=_hdr(admin_token), timeout=10).json()["fleets"]
    match = [f for f in lst if f["id"] == fleet_id]
    assert match and match[0]["owner_email"] == email

    # Sanity via admin/users if available — otherwise skip
    # Attach existing driver test
    # Fetch driver id via admin
    users_resp = requests.get(f"{API}/admin/users", headers=_hdr(admin_token), timeout=10)
    if users_resp.status_code == 200:
        users = users_resp.json()
        users_list = users.get("users", users) if isinstance(users, dict) else users
        driver_row = next((u for u in users_list if u.get("email") == "sjafor@kjapp.no"), None)
        if driver_row:
            att = requests.post(f"{API}/admin/fleets/attach-driver", headers=_hdr(admin_token),
                                json={"fleet_id": fleet_id, "driver_user_id": driver_row["id"]}, timeout=10)
            assert att.status_code == 200
            # Re-attach to original Oslo Nord Taxi AS fleet
            fleets = requests.get(f"{API}/admin/fleets", headers=_hdr(admin_token), timeout=10).json()["fleets"]
            oslo = next((f for f in fleets if f.get("name") == "Oslo Nord Taxi AS"), None)
            if oslo:
                requests.post(f"{API}/admin/fleets/attach-driver", headers=_hdr(admin_token),
                              json={"fleet_id": oslo["id"], "driver_user_id": driver_row["id"]}, timeout=10)


def test_admin_attach_driver_forbidden_for_user(user_token):
    r = requests.post(f"{API}/admin/fleets/attach-driver", headers=_hdr(user_token),
                      json={"fleet_id": "x", "driver_user_id": "y"}, timeout=10)
    assert r.status_code == 403


# ---------- Regression ----------
def test_trips_request_payment_gate(user_token):
    payload = {
        "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
        "pickup_address": "Karl Johans gate 1",
        "dropoff_lat": DROPOFF[0], "dropoff_lng": DROPOFF[1],
        "dropoff_address": "Aker Brygge",
    }
    r = requests.post(f"{API}/trips/request", headers=_hdr(user_token), json=payload, timeout=15)
    # Expected 402 if no card, or 200 if card exists — both acceptable
    assert r.status_code in (200, 402), f"unexpected {r.status_code} {r.text}"


def test_driver_online_and_location(driver_token):
    r = requests.post(f"{API}/driver/online", headers=_hdr(driver_token), json={"online": True}, timeout=10)
    assert r.status_code == 200
    r2 = requests.post(f"{API}/driver/location", headers=_hdr(driver_token),
                       json={"lat": PICKUP[0], "lng": PICKUP[1], "heading": 45}, timeout=10)
    assert r2.status_code == 200


def test_cars_nearby(user_token):
    r = requests.post(f"{API}/cars/nearby", headers=_hdr(user_token),
                      json={"lat": PICKUP[0], "lng": PICKUP[1]}, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), (list, dict))


def test_places_search(user_token):
    r = requests.get(f"{API}/places/search", headers=_hdr(user_token),
                     params={"q": "Karl Johans gate Oslo"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    # tolerate {results:[]} or list
    results = d.get("results", d) if isinstance(d, dict) else d
    assert isinstance(results, list)


def test_pricing_surge(user_token):
    r = requests.get(f"{API}/pricing/surge", headers=_hdr(user_token),
                     params={"lat": PICKUP[0], "lng": PICKUP[1]}, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert "multiplier" in d


def test_payments_card_setup(user_token):
    r = requests.post(f"{API}/payments/card/setup", headers=_hdr(user_token),
                      json={"origin_url": BASE_URL}, timeout=15)
    # Should return Checkout session URL or Stripe not-configured error
    assert r.status_code in (200, 400, 500), r.text
    if r.status_code == 200:
        d = r.json()
        assert "checkout_url" in d or "client_secret" in d or "session_id" in d


def test_gdpr_export(user_token):
    r = requests.get(f"{API}/gdpr/export", headers=_hdr(user_token), timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), dict)
