"""Real FastAPI REST + Engine.IO/WebSocket tests over an isolated in-memory DB."""
import asyncio
import os
import sys
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import mongomock
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:27017')
os.environ.setdefault('DB_NAME', 'snar_live_cars_test')
os.environ.setdefault('JWT_SECRET', 'unit-test-secret-that-is-long-enough-for-hs256')
os.environ.setdefault('APP_ENV', 'development')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
from live_cars import LiveCarsStream, position_bounds


class Cursor:
    def __init__(self, raw): self.raw = raw
    def __aiter__(self): return self
    async def __anext__(self):
        try: return next(self.raw)
        except StopIteration: raise StopAsyncIteration


class Collection:
    def __init__(self, raw): self.raw = raw
    def find(self, *args, **kwargs): return Cursor(self.raw.find(*args, **kwargs))
    async def find_one(self, *args, **kwargs): return self.raw.find_one(*args, **kwargs)
    async def update_one(self, *args, **kwargs): return self.raw.update_one(*args, **kwargs)
    async def update_many(self, *args, **kwargs): return self.raw.update_many(*args, **kwargs)


@pytest.fixture
def fleet(monkeypatch):
    raw = mongomock.MongoClient().db
    db = SimpleNamespace(**{name: Collection(raw[name]) for name in ('users', 'trips', 'revoked_tokens', 'driver_sessions')})
    monkeypatch.setattr(server, 'db', db)
    monkeypatch.setattr(server.app.router, 'routes', [route for route in server.app.router.routes if getattr(route, 'path', '') != '/socket.io'])
    monkeypatch.setattr(server, 'live_cars_stream', LiveCarsStream(server.app,
        authenticate=server._authenticate_car_stream, snapshot=server._nearby_cars_snapshot,
        parse=server.NearbyCarsRequest.model_validate, origins=[]))
    async def assigned(driver, required=False):
        return {'car': 'Tesla Model Y', 'plate': 'AB12345', 'vehicle_type': driver.get('vehicle_type', 'ai-first')} if driver.get('has_car', True) else None
    async def suspended(fleet): return fleet == 'suspended'
    async def compliance(driver, car): return {'operational': driver.get('operational', True), 'message': 'blocked'}
    async def block(*args): pass
    monkeypatch.setattr(server, '_assigned_fleet_vehicle', assigned)
    monkeypatch.setattr(server, '_fleet_is_suspended', suspended)
    monkeypatch.setattr(server, '_driver_shift_compliance', compliance)
    monkeypatch.setattr(server, '_block_driver_new_work', block)
    customer_id = ObjectId()
    raw.users.insert_one({'_id': customer_id, 'role': 'user', 'email': 'customer@example.invalid'})
    token = server.create_access_token(str(customer_id), 'customer@example.invalid')
    def driver(**changes):
        now = datetime.now(timezone.utc)
        row = {'_id': ObjectId(), 'role': 'driver', 'fullName': 'QA Driver', 'approved': True,
               'accepted_terms_at': now.isoformat(), 'online': True, 'fleet_id': 'active',
               'last_lat': 59.914, 'last_lng': 10.7522, 'last_heading': 90, 'rating': 4.8,
               'last_location_at': now.isoformat(), 'last_location_recorded_at': now.isoformat(),
               'last_location_session': {'jti': 'driver-' + str(ObjectId()), 'iat': now.timestamp(), 'exp': (now + timedelta(hours=1)).timestamp()}}
        row.update(changes); raw.users.insert_one(row); return row
    @asynccontextmanager
    async def lifespan(app):
        task = asyncio.create_task(server.live_cars_stream.run())
        yield
        task.cancel(); await asyncio.gather(task, return_exceptions=True)
        await server.live_cars_stream.close()
    monkeypatch.setattr(server.app.router, 'lifespan_context', lifespan)
    return raw, driver, token


def headers(token): return {'Authorization': 'Bearer ' + token}

def snapshot(client, token):
    return client.post('/api/cars/nearby', headers=headers(token), json={'lat': 59.9139, 'lng': 10.7522})


@pytest.mark.parametrize('changes', [
    {'online': False}, {'approved': False}, {'disabled': True}, {'demo': True}, {'is_demo': True},
    {'active_trip_id': 'busy'}, {'role': 'admin'}, {'accepted_terms_at': None}, {'fleet_id': 'suspended'},
    {'has_car': False}, {'operational': False}, {'last_lat': 60.1}, {'last_lng': 11.0},
    {'last_lat': float('nan')}, {'last_lat': 91}, {'last_location_session': {}},
    {'last_location_session': {'exp': 1}},
    {'last_location_at': '2000-01-01T00:00:00+00:00'},
    {'last_location_recorded_at': '2000-01-01T00:00:00+00:00'},
    {'last_location_recorded_at': '2099-01-01T00:00:00+00:00'},
    {'last_location_recorded_at': None},
])
def test_only_logged_in_available_live_drivers(fleet, changes):
    raw, driver, token = fleet
    good = driver(); driver(**changes)
    with TestClient(server.app) as client:
        response = snapshot(client, token)
    assert response.status_code == 200
    body = response.json()
    assert [car['id'] for car in body['cars']] == [str(good['_id'])]
    assert body['radius_km'] == 5 and body['gps_fresh_seconds'] == 15
    assert body['cars'][0]['name'] == 'QA' and body['cars'][0]['rating'] == 4.8
    assert not {'email', 'phone', 'plate', 'last_location_session'} & body['cars'][0].keys()


@pytest.mark.parametrize('sample_age,visible', [(3, True), (8, True), (14, True), (16, False)])
def test_nearby_tolerates_delivery_gaps_but_expires_silent_drivers(fleet, sample_age, visible):
    raw, driver, token = fleet
    stamp = (datetime.now(timezone.utc) - timedelta(seconds=sample_age)).isoformat()
    car = driver(last_location_at=stamp, last_location_recorded_at=stamp)
    with TestClient(server.app) as client:
        cars = snapshot(client, token).json()['cars']
        assert [c['id'] for c in cars] == ([str(car['_id'])] if visible else [])
        # An explicit offline transition removes a still-fresh driver immediately.
        raw.users.update_one({'_id': car['_id']}, {'$set': {'online': False}})
        assert snapshot(client, token).json()['cars'] == []


def test_recent_receipt_cannot_refresh_old_device_sample(fleet):
    raw, driver, token = fleet
    driver(last_location_recorded_at=(datetime.now(timezone.utc) - timedelta(seconds=16)).isoformat())
    with TestClient(server.app) as client:
        assert snapshot(client, token).json()['cars'] == []


def test_exact_circle_rejects_box_corner_and_driver_with_active_trip(fleet):
    raw, driver, token = fleet
    good = driver(last_lat=59.9139 + 4.99 / 111.195)
    driver(last_lat=59.9139 + 5.01 / 111.195)
    driver(last_lat=59.95, last_lng=10.82)  # in the box, outside the circle
    busy = driver(); raw.trips.insert_one({'driver_id': str(busy['_id']), 'status': 'in_trip'})
    with TestClient(server.app) as client:
        assert [c['id'] for c in snapshot(client, token).json()['cars']] == [str(good['_id'])]


@pytest.mark.parametrize('role', ['driver', 'admin', 'superadmin', 'fleet_owner'])
def test_customer_only_http_and_socket(fleet, role):
    raw, driver, token = fleet
    account = ObjectId(); raw.users.insert_one({'_id': account, 'role': role, 'email': 'other@example.invalid'})
    wrong = server.create_access_token(str(account), 'other@example.invalid')
    with TestClient(server.app) as client:
        assert snapshot(client, wrong).status_code == 403
        assert client.post('/api/cars/nearby', json={'lat': 59.91, 'lng': 10.75}).status_code == 401
        with client.websocket_connect('/socket.io/?EIO=4&transport=websocket', headers={'upgrade': 'websocket'}) as ws:
            assert ws.receive_text().startswith('0')
            ws.send_text('40/customer-cars,' + json.dumps({'token': wrong}))
            assert ws.receive_text().startswith('44/customer-cars,')


def read_snapshot(ws, predicate=lambda data: True):
    for _ in range(12):
        msg = ws.receive_text()
        if msg == '2': ws.send_text('3'); continue
        if msg.startswith('42/customer-cars,'):
            event, data = json.loads(msg.split(',', 1)[1])
            if event == 'cars:snapshot' and predicate(data): return data
    raise AssertionError('Expected snapshot did not arrive')


def test_real_socket_add_move_remove_and_per_customer_radius(fleet):
    raw, driver, token = fleet
    car = driver()
    with TestClient(server.app) as client:
        with client.websocket_connect('/socket.io/?EIO=4&transport=websocket', headers={'upgrade': 'websocket'}) as ws:
            assert ws.receive_text().startswith('0')
            ws.send_text('40/customer-cars,' + json.dumps({'token': token}))
            assert ws.receive_text().startswith('40/customer-cars,')
            ws.send_text('42/customer-cars,' + json.dumps(['cars:subscribe', {'lat': 59.9139, 'lng': 10.7522, 'subscription_id': 1}]))
            assert [c['id'] for c in read_snapshot(ws)['cars']] == [str(car['_id'])]
            for changes, expected in [({'online': False}, False), ({'online': True, 'last_lat': 59.915}, True),
                                      ({'last_lat': 59.99}, False), ({'last_lat': 59.914}, True),
                                      ({'active_trip_id': 'assigned'}, False)]:
                now = datetime.now(timezone.utc).isoformat(); start = time.monotonic()
                raw.users.update_one({'_id': car['_id']}, {'$set': {**changes, 'last_location_at': now, 'last_location_recorded_at': now}})
                result = read_snapshot(ws, lambda body: bool(body['cars']) == expected)
                assert time.monotonic() - start < 2
                assert result['subscription_id'] == 1
                if expected: assert result['cars'][0]['lat'] == changes['last_lat']
            # Retargeting one subscriber never returns a global fleet snapshot.
            ws.send_text('42/customer-cars,' + json.dumps(['cars:subscribe', {'lat': 60.5, 'lng': 10.7522, 'subscription_id': 2}]))
            assert not read_snapshot(ws, lambda body: body['subscription_id'] == 2)['cars']


def test_revocation_and_logout_remove_driver(fleet):
    raw, driver, token = fleet
    car = driver()
    with TestClient(server.app) as client:
        assert snapshot(client, token).json()['cars']
        raw.revoked_tokens.insert_one({'jti': car['last_location_session']['jti']})
        assert not snapshot(client, token).json()['cars']
        raw.revoked_tokens.delete_many({})
        driver_token = server.create_access_token(str(car['_id']), 'driver@example.invalid')
        import jwt
        payload = jwt.decode(driver_token, server.JWT_SECRET, algorithms=['HS256'])
        raw.users.update_one({'_id': car['_id']}, {'$set': {'last_location_session': {k: payload[k] for k in ('jti', 'iat', 'exp')}}})
        assert client.post('/api/auth/logout', headers=headers(driver_token)).status_code == 200
        assert raw.users.find_one({'_id': car['_id']})['online'] is False
        assert not snapshot(client, token).json()['cars']


def test_bounds_cover_antimeridian_and_poles():
    raw = mongomock.MongoClient().db
    raw.users.insert_many([{'last_lat': 0, 'last_lng': -179.99}, {'last_lat': 0, 'last_lng': 179.99}, {'last_lat': 0, 'last_lng': 170}])
    assert raw.users.count_documents(position_bounds(0, 179.999)) == 2
    assert raw.users.count_documents(position_bounds(0, -179.999)) == 2
    assert 'last_lng' not in position_bounds(89.999, 0)


def test_driver_location_binds_session_and_rejects_reordered_gps(fleet, monkeypatch):
    raw, driver, customer = fleet
    car = driver()
    token = server.create_access_token(str(car['_id']), 'driver@example.invalid')
    monkeypatch.setitem(server.app.dependency_overrides, server.require_driver,
        lambda: {**car, 'id': str(car['_id'])})
    stamp = datetime.now(timezone.utc)
    with TestClient(server.app) as client:
        response = client.post('/api/driver/location', headers=headers(token), json={
            'lat': 59.9141, 'lng': 10.7522, 'recorded_at': stamp.isoformat(), 'heading': 180})
        assert response.status_code == 200
        user = raw.users.find_one({'_id': car['_id']})
        assert user['last_location_session']['exp'] > stamp.timestamp()
        assert snapshot(client, customer).json()['cars'][0]['lat'] == 59.9141
        stale = client.post('/api/driver/location', headers=headers(token), json={
            'lat': 59.914, 'lng': 10.7522, 'recorded_at': (stamp - timedelta(seconds=1)).isoformat()})
        assert stale.status_code == 409
        assert raw.users.find_one({'_id': car['_id']})['last_lat'] == 59.9141


def test_suv_is_a_distinct_category_and_uses_server_quotes(fleet):
    raw, driver, token = fleet
    suv = driver(vehicle_type='suv'); driver(vehicle_type='trygg')
    with TestClient(server.app) as client:
        response = client.post('/api/cars/nearby', headers=headers(token), json={'lat': 59.9139, 'lng': 10.7522, 'vehicle_type': 'suv'})
        assert response.status_code == 200
        assert [car['id'] for car in response.json()['cars']] == [str(suv['_id'])]
        assert response.json()['cars'][0]['body_type'] == 'suv'
    pricing = {'surge': {'enabled': False}, 'vehicle_rates': {'trygg': {'base_fare': 90, 'per_km': 22, 'per_minute': 5}}}
    assert server.calculate_price(2, 'suv', 5, pricing)['price'] == server.calculate_price(2, 'trygg', 5, pricing)['price']
    pricing['vehicle_rates']['suv'] = {'base_fare': 80, 'per_km': 20, 'per_minute': 4}
    assert server.calculate_price(2, 'suv', 5, pricing)['price'] == 140


def test_busy_vehicle_does_not_hide_other_drivers_or_disconnect_customer(fleet, monkeypatch):
    raw, driver, token = fleet
    good = driver(); busy = driver()
    original = server._assigned_fleet_vehicle
    async def assigned(row, required=False):
        if row['_id'] == busy['_id']:
            from fastapi import HTTPException
            raise HTTPException(409, 'Vehicle claimed elsewhere')
        return await original(row, required=required)
    monkeypatch.setattr(server, '_assigned_fleet_vehicle', assigned)
    with TestClient(server.app) as client:
        assert [car['id'] for car in snapshot(client, token).json()['cars']] == [str(good['_id'])]


def test_going_offline_during_fleet_checks_cannot_revive_old_marker(fleet, monkeypatch):
    raw, driver, token = fleet
    car = driver()
    async def compliance(row, vehicle):
        raw.users.update_one({'_id': row['_id']}, {'$set': {'online': False}})
        return {'operational': True}
    monkeypatch.setattr(server, '_driver_shift_compliance', compliance)
    with TestClient(server.app) as client:
        assert snapshot(client, token).json()['cars'] == []
