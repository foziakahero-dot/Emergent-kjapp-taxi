import asyncio
import json
from datetime import datetime, date
from typing import Any, Awaitable, Callable

from bson import ObjectId
from fastapi import Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

SnapshotFn = Callable[[], Awaitable[Any]]


def _json_default(value: Any):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _sse(event: str, payload: Any) -> str:
    data = json.dumps(payload, default=_json_default, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n"


async def _stream(request: Request, snapshot: SnapshotFn, interval_seconds: float):
    last_payload: str | None = None
    heartbeat_elapsed = 0.0
    yield "retry: 3000\n\n"

    while True:
        if await request.is_disconnected():
            return

        try:
            payload = await snapshot()
            encoded = json.dumps(payload, default=_json_default, ensure_ascii=False, separators=(",", ":"))
            if encoded != last_payload:
                yield f"event: update\ndata: {encoded}\n\n"
                last_payload = encoded
                heartbeat_elapsed = 0.0
            elif heartbeat_elapsed >= 15.0:
                yield ": keepalive\n\n"
                heartbeat_elapsed = 0.0
        except asyncio.CancelledError:
            raise
        except Exception:
            # Never expose internal exception details to a mobile client. Polling remains the fallback.
            yield _sse("warning", {"message": "Sanntidsoppdatering midlertidig utilgjengelig"})

        await asyncio.sleep(interval_seconds)
        heartbeat_elapsed += interval_seconds


def install_sse(
    app,
    *,
    get_current_user,
    require_driver,
    NearbyCarsRequest,
    cars_nearby,
    get_trip,
    driver_pending,
    driver_current,
):
    @app.get("/api/sse/customer/cars")
    async def customer_cars_stream(
        request: Request,
        lat: float = Query(..., ge=-90, le=90),
        lng: float = Query(..., ge=-180, le=180),
        current=Depends(get_current_user),
    ):
        role = current.get("role", "user")
        if role not in ("user", "customer"):
            raise HTTPException(status_code=403, detail="Kun passasjerkonto")

        async def snapshot():
            return await cars_nearby(NearbyCarsRequest(lat=lat, lng=lng))

        return StreamingResponse(
            _stream(request, snapshot, 3.0),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @app.get("/api/sse/customer/trips/{trip_id}")
    async def customer_trip_stream(
        trip_id: str,
        request: Request,
        current=Depends(get_current_user),
    ):
        role = current.get("role", "user")
        if role not in ("user", "customer"):
            raise HTTPException(status_code=403, detail="Kun passasjerkonto")

        async def snapshot():
            # get_trip already enforces ownership/role visibility.
            return await get_trip(trip_id, current)

        return StreamingResponse(
            _stream(request, snapshot, 1.0),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @app.get("/api/sse/driver/events")
    async def driver_event_stream(
        request: Request,
        current=Depends(require_driver),
    ):
        async def snapshot():
            current_trip, pending = await asyncio.gather(
                driver_current(current),
                driver_pending(current),
            )
            return {"current": current_trip, "pending": pending}

        return StreamingResponse(
            _stream(request, snapshot, 1.5),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
