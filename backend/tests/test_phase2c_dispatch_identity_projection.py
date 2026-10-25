import os
import sys
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "kjapp_test")
os.environ.setdefault("JWT_SECRET", "unit-test-secret-that-is-long-enough-for-hs256")
os.environ.setdefault("APP_ENV", "development")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server  # noqa: E402


class AsyncCursor:
    def __init__(self, documents):
        self.documents = iter(documents)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self.documents)
        except StopIteration:
            raise StopAsyncIteration


class ProjectedUsers:
    def __init__(self, driver):
        self.driver = driver

    def find(self, _query, projection):
        document = {"_id": self.driver["_id"]}
        document.update({
            key: self.driver[key]
            for key, included in projection.items()
            if included and key in self.driver
        })
        return AsyncCursor([document])


class EmptyTrips:
    def find(self, *_args, **_kwargs):
        return AsyncCursor([])


class UploadedFiles:
    async def find_one(self, query, *_args, **_kwargs):
        if query.get("storage_path") == "private/driver/profile.jpg":
            return {"_id": "profile-photo"}
        return None


def test_dispatch_projection_includes_profile_photo_for_identity_compliance(monkeypatch):
    from bson import ObjectId

    now = datetime.now(timezone.utc).isoformat()
    driver = {
        "_id": ObjectId(),
        "role": "driver",
        "approved": True,
        "accepted_terms_at": now,
        "online": True,
        "disabled": False,
        "active_trip_id": None,
        "demo": False,
        "is_demo": False,
        "last_location_at": now,
        "last_lat": 59.91,
        "last_lng": 10.76,
        "fleet_id": str(ObjectId()),
        "vehicle_id": str(ObjectId()),
        "vehicle_type": "ai-first",
        "capabilities": [],
        "profile_photo_path": "private/driver/profile.jpg",
    }
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(
            trips=EmptyTrips(),
            users=ProjectedUsers(driver),
            uploaded_files=UploadedFiles(),
        ),
    )
    monkeypatch.setattr(
        server,
        "ride_testing",
        SimpleNamespace(
            is_test_customer=lambda _customer_id: False,
            driver_supply_filter=lambda _test_customer: {},
        ),
    )
    monkeypatch.setattr(server, "_real_trip_filter", lambda query: query)
    monkeypatch.setattr(server, "_fleet_is_suspended", lambda _fleet_id: _not_suspended())
    monkeypatch.setattr(server, "_assigned_fleet_vehicle", _assigned_vehicle)
    monkeypatch.setattr(
        server,
        "_driver_document_compliance",
        lambda _driver_id: _compliant_documents(),
    )
    monkeypatch.setattr(
        server,
        "_vehicle_document_compliance",
        lambda _fleet_id, _vehicle_id: _compliant_documents(),
    )
    monkeypatch.setattr(server, "_internal_driver_context", lambda *_args: _not_internal())
    monkeypatch.setattr(server, "_driver_supports_special_needs", lambda *_args: True)
    monkeypatch.setattr(server, "_block_driver_new_work", _block_driver)
    monkeypatch.setattr(server, "haversine_km", lambda *_args: 1.0)

    async def candidates():
        return await server._dispatch_candidates(59.90, 10.75)

    result = asyncio.run(candidates())
    assert [candidate["id"] for candidate in result] == [str(driver["_id"])]


async def _not_suspended():
    return False


def _vehicle():
    from bson import ObjectId

    return {"_id": ObjectId(), "vehicle_type": "ai-first"}


async def _assigned_vehicle(*_args, **_kwargs):
    return _vehicle()


async def _compliant_documents():
    return {"operational": True, "statuses": {}, "missing": []}


async def _not_internal():
    return False, False


async def _block_driver(*_args):
    return True
