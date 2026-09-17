import asyncio
import json
from typing import Optional

from fastapi import Depends, Request
from fastapi.responses import StreamingResponse


def install_sse_routes(
    api,
    get_current_user,
    require_driver,
    active_trip,
    cars_nearby,
    nearby_request_cls,
    driver_pending,
    driver_current,
):
    def encode_event(event: str, payload: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}\n\n"

    @api.get('/events/customer')
    async def customer_events(
        request: Request,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        current=Depends(get_current_user),
    ):
        async def stream():
            previous = None
            idle_ticks = 0
            while not await request.is_disconnected():
                try:
                    trip = await active_trip(current)
                    nearby = {'cars': []}
                    if lat is not None and lng is not None:
                        nearby = await cars_nearby(nearby_request_cls(lat=lat, lng=lng))
                    payload = {
                        'active_trip': trip,
                        'cars': nearby.get('cars', []) if isinstance(nearby, dict) else [],
                    }
                    fingerprint = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
                    if fingerprint != previous:
                        previous = fingerprint
                        idle_ticks = 0
                        yield encode_event('customer', payload)
                    else:
                        idle_ticks += 1
                        if idle_ticks >= 15:
                            idle_ticks = 0
                            yield ': keep-alive\n\n'
                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    yield encode_event('error', {'message': 'Midlertidig realtime-feil', 'code': exc.__class__.__name__})
                    await asyncio.sleep(2)
                await asyncio.sleep(1)

        return StreamingResponse(
            stream(),
            media_type='text/event-stream',
            headers={
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        )

    @api.get('/events/driver')
    async def driver_events(request: Request, current=Depends(require_driver)):
        async def stream():
            previous = None
            idle_ticks = 0
            while not await request.is_disconnected():
                try:
                    pending = await driver_pending(current)
                    current_trip = await driver_current(current)
                    payload = {
                        'pending': pending,
                        'current': current_trip,
                    }
                    fingerprint = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
                    if fingerprint != previous:
                        previous = fingerprint
                        idle_ticks = 0
                        yield encode_event('driver', payload)
                    else:
                        idle_ticks += 1
                        if idle_ticks >= 15:
                            idle_ticks = 0
                            yield ': keep-alive\n\n'
                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    yield encode_event('error', {'message': 'Midlertidig realtime-feil', 'code': exc.__class__.__name__})
                    await asyncio.sleep(2)
                await asyncio.sleep(1)

        return StreamingResponse(
            stream(),
            media_type='text/event-stream',
            headers={
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        )
