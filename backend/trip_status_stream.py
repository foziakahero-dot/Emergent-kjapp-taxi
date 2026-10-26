"""Authenticated trip invalidations on the existing Socket.IO server.

No trip details or coordinates are broadcast; owners refetch their authorized
REST resource. Recheck membership and token revocation before every emission.
"""
import asyncio
import time
from fastapi import HTTPException

NAMESPACE = '/trip-status'


class TripStatusStream:
    def __init__(self, sio, *, authenticate, load):
        self.sio, self.authenticate, self.load = sio, authenticate, load
        self.clients = {}
        self.dirty = asyncio.Event()
        for event, handler in [('connect', self.connect), ('disconnect', self.disconnect), ('trip:subscribe', self.subscribe)]:
            sio.on(event, handler, namespace=NAMESPACE)

    async def connect(self, sid, environ, auth):
        token = auth.get('token') if isinstance(auth, dict) else None
        if not isinstance(token, str) or not 1 <= len(token) <= 8192:
            return False
        try:
            user = await self.authenticate(token)
        except HTTPException:
            return False
        if sum(c['user_id'] == user['id'] for c in self.clients.values()) >= 3:
            return False
        self.clients[sid] = dict(token=token, user_id=user['id'], trip_id=None, signature=None, connected=time.monotonic(), last_subscribe=0)
        return True

    async def disconnect(self, sid, reason=None):
        self.clients.pop(sid, None)

    async def subscribe(self, sid, data):
        c = self.clients.get(sid)
        if not c:
            return {'ok': False}
        if time.monotonic() - c['last_subscribe'] < .25:
            return {'ok': False}
        c['last_subscribe'] = time.monotonic()
        c['trip_id'], c['signature'] = None, None
        trip_id = data.get('trip_id') if isinstance(data, dict) else None
        if not isinstance(trip_id, str) or not 1 <= len(trip_id) <= 128:
            return {'ok': False}
        try:
            user = await self.authenticate(c['token'])
            trip = await self.load(trip_id, user)
        except HTTPException:
            return {'ok': False}
        if not trip:
            return {'ok': False}
        c['trip_id'] = trip_id
        self.changed()
        return {'ok': True}

    def changed(self):
        self.dirty.set()

    async def refresh(self, sid, c):
        if not c['trip_id']:
            if time.monotonic() - c['connected'] > 10:
                await self.sio.disconnect(sid, namespace=NAMESPACE)
            return
        try:
            user = await self.authenticate(c['token'])
            trip = await self.load(c['trip_id'], user)
            if not trip:
                raise HTTPException(403)
        except HTTPException:
            await self.sio.disconnect(sid, namespace=NAMESPACE)
            return
        signature = repr(sorted(trip.items()))
        if self.clients.get(sid) is c and signature != c['signature']:
            c['signature'] = signature
            await self.sio.emit('trip:changed', {'trip_id': c['trip_id']}, to=sid, namespace=NAMESPACE)

    async def run(self):
        while True:
            try:
                await asyncio.wait_for(self.dirty.wait(), timeout=.5)
            except asyncio.TimeoutError:
                pass
            self.dirty.clear()
            # One client's transient DB failure must not stop other subscriptions.
            await asyncio.gather(*(self.refresh(sid, c) for sid, c in list(self.clients.items())), return_exceptions=True)

    async def close(self):
        for sid in list(self.clients):
            await self.sio.disconnect(sid, namespace=NAMESPACE)
