"""Release regression coverage for KJAPP trip/payment hardening.

These tests are intentionally API-level. They use the same dev/test identities as the existing
backend regression suite and write isolated UUID-keyed records directly to Mongo for deterministic
state-machine checks.
"""
import os
import uuid

import pytest
import requests
from pymongo import MongoClient


BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "kjapp")]

USER = {"email": "ola@kjapp.no", "password": "test1234"}
DRIVER = {"email": "sjafor@kjapp.no", "password": "sjafor1234"}


def _login(credentials):
    response = requests.post(f"{API}/auth/login", json=credentials, timeout=15)
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def user_token():
    return _login(USER)


@pytest.fixture(scope="session")
def driver_token():
    return _login(DRIVER)


@pytest.fixture(scope="session")
def user_id(user_token):
    response = requests.get(f"{API}/auth/me", headers=_hdr(user_token), timeout=10)
    assert response.status_code == 200
    return response.json()["id"]


@pytest.fixture(scope="session")
def driver_id(driver_token):
    response = requests.get(f"{API}/auth/me", headers=_hdr(driver_token), timeout=10)
    assert response.status_code == 200
    return response.json()["id"]


def _trip(user_id, status, driver_id=None):
    trip_id = f"release-guard-{uuid.uuid4()}"
    doc = {
        "trip_id": trip_id,
        "user_id": user_id,
        "driver_id": driver_id,
        "driver_user_id": driver_id,
        "status": status,
        "pickup_address": "TEST_RELEASE Pickup",
        "dropoff_address": "TEST_RELEASE Dropoff",
        "pickup_lat": 59.9127,
        "pickup_lng": 10.7461,
        "dropoff_lat": 59.9106,
        "dropoff_lng": 10.7285,
        "distance_km": 2.0,
        "duration_min": 8,
        "price": 199,
        "created_at": "2026-09-14T20:00:00+00:00",
        "updated_at": "2026-09-14T20:00:00+00:00",
    }
    DB.trips.insert_one(doc)
    return trip_id


def _delete_trip(trip_id):
    DB.trips.delete_one({"trip_id": trip_id})
    DB.payment_transactions.delete_many({"trip_id": trip_id})


class TestPassengerStateGuards:
    def test_cancel_allowed_before_start(self, user_token, user_id):
        trip_id = _trip(user_id, "driver_on_way")
        try:
            response = requests.post(f"{API}/trips/{trip_id}/cancel", headers=_hdr(user_token), timeout=10)
            assert response.status_code == 200, response.text
            stored = DB.trips.find_one({"trip_id": trip_id})
            assert stored["status"] == "cancelled"
        finally:
            _delete_trip(trip_id)

    def test_cancel_rejected_after_start(self, user_token, user_id):
        trip_id = _trip(user_id, "in_trip")
        try:
            response = requests.post(f"{API}/trips/{trip_id}/cancel", headers=_hdr(user_token), timeout=10)
            assert response.status_code == 409, response.text
            assert DB.trips.find_one({"trip_id": trip_id})["status"] == "in_trip"
        finally:
            _delete_trip(trip_id)

    def test_complete_rejected_before_arrival(self, user_token, user_id):
        trip_id = _trip(user_id, "in_trip")
        try:
            response = requests.post(f"{API}/trips/{trip_id}/complete", headers=_hdr(user_token), timeout=10)
            assert response.status_code == 409, response.text
            assert DB.trips.find_one({"trip_id": trip_id})["status"] == "in_trip"
        finally:
            _delete_trip(trip_id)

    def test_complete_allowed_after_arrival_and_idempotent(self, user_token, user_id):
        trip_id = _trip(user_id, "arrived")
        try:
            first = requests.post(f"{API}/trips/{trip_id}/complete", headers=_hdr(user_token), timeout=10)
            assert first.status_code == 200, first.text
            assert DB.trips.find_one({"trip_id": trip_id})["status"] == "completed"
            second = requests.post(f"{API}/trips/{trip_id}/complete", headers=_hdr(user_token), timeout=10)
            assert second.status_code == 200, second.text
            assert second.json()["status"] == "completed"
        finally:
            _delete_trip(trip_id)

    def test_rating_rejected_while_trip_active(self, user_token, user_id):
        trip_id = _trip(user_id, "in_trip")
        try:
            response = requests.post(
                f"{API}/trips/{trip_id}/rate",
                json={"rating": 5, "feedback": "should not persist"},
                headers=_hdr(user_token),
                timeout=10,
            )
            assert response.status_code == 409, response.text
            stored = DB.trips.find_one({"trip_id": trip_id})
            assert stored["status"] == "in_trip"
            assert stored.get("passenger_rating") is None
        finally:
            _delete_trip(trip_id)


class TestDriverStateGuards:
    def test_driver_cannot_rate_passenger_before_finish(self, user_id, driver_token, driver_id):
        trip_id = _trip(user_id, "in_trip", driver_id=driver_id)
        try:
            response = requests.post(
                f"{API}/driver/trip/{trip_id}/rate-passenger",
                json={"rating": 5, "feedback": "too early"},
                headers=_hdr(driver_token),
                timeout=10,
            )
            assert response.status_code == 409, response.text
            assert DB.trips.find_one({"trip_id": trip_id}).get("driver_rating") is None
        finally:
            _delete_trip(trip_id)


class TestOwnershipGuards:
    def test_payment_status_requires_auth_and_owner(self, user_token, user_id):
        own_session = f"cs_test_owned_{uuid.uuid4().hex}"
        other_session = f"cs_test_other_{uuid.uuid4().hex}"
        DB.payment_transactions.insert_many([
            {
                "session_id": own_session,
                "trip_id": f"fake-{uuid.uuid4()}",
                "user_id": user_id,
                "status": "completed",
                "payment_status": "paid",
            },
            {
                "session_id": other_session,
                "trip_id": f"fake-{uuid.uuid4()}",
                "user_id": "somebody-else",
                "status": "completed",
                "payment_status": "paid",
            },
        ])
        try:
            unauth = requests.get(f"{API}/payments/status/{own_session}", timeout=10)
            assert unauth.status_code == 401, unauth.text
            own = requests.get(f"{API}/payments/status/{own_session}", headers=_hdr(user_token), timeout=10)
            assert own.status_code == 200, own.text
            other = requests.get(f"{API}/payments/status/{other_session}", headers=_hdr(user_token), timeout=10)
            assert other.status_code == 404, other.text
        finally:
            DB.payment_transactions.delete_many({"session_id": {"$in": [own_session, other_session]}})

    def test_mark_seen_rejects_unrelated_trip(self, user_token):
        trip_id = _trip("not-the-authenticated-user", "in_trip")
        try:
            response = requests.post(f"{API}/messages/mark-seen/{trip_id}", headers=_hdr(user_token), timeout=10)
            assert response.status_code == 403, response.text
            stored = DB.trips.find_one({"trip_id": trip_id})
            assert stored.get("passenger_last_seen_msg_at") is None
        finally:
            _delete_trip(trip_id)


class TestCheckoutIdempotency:
    def test_repeated_checkout_reuses_open_session(self, user_token, user_id):
        trip_id = _trip(user_id, "completed")
        try:
            first = requests.post(
                f"{API}/payments/checkout",
                json={"trip_id": trip_id, "origin_url": "https://example.com"},
                headers=_hdr(user_token),
                timeout=20,
            )
            if first.status_code == 500 and "Stripe er ikke konfigurert" in first.text:
                pytest.skip("Stripe sandbox is not configured in this environment")
            assert first.status_code == 200, first.text
            second = requests.post(
                f"{API}/payments/checkout",
                json={"trip_id": trip_id, "origin_url": "https://example.com"},
                headers=_hdr(user_token),
                timeout=20,
            )
            assert second.status_code == 200, second.text
            assert second.json()["session_id"] == first.json()["session_id"]
            assert second.json().get("reused") is True
            assert DB.payment_transactions.count_documents({"trip_id": trip_id, "payment_status": "pending"}) == 1
        finally:
            _delete_trip(trip_id)
