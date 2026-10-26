import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import HTTPException
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from trip_status_stream import TripStatusStream


def fixture():
    sio = SimpleNamespace(on=lambda *a, **k: None, emit=AsyncMock(), disconnect=AsyncMock())
    revoked = set()
    async def auth(token):
        if token in revoked:
            raise HTTPException(401)
        return {'id': token}
    trip = {'trip_id': 'ride', 'status': 'searching', 'driver_id': None}
    async def load(trip_id, user):
        return dict(trip) if trip_id == 'ride' and user['id'] in ('customer', trip['driver_id']) else None
    stream = TripStatusStream(sio, authenticate=auth, load=load)
    return stream, sio, trip, revoked


def test_only_owner_or_assigned_driver_can_subscribe_and_no_private_data_emitted():
    async def run():
        stream, sio, trip, _ = fixture()
        assert not await stream.connect('bad', {}, {})
        await stream.connect('c', {}, {'token': 'customer'})
        await stream.connect('other', {}, {'token': 'stranger'})
        await stream.connect('d', {}, {'token': 'driver'})
        assert (await stream.subscribe('other', {'trip_id': 'ride'})) == {'ok': False}
        assert (await stream.subscribe('d', {'trip_id': 'ride'})) == {'ok': False}
        assert (await stream.subscribe('c', {'trip_id': 'ride'})) == {'ok': True}
        await stream.refresh('c', stream.clients['c'])
        assert sio.emit.call_args.args == ('trip:changed', {'trip_id': 'ride'})
        assert sio.emit.call_args.kwargs['to'] == 'c'
        await stream.refresh('c', stream.clients['c'])
        assert sio.emit.await_count == 1  # no repeated invalidations for unchanged state
        trip.update(status='driver_on_way', driver_id='driver', driver_lat=59.9, driver_lng=10.7)
        stream.clients['d']['last_subscribe'] = 0
        assert (await stream.subscribe('d', {'trip_id': 'ride'})) == {'ok': True}
        await stream.refresh('c', stream.clients['c'])
        await stream.refresh('d', stream.clients['d'])
        assert sio.emit.await_count == 3
        assert all(call.args[1] == {'trip_id': 'ride'} for call in sio.emit.call_args_list)
    asyncio.run(run())


def test_revoked_session_and_removed_driver_are_disconnected_before_any_emission():
    async def run():
        stream, sio, trip, revoked = fixture()
        trip.update(driver_id='driver', status='driver_on_way')
        for sid, token in [('c', 'customer'), ('d', 'driver')]:
            await stream.connect(sid, {}, {'token': token})
            await stream.subscribe(sid, {'trip_id': 'ride'})
        revoked.add('customer')
        trip['driver_id'] = 'replacement'
        for sid in ('c', 'd'):
            await stream.refresh(sid, stream.clients[sid])
        assert sio.emit.await_count == 0
        assert {c.args[0] for c in sio.disconnect.call_args_list} == {'c', 'd'}
    asyncio.run(run())


def test_new_invalid_subscription_clears_old_trip_and_connection_limit():
    async def run():
        stream, _, _, _ = fixture()
        for i in range(3):
            assert await stream.connect(str(i), {}, {'token': 'customer'})
        assert not await stream.connect('fourth', {}, {'token': 'customer'})
        assert (await stream.subscribe('0', {'trip_id': 'ride'}))['ok']
        stream.clients['0']['last_subscribe'] = 0
        assert not (await stream.subscribe('0', {'trip_id': '../foreign'}))['ok']
        assert stream.clients['0']['trip_id'] is None
    asyncio.run(run())
