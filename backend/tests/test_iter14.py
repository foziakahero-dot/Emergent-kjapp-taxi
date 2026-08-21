"""KJAPP Iter 14 — Card verification enforcement + payment-methods verified field."""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

USER = {"email": "ola@kjapp.no", "password": "test1234"}
ADMIN = {"email": "admin@kjapp.no", "password": "admin123"}

MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "kjapp")]


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _hdr(t): return {"Authorization": f"Bearer {t}"}


TRIP_BODY = {
    "pickup_address": "TEST_Pickup",
    "pickup_lat": 59.9139,
    "pickup_lng": 10.7522,
    "dropoff_address": "TEST_Dropoff",
    "dropoff_lat": 59.9200,
    "dropoff_lng": 10.7500,
    "vehicle_type": "trygg",
}


@pytest.fixture(scope="session")
def user_token():
    return _login(**USER)["token"]


@pytest.fixture(scope="session")
def user_id(user_token):
    r = requests.get(f"{API}/auth/me", headers=_hdr(user_token), timeout=15)
    assert r.status_code == 200
    return r.json()["id"]


class TestPaymentMethodsVerifiedField:
    def test_list_includes_verified_field(self, user_token):
        r = requests.get(f"{API}/payment-methods", headers=_hdr(user_token), timeout=15)
        assert r.status_code == 200
        methods = r.json()
        assert isinstance(methods, list)
        assert len(methods) > 0, "ola should have seeded payment methods"
        for m in methods:
            assert "verified" in m, f"missing verified field on {m}"
            assert isinstance(m["verified"], bool)

    def test_legacy_records_default_verified_true(self, user_token):
        r = requests.get(f"{API}/payment-methods", headers=_hdr(user_token), timeout=15)
        # Ola's seeded methods have no 'verified' field → should default to True
        methods = r.json()
        for m in methods:
            if "stripe_payment_method_id" not in m:
                assert m["verified"] is True, f"legacy method not defaulted verified=True: {m}"


class TestTripVerificationGate:
    """Card verification enforcement on POST /api/trips/request."""

    def _cancel_stale(self, uid):
        DB.trips.update_many(
            {"user_id": uid, "status": {"$in": ["searching", "booking", "driver_on_way", "in_trip", "arrived"]}},
            {"$set": {"status": "cancelled"}},
        )

    def test_402_no_card(self, user_id, user_token):
        # Backup all ola PMs and remove
        self._cancel_stale(user_id)
        backup = list(DB.payment_methods.find({"user_id": user_id}))
        try:
            DB.payment_methods.delete_many({"user_id": user_id})
            r = requests.post(f"{API}/trips/request", json=TRIP_BODY, headers=_hdr(user_token), timeout=15)
            assert r.status_code == 402, r.text
            assert "Legg til et betalingskort" in r.json().get("detail", "")
        finally:
            if backup:
                DB.payment_methods.insert_many(backup)

    def test_402_card_unverified(self, user_id, user_token):
        self._cancel_stale(user_id)
        backup = list(DB.payment_methods.find({"user_id": user_id}))
        try:
            DB.payment_methods.delete_many({"user_id": user_id})
            DB.payment_methods.insert_one({
                "user_id": user_id,
                "type": "visa",
                "label": "TEST_Unverified",
                "last4": "0000",
                "is_default": True,
                "verified": False,
            })
            r = requests.post(f"{API}/trips/request", json=TRIP_BODY, headers=_hdr(user_token), timeout=15)
            assert r.status_code == 402, r.text
            assert "verifiseres" in r.json().get("detail", "").lower()
        finally:
            DB.payment_methods.delete_many({"user_id": user_id})
            if backup:
                DB.payment_methods.insert_many(backup)

    def test_success_when_verified_true(self, user_id, user_token):
        self._cancel_stale(user_id)
        backup = list(DB.payment_methods.find({"user_id": user_id}))
        try:
            DB.payment_methods.delete_many({"user_id": user_id})
            DB.payment_methods.insert_one({
                "user_id": user_id,
                "type": "visa",
                "label": "TEST_Verified",
                "last4": "4242",
                "is_default": True,
                "verified": True,
            })
            r = requests.post(f"{API}/trips/request", json=TRIP_BODY, headers=_hdr(user_token), timeout=20)
            assert r.status_code == 200, r.text
            trip = r.json()
            assert trip["status"] == "searching"
            # cleanup
            DB.trips.update_one({"trip_id": trip["trip_id"]}, {"$set": {"status": "cancelled"}})
        finally:
            DB.payment_methods.delete_many({"user_id": user_id})
            if backup:
                DB.payment_methods.insert_many(backup)

    def test_success_when_legacy_missing_verified_field(self, user_id, user_token):
        """Legacy records without verified field should still be treated as verified."""
        self._cancel_stale(user_id)
        backup = list(DB.payment_methods.find({"user_id": user_id}))
        try:
            DB.payment_methods.delete_many({"user_id": user_id})
            DB.payment_methods.insert_one({
                "user_id": user_id,
                "type": "visa",
                "label": "TEST_Legacy",
                "last4": "1111",
                "is_default": True,
                # no 'verified' key at all
            })
            r = requests.post(f"{API}/trips/request", json=TRIP_BODY, headers=_hdr(user_token), timeout=20)
            assert r.status_code == 200, r.text
            trip = r.json()
            DB.trips.update_one({"trip_id": trip["trip_id"]}, {"$set": {"status": "cancelled"}})
        finally:
            DB.payment_methods.delete_many({"user_id": user_id})
            if backup:
                DB.payment_methods.insert_many(backup)


class TestRouteGuardRegression:
    def test_loyver_forbidden_for_user(self, user_token):
        r = requests.get(f"{API}/superadmin/fleet-applications", headers=_hdr(user_token), timeout=15)
        assert r.status_code == 403

    def test_superadmin_ok(self):
        t = _login(**ADMIN)["token"]
        r = requests.get(f"{API}/superadmin/fleet-applications", headers=_hdr(t), timeout=15)
        assert r.status_code == 200
