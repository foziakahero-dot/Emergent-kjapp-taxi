"""KJAPP backend entrypoint.

The established backend implementation lives unchanged in server_core.py.  This thin
entrypoint only adds the P0 Server-Sent Events router, then exposes the same FastAPI
`app` and module globals expected by the existing deployment and test suite.
"""

from fastapi import APIRouter
import server_core as _core
from sse_routes import install_sse_routes

# Preserve the public/internal module surface used by existing tests, scripts and imports.
for _name, _value in vars(_core).items():
    if not _name.startswith('__'):
        globals()[_name] = _value

app = _core.app

# Use a dedicated router so the already-registered REST routes are not included twice.
_sse_api = APIRouter(prefix='/api')
install_sse_routes(
    api=_sse_api,
    db=_core.db,
    get_current_user=_core.get_current_user,
    require_driver=_core.require_driver,
    active_trip=_core.active_trip,
    cars_nearby=_core.cars_nearby,
    nearby_request_cls=_core.NearbyCarsRequest,
    driver_pending=_core.driver_pending,
    driver_current=_core.driver_current,
)
app.include_router(_sse_api)


if __name__ == '__main__':
    import uvicorn

    uvicorn.run('server:app', host='0.0.0.0', port=8001, reload=True)
