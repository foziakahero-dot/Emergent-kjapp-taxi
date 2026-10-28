"""Validate the actual authenticated polling/push transport, not an absent legacy socket.

Atomic one-driver dispatch, decline/timeout progression and authorization-release
behavior are exercised by test_sequential_dispatch.py and test_ride_reservations.py.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT / 'backend/server.py').read_text()
DRIVER = (ROOT / 'driver-app/app/(driver)/home.tsx').read_text()
API = (ROOT / 'driver-app/src/lib/api.ts').read_text()


def block(name):
    start = SOURCE.index(f'async def {name}')
    end = SOURCE.find('\nasync def ', start + 1)
    return SOURCE[start:] if end < 0 else SOURCE[start:end]


def test_pending_uses_driver_auth_and_only_current_nonexpired_offer():
    pending = block('driver_pending')
    assert 'Depends(require_driver)' in pending
    assert '"offer_driver_id": current["id"]' in pending
    assert '"offer_expires_at": {"$gt":' in pending
    assert '"server_time": datetime.now(timezone.utc).isoformat()' in pending


def test_http_offer_auth_checks_session_revocation_and_password_reset():
    current = block('get_current_user')
    assert '_session_is_current(payload, user)' in current
    assert '_session_is_revoked(payload)' in current
    assert 'user.get("disabled")' in current
    assert 'payload.get("type") == "2fa"' in current


def test_client_polls_canonical_endpoint_and_refreshes_after_foreground():
    assert "api.get('/driver/pending')" in API
    assert 'setInterval(poll, 1000)' in DRIVER
    assert "state === 'active'" in DRIVER
    assert 'projectedOfferTime' in DRIVER


def test_offer_push_follows_successful_atomic_offer_claim():
    offer = block('offer_trip_to_next_driver')
    assert '"offer_seq": trip.get("offer_seq")' in offer
    assert '"offer_driver_id": nxt["id"]' in offer
    assert offer.index('if res.modified_count == 0:') < offer.index('await send_push_to_user(')
    assert 'nxt["id"], title' in offer
