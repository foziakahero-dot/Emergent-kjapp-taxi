"""Exercise the actual server offer/decline functions against atomic Mongo queries."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
import mongomock
import pytest
from fastapi import HTTPException
os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:27017')
os.environ.setdefault('DB_NAME', 'snar_sequential_test')
os.environ.setdefault('JWT_SECRET', 'unit-test-secret-that-is-long-enough-for-hs256')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
from ride_search import RideSearch, search_fields


class Collection:
    def __init__(self, raw): self.raw = raw
    async def find_one(self, *a, **k): return self.raw.find_one(*a, **k)
    async def update_one(self, *a, **k): return self.raw.update_one(*a, **k)
    async def find_one_and_update(self, *a, **k): return self.raw.find_one_and_update(*a, **k)


@pytest.mark.parametrize('decline_first', [False, True])
def test_one_offer_at_a_time_thirty_seconds_next_driver_and_sixty_second_end(monkeypatch, decline_first):
    async def run():
        start = datetime(2026, 10, 17, tzinfo=timezone.utc)
        clock = [start]
        class Clock(datetime):
            @classmethod
            def now(cls, tz=None): return clock[0]
        monkeypatch.setattr(server, 'datetime', Clock)
        raw = mongomock.MongoClient().db
        db = SimpleNamespace(trips=Collection(raw.trips), driver_declines=Collection(raw.driver_declines))
        trip = dict(trip_id='ride', user_id='customer', driver_id=None, status='searching', price=300, offer_seq=0,
                    pickup_lat=59.9, pickup_lng=10.7, authorized_at=start.isoformat())
        trip.update(search_fields(trip, start)); raw.trips.insert_one(trip)
        monkeypatch.setattr(server, 'db', db)
        monkeypatch.setattr(server, '_real_trip_filter', lambda q: q)
        monkeypatch.setattr(server, '_dispatch_candidates', AsyncMock(return_value=[{'id':'nearest', 'km':.2}, {'id':'next', 'km':.8}, {'id':'third','km':1.2}]))
        monkeypatch.setattr(server, '_commission_for_trip', AsyncMock(return_value=.1))
        monkeypatch.setattr(server, 'send_push_to_user', AsyncMock())
        release = AsyncMock()
        engine = RideSearch(db, real_filter=lambda q:q, offer=server.offer_trip_to_next_driver, release=release, notify=AsyncMock())
        monkeypatch.setattr(server, 'ride_search', engine)
        read = lambda: raw.trips.find_one({'trip_id':'ride'})
        await engine.tick(read(), clock[0])
        assert read()['offer_driver_id'] == 'nearest'
        assert read()['offer_expires_at'] == (start + timedelta(seconds=30)).isoformat()
        clock[0] = start + timedelta(seconds=2 if decline_first else 29)
        await engine.tick(read(), clock[0])
        assert read()['offer_driver_id'] == 'nearest'
        with pytest.raises(HTTPException):
            await server.driver_decline(server.DeclineTripRequest(trip_id='ride'), {'id':'next'})
        if decline_first:
            await server.driver_decline(server.DeclineTripRequest(trip_id='ride'), {'id':'nearest'})
        else:
            clock[0] = start + timedelta(seconds=30)
            await engine.tick(read(), clock[0])
        assert read()['offer_driver_id'] == 'next'
        assert set(read()['offer_history']) == {'nearest', 'next'}
        assert datetime.fromisoformat(read()['offer_expires_at']) - clock[0] <= timedelta(seconds=30)
        assert read()['offer_expires_at'] <= read()['search_deadline_at']
        if decline_first:
            clock[0] = start + timedelta(seconds=3)
            await server.driver_decline(server.DeclineTripRequest(trip_id='ride'), {'id':'next'})
            assert read()['offer_driver_id'] == 'third'
        clock[0] = start + timedelta(seconds=60)
        await engine.tick(read(), clock[0])
        assert read()['status'] == 'cancelled' and read()['offer_driver_id'] is None
        assert read()['cancel_reason'] == 'no_driver_available'
        release.assert_awaited_once()
    asyncio.run(run())
