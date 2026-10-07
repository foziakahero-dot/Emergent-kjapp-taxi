"""Integration tests against Mongo-compatible state; no external email or bank calls."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import mongomock
import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).parents[1]))
from fleet_vehicle_access import access_query, claim_vehicle, release_vehicle
from onboarding_emails import queue_confirmation, deliver_one
from norwegian_bank import normalize_bank_account
from test_fleet_invitation_delivery import Collection


def fixture():
    raw = mongomock.MongoClient(tz_aware=True).db
    db = SimpleNamespace(**{n: Collection(raw[n]) for n in ('users', 'fleet_vehicles', 'trips', 'onboarding_email_outbox')})
    fid, other = str(ObjectId()), str(ObjectId())
    vehicles = [{'_id': ObjectId(), 'fleet_id': fid, 'active': True},
                {'_id': ObjectId(), 'fleet_id': fid, 'active': True},
                {'_id': ObjectId(), 'fleet_id': other, 'active': True},
                {'_id': ObjectId(), 'fleet_id': fid, 'active': False}]
    raw.fleet_vehicles.insert_many(vehicles)
    drivers = [{'_id': ObjectId(), 'fleet_id': fid, 'role': 'driver', 'online': False, 'vehicle_access_mode': 'all'} for _ in range(2)]
    raw.users.insert_many(drivers)
    return raw, db, drivers, vehicles


def test_permissions_cannot_cross_fleet_or_include_parked_cars():
    raw, db, drivers, cars = fixture()
    assert len(list(raw.fleet_vehicles.find(access_query(drivers[0])))) == 2
    drivers[0].update(vehicle_access_mode='selected', allowed_vehicle_ids=[str(cars[0]['_id']), str(cars[2]['_id']), 'bad'])
    assert [c['_id'] for c in raw.fleet_vehicles.find(access_query(drivers[0]))] == [cars[0]['_id']]
    async def check():
        with pytest.raises(HTTPException): await claim_vehicle(db, drivers[0], cars[1])
        with pytest.raises(HTTPException): await claim_vehicle(db, drivers[1], cars[2])
        with pytest.raises(HTTPException): await claim_vehicle(db, drivers[1], cars[3])
    asyncio.run(check())


def test_concurrent_vehicle_claim_and_release_preserve_access():
    raw, db, drivers, cars = fixture()
    async def check():
        results = await asyncio.gather(*(claim_vehicle(db, driver, cars[0]) for driver in drivers), return_exceptions=True)
        assert sum(isinstance(result, HTTPException) for result in results) == 1
        winner = raw.fleet_vehicles.find_one({'_id': cars[0]['_id']})['active_driver_id']
        await release_vehicle(db, winner)
        assert raw.fleet_vehicles.find_one({'_id': cars[0]['_id']}).get('active_driver_id') is None
        assert all(len(list(raw.fleet_vehicles.find(access_query(driver)))) == 2 for driver in drivers)
        await claim_vehicle(db, drivers[1], cars[0])
    asyncio.run(check())


def test_stale_claim_recovery_does_not_take_online_or_active_trip_vehicle():
    raw, db, drivers, cars = fixture()
    holder = str(drivers[0]['_id'])
    raw.fleet_vehicles.update_one({'_id': cars[0]['_id']}, {'$set': {'active_driver_id': holder}})
    async def check():
        claimed = raw.fleet_vehicles.find_one({'_id': cars[0]['_id']})
        raw.users.update_one({'_id': drivers[0]['_id']}, {'$set': {'online': True}})
        with pytest.raises(HTTPException): await claim_vehicle(db, drivers[1], claimed)
        raw.users.update_one({'_id': drivers[0]['_id']}, {'$set': {'online': False}})
        raw.trips.insert_one({'driver_id': holder, 'status': 'in_trip'})
        with pytest.raises(HTTPException): await claim_vehicle(db, drivers[1], claimed)
        raw.trips.update_one({'driver_id': holder}, {'$set': {'status': 'completed'}})
        await claim_vehicle(db, drivers[1], claimed)
        assert raw.fleet_vehicles.find_one()['active_driver_id'] == str(drivers[1]['_id'])
    asyncio.run(check())


def test_confirmation_survives_missing_provider_and_delivers_once():
    raw, db, _, _ = fixture()
    calls = []
    async def check():
        with patch.dict(os.environ, {'SENDGRID_API_KEY': ''}):
            assert await queue_confirmation(db, 'beta', 'one', 'test@example.com', '<script>') == 'not_configured'
            await queue_confirmation(db, 'beta', 'one', 'test@example.com', '<script>')
        assert raw.onboarding_email_outbox.count_documents({}) == 1
        assert '&lt;script&gt;' in raw.onboarding_email_outbox.find_one()['html']
        def send(*args): calls.append(args); return True
        assert await deliver_one(db, send)
        assert not await deliver_one(db, send)
        assert len(calls) == 1 and raw.onboarding_email_outbox.find_one()['status'] == 'sent'
    asyncio.run(check())


def test_failed_delivery_backoff_and_stale_lease_retry():
    raw, db, _, _ = fixture()
    async def check():
        await queue_confirmation(db, 'driver', 'one', 'test@example.com', 'Driver')
        await deliver_one(db, lambda *a: False)
        record = raw.onboarding_email_outbox.find_one()
        assert record['status'] == 'pending' and record['attempts'] == 1
        assert not await deliver_one(db, lambda *a: True)
        raw.onboarding_email_outbox.update_one({'_id': record['_id']}, {'$set': {'status': 'sending', 'lease_until': datetime.now(timezone.utc) - timedelta(minutes=3)}})
        await deliver_one(db, lambda *a: True)
        assert raw.onboarding_email_outbox.find_one()['status'] == 'sent'
    asyncio.run(check())


@pytest.mark.parametrize('value', ['8601.11.17947', '86011117947', 'NO9386011117947', 'NO93 8601 1117 947'])
def test_norwegian_account_normalization(value):
    assert normalize_bank_account(value) == '86011117947'


@pytest.mark.parametrize('value', ['86011117948', 'NO9286011117947', '123', 'SE9386011117947', ''])
def test_invalid_norwegian_account_rejected(value):
    with pytest.raises(ValueError): normalize_bank_account(value)


def test_new_claim_cannot_be_stolen_before_online_user_update():
    raw, db, drivers, cars = fixture()
    async def check():
        await claim_vehicle(db, drivers[0], cars[0])
        fresh = raw.fleet_vehicles.find_one({'_id': cars[0]['_id']})
        with pytest.raises(HTTPException): await claim_vehicle(db, drivers[1], fresh)
        assert raw.fleet_vehicles.find_one()['active_driver_id'] == str(drivers[0]['_id'])
    asyncio.run(check())


def test_private_document_storage_survives_restart_and_deletes_bytes():
    from document_storage import put_document, get_document, delete_document
    raw, db, _, _ = fixture()
    db.document_blobs = Collection(raw.document_blobs)
    async def check():
        assert await put_document(db, 'application/token/one.pdf', b'%PDF-unit-test', 'application/pdf') == {'path': 'application/token/one.pdf', 'size': 14}
        restarted = SimpleNamespace(document_blobs=Collection(raw.document_blobs))
        assert await get_document(restarted, 'application/token/one.pdf') == (b'%PDF-unit-test', 'application/pdf')
        assert await delete_document(restarted, 'application/token/one.pdf')
        assert await get_document(db, 'application/token/one.pdf') is None
        with pytest.raises(HTTPException): await put_document(db, 'too-big', b'x' * (8*1024*1024+1), 'application/pdf')
    asyncio.run(check())


def test_invitation_retry_uses_lease_and_skips_used_or_expired_links():
    from onboarding_emails import deliver_invite
    raw, db, _, _ = fixture()
    db.driver_invites = Collection(raw.driver_invites)
    now = datetime.now(timezone.utc)
    for token, used, expiry in [('live', False, now+timedelta(days=1)), ('used', True, now+timedelta(days=1)), ('expired', False, now-timedelta(days=1))]:
        raw.driver_invites.insert_one({'token': token, 'used': used, 'expires_at': expiry.isoformat(), 'email': 'test@example.com', 'email_sent': False})
    calls = []
    async def send(invite):
        calls.append(invite['token'])
        await asyncio.sleep(0)
        return {'email_sent': True}
    async def check():
        results=await asyncio.gather(deliver_invite(db,send),deliver_invite(db,send))
        assert sum(results)==1 and calls==['live']
        assert raw.driver_invites.find_one({'token':'live'})['email_sent'] is True
        assert not await deliver_invite(db,send)
    asyncio.run(check())
