"""KJAPP backend entrypoint.

The existing backend stays intact in server_core.py. This thin wrapper only installs
P0 SSE routes so beta hardening does not rewrite or fork the established FastAPI API.
"""
import server_core as _core
from server_core import *  # noqa: F401,F403
from sse_runtime import install_sse

install_sse(
    app,
    get_current_user=get_current_user,
    require_driver=require_driver,
    NearbyCarsRequest=NearbyCarsRequest,
    cars_nearby=cars_nearby,
    get_trip=get_trip,
    driver_pending=driver_pending,
    driver_current=driver_current,
)


def __getattr__(name):
    # Preserve access to private helpers used by existing tests/tools.
    return getattr(_core, name)
