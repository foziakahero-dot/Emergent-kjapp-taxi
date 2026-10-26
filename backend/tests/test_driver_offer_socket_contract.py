"""Real-time driver offer signal: authenticated, content-free, and fired on every dispatch path."""
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1] / "server.py"
SOURCE = SERVER.read_text(encoding="utf-8")


def _block(name: str) -> str:
    start = SOURCE.index(f"async def {name}")
    end = SOURCE.find("\nasync def ", start + 1)
    return SOURCE[start:] if end < 0 else SOURCE[start:end]


def test_socket_route_is_registered():
    assert '@app.websocket("/api/driver/ws")' in SOURCE


def test_socket_authenticates_with_shared_token_rules():
    block = _block("driver_offer_socket")
    assert "_user_from_token(" in block
    assert 'user.get("role") != "driver"' in block
    assert "query_params" not in block


def test_http_auth_and_socket_share_one_validator():
    assert "return await _user_from_token(_auth_token_from_request(request))" in _block("get_current_user")
    validator = _block("_user_from_token")
    assert "_session_is_current" in validator
    assert "_session_is_revoked" in validator


def test_signal_carries_no_trip_data():
    block = _block("notify_driver_offer_signal")
    assert '{"type": "offer"}' in block
    assert "trip" not in block.split('"""')[-1]


def test_both_dispatch_paths_signal_drivers():
    block = _block("offer_trip_to_next_driver")
    assert "notify_driver_offer_signal(c[\"id\"])" in block
    assert "notify_driver_offer_signal(nxt[\"id\"])" in block
