"""Authenticated, per-customer Socket.IO supply snapshots on the existing ASGI app.

No fleet-wide location broadcast. MongoDB remains authoritative; reconciliation
also sees changes made by another worker, admin, token revocation or GPS expiry.
"""
import asyncio
import logging
import math
import time
from datetime import datetime, timezone

import socketio
from fastapi import HTTPException

RADIUS_KM = 5.0
# A requested 1-second device interval is not a delivery guarantee. Allow short
# GPS/network gaps while keeping silent drivers bounded by actual sample age.
GPS_FRESH_SECONDS = 15
NAMESPACE = "/customer-cars"
RECONCILE_SECONDS = 0.5
LOG = logging.getLogger(__name__)


def fresh_sample_time(user, now):
    try:
        values = [datetime.fromisoformat(str(user[key]).replace("Z", "+00:00"))
                  for key in ("last_location_at", "last_location_recorded_at")]
        values = [value if value.tzinfo else value.replace(tzinfo=timezone.utc) for value in values]
        if any((now - value).total_seconds() < -2 for value in values):
            return None
        oldest = min(values)
        return oldest.isoformat() if (now - oldest).total_seconds() < GPS_FRESH_SECONDS else None
    except (KeyError, TypeError, ValueError):
        return None


def position_bounds(lat, lng):
    """Indexed numeric bounding box over existing fields; exact distance follows.

    Avoids migrating the current MongoDB to Astra or requiring a new GeoJSON
    schema. Handles circles crossing the antimeridian and touching a pole.
    """
    angular = RADIUS_KM / 6371.0
    delta_lat = math.degrees(angular)
    query = {"last_lat": {"$gte": max(-90, lat - delta_lat), "$lte": min(90, lat + delta_lat)}}
    if abs(lat) + delta_lat >= 90:
        return query
    delta_lng = math.degrees(math.asin(min(1, math.sin(angular) / math.cos(math.radians(lat)))))
    lo, hi = lng - delta_lng, lng + delta_lng
    if lo < -180:
        query["$or"] = [{"last_lng": {"$gte": lo + 360}}, {"last_lng": {"$lte": hi}}]
    elif hi > 180:
        query["$or"] = [{"last_lng": {"$gte": lo}}, {"last_lng": {"$lte": hi - 360}}]
    else:
        query["last_lng"] = {"$gte": lo, "$lte": hi}
    return query


class LiveCarsStream:
    def __init__(self, app, *, authenticate, snapshot, parse, origins):
        self.authenticate, self.snapshot, self.parse = authenticate, snapshot, parse
        self.clients = {}
        self.dirty = asyncio.Event()
        self.sio = socketio.AsyncServer(
            async_mode="asgi", cors_allowed_origins=origins,
            max_http_buffer_size=8192, ping_interval=10, ping_timeout=20,
            logger=False, engineio_logger=False,
        )
        # Mount instead of wrapping FastAPI: existing middleware, routes, lifespan
        # and dependency overrides remain intact, including Uvicorn's server:app.
        app.mount("/socket.io", socketio.ASGIApp(self.sio, socketio_path=None))
        self.sio.on("connect", self.connect, namespace=NAMESPACE)
        self.sio.on("disconnect", self.disconnect, namespace=NAMESPACE)
        self.sio.on("cars:subscribe", self.subscribe, namespace=NAMESPACE)

    async def connect(self, sid, environ, auth):
        token = auth.get("token") if isinstance(auth, dict) else None
        if not isinstance(token, str) or not 1 <= len(token) <= 8192:
            return False
        try:
            caller = await self.authenticate(token)
        except HTTPException:
            return False
        if sum(c["user_id"] == caller["id"] for c in self.clients.values()) >= 3:
            return False
        self.clients[sid] = {"user_id": caller["id"], "token": token,
                             "body": None, "revision": 0, "last_subscribe": 0,
                             "lock": asyncio.Lock(), "connected_at": time.monotonic()}
        return True

    async def disconnect(self, sid, reason=None):
        self.clients.pop(sid, None)

    async def subscribe(self, sid, data):
        client = self.clients.get(sid)
        if not client:
            return {"ok": False}
        # Limit location probing and bound per-socket work. Ordinary customer GPS
        # updates are once per second; one socket owns exactly one 5 km circle.
        now = time.monotonic()
        if now - client["last_subscribe"] < 0.25:
            return {"ok": False, "error": "rate_limited"}
        client["last_subscribe"] = now
        try:
            if not isinstance(data, dict):
                raise ValueError()
            revision = data.get("subscription_id")
            if type(revision) is not int or revision <= client["revision"]:
                raise ValueError()
            body = self.parse(data)
        except (ValueError, TypeError):
            # Rejecting a new circle also invalidates the previous subscription.
            client["body"] = None
            await self.sio.emit("cars:error", {"error": "invalid_subscription"}, to=sid, namespace=NAMESPACE)
            return {"ok": False, "error": "invalid_subscription"}
        client.update(body=body, revision=revision)
        self.changed()
        return {"ok": True, "subscription_id": revision}

    async def refresh(self, sid, client):
        async with client["lock"]:
            if self.clients.get(sid) is not client or client["body"] is None:
                return
            body, revision = client["body"], client["revision"]
            try:
                # Revalidate role, disabled account, JWT expiry and revocation on
                # every snapshot, not just the initial WebSocket handshake.
                caller = await self.authenticate(client["token"])
            except HTTPException:
                await self.sio.emit("cars:error", {"error": "unauthorized"}, to=sid, namespace=NAMESPACE)
                await self.sio.disconnect(sid, namespace=NAMESPACE)
                return
            try:
                payload = await asyncio.wait_for(self.snapshot(body, caller), timeout=1.0)
            except Exception as exc:
                LOG.warning("Nearby snapshot failed: %s", type(exc).__name__)
                payload = {"cars": [], "gps_fresh_seconds": GPS_FRESH_SECONDS,
                           "server_time": datetime.now(timezone.utc).isoformat(), "error": "unavailable"}
            if self.clients.get(sid) is client and revision == client["revision"]:
                await self.sio.emit("cars:snapshot", {**payload, "subscription_id": revision}, to=sid, namespace=NAMESPACE)

    def changed(self):
        self.dirty.set()

    async def run(self):
        while True:
            try:
                await asyncio.wait_for(self.dirty.wait(), timeout=RECONCILE_SECONDS)
            except asyncio.TimeoutError:
                pass
            self.dirty.clear()
            pending = list(self.clients.items())
            await asyncio.gather(*(self.refresh(sid, client) for sid, client in pending))
            for sid, client in pending:
                if client["body"] is None and time.monotonic() - client["connected_at"] > 10:
                    await self.sio.disconnect(sid, namespace=NAMESPACE)

    async def close(self):
        for sid in list(self.clients):
            await self.sio.disconnect(sid, namespace=NAMESPACE)
        await self.sio.shutdown()
