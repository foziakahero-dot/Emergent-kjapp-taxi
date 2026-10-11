import sys
from pathlib import Path
from types import SimpleNamespace

from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import marketing_waitlist as waitlist  # noqa: E402


class FakeRateLimits:
    def __init__(self):
        self.docs = {}
        self.indexes = []

    async def create_index(self, *args, **kwargs):
        self.indexes.append((args, kwargs))

    async def find_one_and_update(self, query, update, **kwargs):
        key = query["_id"]
        doc = self.docs.setdefault(key, {"_id": key, "count": 0})
        doc["count"] += update.get("$inc", {}).get("count", 0)
        return dict(doc)


class FakeWaitlist:
    def __init__(self):
        self.docs = {}
        self.indexes = []

    async def create_index(self, *args, **kwargs):
        self.indexes.append((args, kwargs))

    async def update_one(self, query, update, upsert=False):
        key = query["identity_key"]
        is_new = key not in self.docs
        if is_new and upsert:
            self.docs[key] = dict(update.get("$setOnInsert", {}))
        doc = self.docs.setdefault(key, {"identity_key": key})
        doc.update(update.get("$set", {}))
        for field, amount in update.get("$inc", {}).items():
            doc[field] = int(doc.get(field, 0)) + int(amount)
        return SimpleNamespace(upserted_id=key if is_new else None)


class FakeDB:
    def __init__(self):
        self.beta_waitlist = FakeWaitlist()
        self.waitlist_rate_limits = FakeRateLimits()


def make_client():
    db = FakeDB()
    api = APIRouter(prefix="/api")
    waitlist.install_marketing_waitlist(api, db)
    app = FastAPI()
    app.include_router(api)
    return TestClient(app), db


def valid_payload(**overrides):
    payload = {
        "name": "Ola Nordmann",
        "phone": "+47 912 34 567",
        "email": "ola@example.no",
        "city": "Oslo",
        "role": "passenger",
        "website": "",
    }
    payload.update(overrides)
    return payload


def test_phone_normalization_is_stable():
    assert waitlist.normalize_phone("+47 912 34 567") == "+4791234567"
    assert waitlist.normalize_phone("912 34 567") == "91234567"


def test_invalid_phone_is_rejected():
    try:
        waitlist.normalize_phone("123")
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_identity_is_deterministic():
    first = waitlist.waitlist_identity(
        role="passenger",
        phone="+4791234567",
        email="ola@example.no",
        city="Oslo",
    )
    second = waitlist.waitlist_identity(
        role="passenger",
        phone="+4791234567",
        email="ola@example.no",
        city="OSLO",
    )
    assert first == second


def test_valid_signup_is_idempotent_and_does_not_reveal_duplicate():
    client, db = make_client()

    first = client.post("/api/marketing/waitlist", json=valid_payload())
    second = client.post("/api/marketing/waitlist", json=valid_payload())

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json() == {"ok": True, "status": "registered"}
    assert second.json() == {"ok": True, "status": "registered"}
    assert len(db.beta_waitlist.docs) == 1
    stored = next(iter(db.beta_waitlist.docs.values()))
    assert stored["phone"] == "+4791234567"
    assert stored["email"] == "ola@example.no"
    assert stored["source"] == "snarapp.no"
    assert stored["submission_count"] == 2


def test_honeypot_returns_generic_success_without_storing_pii():
    client, db = make_client()
    response = client.post("/api/marketing/waitlist", json=valid_payload(website="https://spam.example"))

    assert response.status_code == 201
    assert response.json() == {"ok": True, "status": "registered"}
    assert db.beta_waitlist.docs == {}


def test_invalid_signup_is_rejected():
    client, db = make_client()
    response = client.post("/api/marketing/waitlist", json=valid_payload(phone="123"))

    assert response.status_code in (400, 422)
    assert db.beta_waitlist.docs == {}


def test_global_rate_limit_is_enforced(monkeypatch):
    monkeypatch.setattr(waitlist, "WAITLIST_GLOBAL_LIMIT_PER_MINUTE", 1)
    client, db = make_client()

    first = client.post("/api/marketing/waitlist", json=valid_payload())
    second = client.post(
        "/api/marketing/waitlist",
        json=valid_payload(phone="+47 988 88 888", email="annen@example.no"),
    )

    assert first.status_code == 201
    assert second.status_code == 429
    assert len(db.beta_waitlist.docs) == 1

