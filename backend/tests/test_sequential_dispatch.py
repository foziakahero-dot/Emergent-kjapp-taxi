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
from bson import ObjectId
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
    def find(self, *a, **k): return AsyncCursor(self.raw.find(*a, **k))


class AsyncCursor:
    def __init__(self, cursor): self.cursor = cursor
    def sort(self, *a, **k): self.cursor.sort(*a, **k); return self
    def limit(self, count): self.cursor.limit(count); return self
    async def __aiter__(self):
        for item in self.cursor:
            yield item


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


def test_dispatch_offers_far_driver_and_preview_exposes_only_distance_and_eta(monkeypatch):
    async def run():
        now = datetime.now(timezone.utc)
        raw = mongomock.MongoClient().db
        db = SimpleNamespace(**{name: Collection(raw[name]) for name in ('users', 'trips', 'fleets', 'driver_declines')})
        monkeypatch.setattr(server, 'db', db)
        monkeypatch.setattr(server, '_assigned_fleet_vehicle', AsyncMock(side_effect=lambda driver, **_: {
            '_id': ObjectId(driver['vehicle_id']), 'vehicle_type': driver['vehicle_type'],
        }))
        monkeypatch.setattr(server, '_driver_shift_compliance', AsyncMock(return_value={'operational': True}))
        monkeypatch.setattr(server, '_platform_commission', AsyncMock(return_value=.12))
        monkeypatch.setattr(server, '_commission_for_trip', AsyncMock(return_value=.12))
        monkeypatch.setattr(server, '_enforce_rate_limit', AsyncMock())
        monkeypatch.setattr(server, 'osrm_route', AsyncMock(return_value=None))
        monkeypatch.setattr(server.road_eta, 'settings', lambda: ('', 'distance_matrix'))
        push = AsyncMock()
        monkeypatch.setattr(server, 'send_push_to_user', push)
        engine = RideSearch(db, real_filter=server._real_trip_filter, offer=server.offer_trip_to_next_driver,
                            release=AsyncMock(), notify=AsyncMock())
        monkeypatch.setattr(server, 'ride_search', engine)
        fleet_id, passenger_id = ObjectId(), ObjectId()
        raw.fleets.insert_one({'_id': fleet_id, 'status': 'active'})

        def add_driver(latitude, category='ai-first', **extras):
            return raw.users.insert_one({
                'role': 'driver', 'approved': True, 'online': True, 'fleet_id': str(fleet_id),
                'vehicle_id': str(ObjectId()), 'vehicle_type': category, 'last_lat': latitude, 'last_lng': 10.75,
                'accepted_terms_at': now.isoformat(), 'last_location_at': now.isoformat(), **extras,
            }).inserted_id

        far = add_driver(59.99)
        add_driver(59.925, 'premium')
        add_driver(59.925, last_location_at=(now - timedelta(minutes=1)).isoformat())
        cash_due = add_driver(59.927)
        raw.trips.insert_one({'trip_id': 'previous-cash-ride', 'driver_id': str(cash_due),
                              'status': 'arrived', 'payment_flow': 'cash', 'payment_status': 'cash_due'})
        raw.users.insert_one({'_id': passenger_id, 'fullName': 'QA'})

        options = await server.pickup_options(server.NearbyCarsRequest(lat=59.90, lng=10.75), None, {'id': str(passenger_id)})
        assert 9 < options['options']['ai-first']['distance_km'] < 11
        assert options['options']['ai-first']['eta_min'] > 0
        assert set(options['options']['ai-first']) == {'distance_km', 'eta_min'}
        assert options['options']['premium']['distance_km'] < 5

        trip = {'trip_id': 'far-pickup-qa', 'user_id': str(passenger_id), 'driver_id': None,
                'status': 'searching', 'price': 150, 'pickup_lat': 59.90, 'pickup_lng': 10.75,
                'vehicle_type': 'ai-first', 'authorized_at': now.isoformat()}
        trip.update(search_fields(trip, now))
        raw.trips.insert_one(trip)
        await engine.tick(raw.trips.find_one({'trip_id': trip['trip_id']}), now)
        offered = raw.trips.find_one({'trip_id': trip['trip_id']})
        assert offered['offer_driver_id'] == str(far)
        assert offered['offer_km'] > 5
        assert push.await_args.args[0] == str(far)
        driver = raw.users.find_one({'_id': far})
        pending = await server.driver_pending({**driver, 'id': str(far)})
        assert [item['trip_id'] for item in pending['trips']] == [trip['trip_id']]

        near = add_driver(59.905)
        candidates = await server._dispatch_candidates(59.90, 10.75, vehicle_type='ai-first')
        assert [candidate['id'] for candidate in candidates] == [str(near), str(far)]
    asyncio.run(run())
