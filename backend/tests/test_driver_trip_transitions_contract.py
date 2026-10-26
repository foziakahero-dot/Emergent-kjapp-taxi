"""Contract checks for the driver trip lifecycle: accept -> start -> arrive / no-show.

Each transition must be owned by the assigned driver, require the previous
status, and be written atomically so two taps cannot double-move a trip.
"""
from pathlib import Path
import ast

SERVER = Path(__file__).resolve().parents[1] / "server.py"
SOURCE = SERVER.read_text(encoding="utf-8")


def _block(name: str) -> str:
    start = SOURCE.index(f"async def {name}(")
    end = SOURCE.find("\n@api.", start + 1)
    return SOURCE[start:end if end > 0 else len(SOURCE)]


def test_server_parses():
    ast.parse(SOURCE)


def test_driver_transition_routes_exist_and_require_driver():
    for route, fn in [
        ('/driver/trip/{trip_id}/start")', "driver_start"),
        ('/driver/trip/{trip_id}/no-show")', "driver_no_show"),
        ('/driver/trip/{trip_id}/arrive")', "driver_arrive"),
    ]:
        assert f'@api.post("{route}' in SOURCE, route
        assert "Depends(require_driver)" in _block(fn).split("\n", 1)[0], fn


def test_start_requires_at_pickup_fresh_gps_and_atomic_write():
    body = _block("driver_start")
    assert '"status": "at_pickup"' in body
    assert "Oppdater GPS-posisjonen" in body
    assert "require_reserved(trip)" in body
    assert '_real_trip_filter({"trip_id": trip_id, "driver_id": driver_id, "status": "at_pickup"})' in body
    assert '"status": "in_trip"' in body
    assert "Turen endret status før den kunne startes" in body


def test_no_show_enforces_server_side_wait_and_releases_driver():
    body = _block("driver_no_show")
    assert 'trip.get("status") != "at_pickup"' in body
    assert "waited_minutes < NO_SHOW_WAIT_MINUTES" in body
    assert '"status": "at_pickup"})' in body
    assert '"status": "cancelled"' in body
    assert '"active_trip_id": trip_id' in body


def test_arrive_requires_started_trip_and_is_idempotent():
    body = _block("driver_arrive")
    assert 'trip.get("status") != "in_trip"' in body
    assert 'trip.get("status") in ("arrived", "completed", "rated")' in body
    assert '"status": "arrived"' in body
