"""Offline regression checks using the app's normal HTTP handlers and isolated data."""
import asyncio
import secrets

import httpx
import pyotp
import pytest
from starlette.testclient import TestClient
from starlette.responses import JSONResponse
from starlette.websockets import WebSocketDisconnect

from edge_origin import EdgeOriginMiddleware
from test_beta_panel_flow import panel_db
from test_partner_approval import server


def test_first_enrollment_and_recovery_session(panel_db):
    account = panel_db.users.find_one({"role": "superadmin"})
    panel_db.users.update_one({"_id": account["_id"]}, {"$unset": {"totp_enabled": "", "totp_secret": ""}})

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),
                                     base_url="https://qa.example") as c:
            credentials = {"email": account["email"], "password": "panel-test-password"}
            first = (await c.post("/api/auth/login", json=credentials)).json()["token"]
            before = {"Authorization": "Bearer " + first}
            setup = await c.post("/api/auth/2fa/setup", headers=before)
            code = pyotp.TOTP(setup.json()["secret"]).now()
            enabled = await c.post("/api/auth/2fa/enable", headers=before, json={"code": code})
            assert enabled.status_code == 200 and enabled.headers["cache-control"] == "no-store"
            after = {"Authorization": "Bearer " + enabled.json()["token"]}
            assert (await c.get("/api/auth/me", headers=before)).status_code == 401
            assert (await c.get("/api/auth/me", headers=after)).status_code == 200
            assert (await c.post("/api/auth/2fa/setup", headers=after)).status_code == 409
            challenge = (await c.post("/api/auth/login", json=credentials)).json()["twofa_token"]
            other_challenge = (await c.post("/api/auth/login", json=credentials)).json()["twofa_token"]
            backup = enabled.json()["backup_codes"][0]
            async def verify(challenge_id):
                return await c.post("/api/auth/2fa/verify-login", json={"twofa_token": challenge_id, "code": backup})
            results = await asyncio.gather(verify(challenge), verify(other_challenge))
            assert sorted(r.status_code for r in results) == [200, 401]
            used = (challenge, other_challenge)[next(i for i, r in enumerate(results) if r.status_code == 200)]
            retry = await c.post("/api/auth/2fa/verify-login", json={"twofa_token": used, "code": code})
            assert retry.status_code == 401
            assert len(panel_db.users.find_one({"_id": account["_id"]})["totp_backup_codes"]) == 7
    asyncio.run(exercise())


def test_error_responses_keep_private_input_out_of_logs(caplog):
    from starlette.requests import Request
    from types import SimpleNamespace
    private = "synthetic-private-value"
    request = Request({"type": "http", "method": "GET", "path": "/test/" + private,
                       "route": SimpleNamespace(path="/test/{value}"), "headers": []})

    async def fail(_):
        raise RuntimeError(private)
    result = asyncio.run(server.request_id_middleware(request, fail))
    assert result.status_code == 500 and result.headers["x-request-id"]
    assert private not in caplog.text and private.encode() not in result.body
    assert "/test/{value}" in caplog.text
    with _without_lifespan() as c:
        response = c.post("/api/auth/login", json={"password": [private]})
        assert response.status_code == 422
        assert private not in response.text
        assert response.headers["x-content-type-options"] == "nosniff"


def _without_lifespan():
    # Entering TestClient as a context would start real background services.
    from contextlib import closing
    return closing(TestClient(server.app))


def test_webhook_stops_before_dispatch_on_missing_config_or_size(monkeypatch):
    with _without_lifespan() as c:
        monkeypatch.setattr(server, "STRIPE_WEBHOOK_SECRET", "")
        assert c.post("/api/stripe/webhook", content=b"{}").status_code == 503
        monkeypatch.setattr(server, "STRIPE_WEBHOOK_SECRET", secrets.token_urlsafe(32))
        assert c.post("/api/stripe/webhook", content=b"{}").status_code == 400
        assert c.post("/api/stripe/webhook", headers={"stripe-signature": "fixture"},
                      content=b"x" * (1024 * 1024 + 1)).status_code == 413


@pytest.mark.parametrize("mode", ["off", "observe", "enforce"])
def test_edge_http_and_socket_contract(mode):
    key = secrets.token_hex(32)
    async def downstream(scope, receive, send):
        if mode != "off":
            assert all(name != b"x-snar-edge-key" for name, _ in scope["headers"])
        if scope["type"] == "websocket":
            await send({"type": "websocket.accept"})
            await send({"type": "websocket.close"})
        else:
            await JSONResponse({"ok": True})(scope, receive, send)
    from contextlib import closing
    with closing(TestClient(EdgeOriginMiddleware(downstream, mode=mode, shared_key=key))) as c:
        assert c.get("/api/health").status_code == 200
        assert c.get("/api/ready").status_code == (403 if mode == "enforce" else 200)
        assert c.post("/api/stripe/webhook", headers={"x-snar-edge-key":key}).status_code == 200
        if mode == "enforce":
            with pytest.raises(WebSocketDisconnect), c.websocket_connect("/socket.io/"):
                pass
        with c.websocket_connect("/socket.io/", headers={"x-snar-edge-key":key}):
            pass


def test_admin_write_needs_fresh_login_and_trusted_cookie_origin(panel_db):
    from datetime import datetime, timezone
    account = panel_db.users.find_one({"role": "superadmin"})
    now = datetime.now(timezone.utc).timestamp()
    token = lambda at: server.create_access_token(str(account["_id"]), account["email"],
                                                  mfa_verified=True, authenticated_at=at)
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),
                                     base_url="https://qa.example") as c:
            for at in (None, now - 901, now + 100):
                r = await c.post("/api/admin/refunds", json={}, headers={"Authorization": "Bearer " + token(at)})
                assert r.status_code == 401
            c.cookies.set("access_token", token(now))
            r = await c.post("/api/admin/refunds", json={}, headers={"Origin": "https://other.example"})
            assert r.status_code == 403
            # A freshly authenticated caller reaches normal request validation.
            r = await c.post("/api/admin/refunds", json={}, headers={"Origin": "https://qa.example"})
            assert r.status_code == 422
    asyncio.run(exercise())


def test_stripe_sdk_verifies_signed_test_event_without_network(monkeypatch):
    import hashlib
    import hmac
    import json
    import time
    from unittest.mock import AsyncMock
    key = secrets.token_hex(32)
    monkeypatch.setattr(server, "STRIPE_WEBHOOK_SECRET", key)
    monkeypatch.setattr(server.stripe, "api_key", "")
    handler = AsyncMock(return_value=True)
    monkeypatch.setattr(server.ride_reservations, "webhook", handler)
    body = json.dumps({"id": "evt_fixture", "object": "event", "type": "fixture.event",
                       "livemode": False, "data": {"object": {}}}).encode()
    stamp = str(int(time.time()))
    digest = hmac.new(key.encode(), stamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    headers = {"Stripe-Signature": f"t={stamp},v1={digest}"}
    with _without_lifespan() as c:
        assert c.post("/api/stripe/webhook", content=body + b" ", headers=headers).status_code == 400
        handler.assert_not_awaited()
        r = c.post("/api/stripe/webhook", content=body, headers=headers)
        assert r.status_code == 200, r.text
        handler.assert_awaited_once()
