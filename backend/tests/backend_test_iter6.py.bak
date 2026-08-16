"""KJAPP backend tests — iteration 6 (beta readiness overhaul).

Covers:
- Auth (customer / driver / admin) with new user-record driver fields
- /api/cars/nearby empty vs populated (real drivers via GPS heartbeat)
- Trip lifecycle without asyncio simulator (stays "searching" until driver acts)
- Driver online/location/accept/start/arrive
- Stripe checkout + status
- AI guardrails (off-topic refusal, on-topic answered)
- GDPR export + delete (throwaway user)
- Admin invite flow with NEW schema {car, plate, vehicle_type, note, email}
- Regressions: places, estimate (route+polyline), trips list, active, rate, cancel,
  settings, payment-methods, push subscribe/vapid, trip messages chat
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@kjapp.no", "password": "admin123"}
USER = {"email": "ola@kjapp.no", "password": "test1234"}
DRIVER = {"email": "sjafor@kjapp.no", "password": "sjafor1234"}

PICKUP_LAT, PICKUP_LNG = 59.9127, 10.7461
DROPOFF_LAT, DROPOFF_LNG = 59.9110, 10.7530


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_token():
    return _login(**ADMIN)["token"]


@pytest.fixture(scope="session")
def user_token():
    return _login(**USER)["token"]


@pytest.fixture(scope="session")
def driver_token():
    return _login(**DRIVER)["token"]


def _book_trip(user_tok, vehicle_type="enkelt"):
    body = {
        "pickup_address": "TEST_Oslo Karl Johans",
        "pickup_lat": PICKUP_LAT, "pickup_lng": PICKUP_LNG,
        "dropoff_address": "TEST_Oslo S",
        "dropoff_lat": DROPOFF_LAT, "dropoff_lng": DROPOFF_LNG,
        "vehicle_type": vehicle_type,
    }
    r = requests.post(f"{API}/trips/request", json=body, headers=_headers(user_tok), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["trip_id"]


def _driver_online(driver_tok, lat=PICKUP_LAT, lng=PICKUP_LNG, online=True):
    r1 = requests.post(f"{API}/driver/online", json={"online": online},
                       headers=_headers(driver_tok), timeout=15)
    assert r1.status_code == 200, r1.text
    if online:
        r2 = requests.post(f"{API}/driver/location",
                           json={"lat": lat, "lng": lng, "heading": 0.0, "speed": 25.0},
                           headers=_headers(driver_tok), timeout=15)
        assert r2.status_code == 200, r2.text


# ============================================================
# Auth
# ============================================================
class TestAuth:
    def test_customer_login_returns_jwt_and_role(self):
        data = _login(**USER)
        assert data.get("token")
        assert data["user"]["role"] == "user"
        assert data["user"]["email"] == USER["email"]

    def test_driver_login_role_and_approved(self):
        data = _login(**DRIVER)
        assert data["user"]["role"] == "driver"
        # verify /me exposes car/plate/rating/approved from user record
        r = requests.get(f"{API}/auth/me", headers=_headers(data["token"]), timeout=15)
        assert r.status_code == 200
        me = r.json()
        assert me["role"] == "driver"
        assert me.get("approved") is True
        assert me.get("car") == "Tesla Model Y"
        assert me.get("plate") == "EL12345"
        assert isinstance(me.get("rating"), (int, float))

    def test_admin_login_role(self):
        data = _login(**ADMIN)
        assert data["user"]["role"] == "admin"


# ============================================================
# Driver online + location + cars/nearby
# ============================================================
class TestDriverPresenceAndNearby:
    def test_nearby_empty_when_no_drivers_online(self, driver_token):
        # Ensure our test driver is offline first
        _driver_online(driver_token, online=False)
        # Poll a couple of times to let last_location_at cutoff pass; but going offline is sufficient
        r = requests.post(f"{API}/cars/nearby",
                          json={"lat": PICKUP_LAT, "lng": PICKUP_LNG}, timeout=15)
        assert r.status_code == 200, r.text
        cars = r.json()["cars"]
        # Should not contain sjafor now
        emails_and_plates = [c.get("plate") for c in cars]
        assert "EL12345" not in emails_and_plates, f"Driver still listed after going offline: {cars}"

    def test_nearby_lists_driver_after_online_and_location_ping(self, driver_token):
        _driver_online(driver_token, lat=PICKUP_LAT + 0.001, lng=PICKUP_LNG + 0.001, online=True)
        r = requests.post(f"{API}/cars/nearby",
                          json={"lat": PICKUP_LAT, "lng": PICKUP_LNG}, timeout=15)
        assert r.status_code == 200, r.text
        cars = r.json()["cars"]
        match = next((c for c in cars if c.get("plate") == "EL12345"), None)
        assert match is not None, f"driver EL12345 missing from nearby: {cars}"
        assert match["car"] == "Tesla Model Y"
        assert match["eta_min"] >= 1
        assert 0 <= match["distance_km"] <= 10

    def test_driver_online_toggle_returns_state(self, driver_token):
        r = requests.post(f"{API}/driver/online", json={"online": True},
                          headers=_headers(driver_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["online"] is True
        r = requests.post(f"{API}/driver/online", json={"online": False},
                          headers=_headers(driver_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["online"] is False

    def test_driver_location_updates_user_record(self, driver_token):
        r = requests.post(f"{API}/driver/location",
                          json={"lat": 60.1, "lng": 11.2, "heading": 90.0, "speed": 40.0},
                          headers=_headers(driver_token), timeout=15)
        assert r.status_code == 200
        # Re-enable + ping to leave driver in known state
        _driver_online(driver_token)


# ============================================================
# Trip lifecycle — no more asyncio auto-progression
# ============================================================
class TestTripLifecycleNoSimulator:
    def test_trip_stays_searching_when_no_driver_acts(self, user_token, driver_token):
        # Make sure driver is offline so nothing accepts
        _driver_online(driver_token, online=False)
        trip_id = _book_trip(user_token)
        # Wait 5 seconds — old simulator would have moved to booking or beyond
        time.sleep(5)
        r = requests.get(f"{API}/trips/{trip_id}", headers=_headers(user_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "searching", f"expected searching, got {r.json()}"

    def test_driver_pending_shows_searching_trip(self, user_token, driver_token):
        _driver_online(driver_token)
        trip_id = _book_trip(user_token)
        r = requests.get(f"{API}/driver/pending", headers=_headers(driver_token), timeout=15)
        assert r.status_code == 200
        ids = [t["trip_id"] for t in r.json()["trips"]]
        assert trip_id in ids

    def test_full_driver_flow_accept_start_arrive(self, user_token, driver_token):
        _driver_online(driver_token)
        trip_id = _book_trip(user_token)

        # accept: searching -> driver_on_way
        r = requests.post(f"{API}/driver/accept", json={"trip_id": trip_id},
                          headers=_headers(driver_token), timeout=15)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "driver_on_way"
        # driver info populated from user record (not fake fleet)
        assert t["driver"]["car"] == "Tesla Model Y"
        assert t["driver"]["plate"] == "EL12345"
        assert t["driver"]["name"]
        assert t.get("driver_user_id")

        # start: driver_on_way -> in_trip
        r = requests.post(f"{API}/driver/trip/{trip_id}/start",
                          headers=_headers(driver_token), timeout=15)
        assert r.status_code == 200, r.text
        r = requests.get(f"{API}/trips/{trip_id}", headers=_headers(user_token), timeout=15)
        assert r.json()["status"] == "in_trip"

        # arrive: in_trip -> arrived
        r = requests.post(f"{API}/driver/trip/{trip_id}/arrive",
                          headers=_headers(driver_token), timeout=15)
        assert r.status_code == 200, r.text
        r = requests.get(f"{API}/trips/{trip_id}", headers=_headers(user_token), timeout=15)
        assert r.json()["status"] == "arrived"


# ============================================================
# Stripe payments
# ============================================================
class TestStripeCheckout:
    def _prepare_arrived_trip(self, user_tok, driver_tok):
        _driver_online(driver_tok)
        trip_id = _book_trip(user_tok)
        r = requests.post(f"{API}/driver/accept", json={"trip_id": trip_id},
                          headers=_headers(driver_tok), timeout=15)
        assert r.status_code == 200, r.text
        requests.post(f"{API}/driver/trip/{trip_id}/start",
                      headers=_headers(driver_tok), timeout=15)
        requests.post(f"{API}/driver/trip/{trip_id}/arrive",
                      headers=_headers(driver_tok), timeout=15)
        return trip_id

    def test_checkout_creates_session_and_transaction(self, user_token, driver_token):
        trip_id = self._prepare_arrived_trip(user_token, driver_token)
        r = requests.post(f"{API}/payments/checkout",
                          json={"trip_id": trip_id, "origin_url": "https://example.com"},
                          headers=_headers(user_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("checkout_url", "").startswith("https://")
        assert data.get("session_id", "").startswith("cs_")

        # Verify /payments/status/{session_id} returns pending
        s = requests.get(f"{API}/payments/status/{data['session_id']}", timeout=20)
        assert s.status_code == 200, s.text
        sdata = s.json()
        assert sdata["session_id"] == data["session_id"]
        assert sdata.get("trip_id") == trip_id
        # payment_status should be pending (or initiated) since no purchase was completed
        assert sdata.get("payment_status") in ("pending", "unpaid", "initiated")

    def test_checkout_rejects_when_trip_not_arrived(self, user_token, driver_token):
        _driver_online(driver_token, online=False)
        trip_id = _book_trip(user_token)  # will stay "searching"
        r = requests.post(f"{API}/payments/checkout",
                          json={"trip_id": trip_id, "origin_url": "https://example.com"},
                          headers=_headers(user_token), timeout=15)
        assert r.status_code == 400, r.text
        assert "ikke ferdig" in r.json().get("detail", "").lower()

    def test_status_unknown_session_404(self):
        r = requests.get(f"{API}/payments/status/cs_nonexistent_xyz", timeout=15)
        assert r.status_code == 404


# ============================================================
# AI guardrails
# ============================================================
class TestAIGuardrails:
    def test_offtopic_is_refused(self, user_token):
        r = requests.post(f"{API}/ai/chat",
                          json={"message": "Skriv python-kode som løser fibonacci"},
                          headers=_headers(user_token), timeout=60)
        assert r.status_code == 200, r.text
        reply = r.json().get("reply", "").lower()
        assert "kan jeg dessverre ikke hjelpe" in reply, f"expected refusal, got: {reply}"

    def test_ontopic_is_answered(self, user_token):
        r = requests.post(f"{API}/ai/chat",
                          json={"message": "Hva koster en tur fra Oslo S til Aker Brygge?"},
                          headers=_headers(user_token), timeout=60)
        assert r.status_code == 200, r.text
        reply = r.json().get("reply", "").lower()
        # should NOT contain refusal
        assert "kan jeg dessverre ikke hjelpe" not in reply, f"on-topic wrongly refused: {reply}"
        assert len(reply) > 5


# ============================================================
# GDPR
# ============================================================
class TestGDPR:
    def test_export_returns_all_arrays(self, user_token):
        r = requests.get(f"{API}/gdpr/export", headers=_headers(user_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("exported_at", "user", "trips", "ai_messages", "payments"):
            assert k in data, f"missing key {k}"
        assert isinstance(data["trips"], list)
        assert isinstance(data["ai_messages"], list)
        assert isinstance(data["payments"], list)
        # user should not contain password_hash
        assert "password_hash" not in (data["user"] or {})

    def test_delete_wipes_throwaway_user(self):
        email = f"TEST_gdpr_{uuid.uuid4().hex[:8]}@kjapp.no"
        rr = requests.post(f"{API}/auth/register",
                           json={"email": email, "password": "test1234",
                                 "fullName": "TEST_GDPR", "phone": "+4790000000"},
                           timeout=15)
        assert rr.status_code == 200, rr.text
        tok = rr.json()["token"]

        # Create a trip so we can verify anonymization
        trip_id = _book_trip(tok)

        r = requests.delete(f"{API}/gdpr/delete", headers=_headers(tok), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["deleted"] is True
        assert body["anonymized_trip_owner"].startswith("deleted_")

        # Login should now fail
        rlog = requests.post(f"{API}/auth/login",
                             json={"email": email, "password": "test1234"}, timeout=15)
        assert rlog.status_code == 401

    def test_admin_delete_rejected(self, admin_token):
        r = requests.delete(f"{API}/gdpr/delete", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 400


# ============================================================
# Driver invite — NEW schema
# ============================================================
class TestDriverInvitesNewSchema:
    def test_invite_lifecycle(self, admin_token):
        r = requests.post(f"{API}/admin/driver-invites",
                          headers=_headers(admin_token),
                          json={"car": "Kia EV6", "plate": "EL99999",
                                "vehicle_type": "enkelt", "note": "TEST iter6"},
                          timeout=15)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["car"] == "Kia EV6"
        assert inv["plate"] == "EL99999"
        assert inv["vehicle_type"] == "enkelt"
        assert inv["used"] is False
        token = inv["token"]

        # Public GET
        r = requests.get(f"{API}/driver-invites/{token}", timeout=15)
        assert r.status_code == 200
        info = r.json()
        assert info["car"] == "Kia EV6"
        assert info["plate"] == "EL99999"

        # Accept
        email = f"TEST_drv_{uuid.uuid4().hex[:8]}@kjapp.no"
        r = requests.post(f"{API}/driver-invites/accept", json={
            "token": token,
            "fullName": "TEST Driver iter6",
            "email": email,
            "phone": "+4790000123",
            "password": "drv12345",
        }, timeout=15)
        assert r.status_code == 200, r.text
        payload = r.json()
        assert payload["user"]["role"] == "driver"
        assert payload["user"]["approved"] is False

        # /me on new driver — car/plate/rating populated on user record
        r = requests.get(f"{API}/auth/me", headers=_headers(payload["token"]), timeout=15)
        assert r.status_code == 200
        me = r.json()
        assert me.get("car") == "Kia EV6"
        assert me.get("plate") == "EL99999"
        assert me.get("vehicle_type") == "enkelt"
        assert me.get("rating") == 5.0
        assert me.get("approved") is False

        # Pending trips should 403
        r = requests.get(f"{API}/driver/pending", headers=_headers(payload["token"]), timeout=15)
        assert r.status_code == 403

    def test_invalid_token_404(self):
        r = requests.get(f"{API}/driver-invites/nonexistent_token_xyz", timeout=15)
        assert r.status_code == 404


# ============================================================
# Regressions
# ============================================================
class TestRegressions:
    def test_places(self):
        r = requests.get(f"{API}/places", timeout=15)
        assert r.status_code == 200
        pl = r.json()["places"]
        assert len(pl) > 0

    def test_estimate_route_and_polyline(self):
        r = requests.post(f"{API}/trips/estimate",
                          json={"pickup_lat": PICKUP_LAT, "pickup_lng": PICKUP_LNG,
                                "dropoff_lat": DROPOFF_LAT, "dropoff_lng": DROPOFF_LNG},
                          timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert len(data["options"]) == 4
        assert data["duration_min"] > 0
        assert data["distance_km"] > 0
        # OSRM geometry should be present (GeoJSON dict with coordinates list)
        assert data.get("geometry") is not None, "OSRM route geometry missing"
        assert isinstance(data["geometry"], dict) and data["geometry"].get("coordinates")

    def test_active_and_list_trips(self, user_token):
        r = requests.get(f"{API}/trips", headers=_headers(user_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = requests.get(f"{API}/trips/active", headers=_headers(user_token), timeout=15)
        assert r2.status_code == 200  # may return None body if no active

    def test_rate_and_cancel(self, user_token, driver_token):
        _driver_online(driver_token, online=False)
        trip_id = _book_trip(user_token)  # searching
        r = requests.post(f"{API}/trips/{trip_id}/rate",
                          json={"rating": 5, "feedback": "TEST"},
                          headers=_headers(user_token), timeout=15)
        assert r.status_code == 200

        trip_id2 = _book_trip(user_token)
        r = requests.post(f"{API}/trips/{trip_id2}/cancel",
                          headers=_headers(user_token), timeout=15)
        assert r.status_code == 200

    def test_settings_get(self, user_token):
        r = requests.get(f"{API}/settings", headers=_headers(user_token), timeout=15)
        assert r.status_code == 200

    def test_payment_methods_list(self, user_token):
        r = requests.get(f"{API}/payment-methods", headers=_headers(user_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_vapid_public_key(self):
        r = requests.get(f"{API}/push/vapid-public-key", timeout=15)
        assert r.status_code == 200
        # returns {"publicKey": "..."} or {"public_key": "..."}
        body = r.json()
        assert any(k in body for k in ("publicKey", "public_key", "key"))

    def test_push_subscribe(self, user_token):
        fake_sub = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/TEST_endpoint",
            "keys": {"p256dh": "TEST_p256dh_key", "auth": "TEST_auth"},
        }
        r = requests.post(f"{API}/push/subscribe",
                          json={"subscription": fake_sub},
                          headers=_headers(user_token), timeout=15)
        assert r.status_code == 200, r.text

    def test_trip_messages_chat(self, user_token, driver_token):
        _driver_online(driver_token)
        trip_id = _book_trip(user_token)
        r = requests.post(f"{API}/driver/accept", json={"trip_id": trip_id},
                          headers=_headers(driver_token), timeout=15)
        assert r.status_code == 200

        # Passenger sends
        r1 = requests.post(f"{API}/trips/{trip_id}/messages",
                           json={"text": "Hei, jeg står ved inngangen"},
                           headers=_headers(user_token), timeout=15)
        assert r1.status_code == 200, r1.text
        # Driver replies
        r2 = requests.post(f"{API}/trips/{trip_id}/messages",
                           json={"text": "Kommer om 2 min"},
                           headers=_headers(driver_token), timeout=15)
        assert r2.status_code == 200, r2.text

        rl = requests.get(f"{API}/trips/{trip_id}/messages",
                          headers=_headers(user_token), timeout=15)
        assert rl.status_code == 200
        msgs = rl.json()["messages"]
        assert len(msgs) >= 2
        roles = [m["from_role"] for m in msgs]
        assert "passenger" in roles and "driver" in roles
