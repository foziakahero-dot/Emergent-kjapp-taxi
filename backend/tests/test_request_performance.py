"""An expensive password check must not stall unrelated requests."""
import asyncio
import os
import sys
import threading
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from bson import ObjectId

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "kjapp_test")
os.environ.setdefault("JWT_SECRET", "unit-test-secret-that-is-long-enough-for-hs256")
os.environ.setdefault("APP_ENV", "development")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


@pytest.mark.parametrize("valid,disabled,status", [(True, False, 200), (False, False, 401), (True, True, 401)])
def test_health_responds_while_login_checks_password(monkeypatch, valid, disabled, status):
    started, release = threading.Event(), threading.Event()
    user = {"_id": ObjectId(), "email": "performance@example.invalid", "role": "user",
            "password_hash": "fixture", "disabled": disabled}

    def slow_check(*_args):
        started.set()
        release.wait(2)
        return valid

    async def identity(value, *_args, **_kwargs):
        return value

    monkeypatch.setattr(server, "db", SimpleNamespace(
        users=SimpleNamespace(find_one=AsyncMock(return_value=user)),
        command=AsyncMock(return_value={"ok": 1}),
    ))
    monkeypatch.setattr(server, "verify_password", slow_check)
    monkeypatch.setattr(server, "_login_blocked", AsyncMock(return_value=False))
    monkeypatch.setattr(server, "_record_failed_login", AsyncMock())
    monkeypatch.setattr(server, "_clear_failed_logins", AsyncMock())
    monkeypatch.setattr(server, "_apply_driver_identity_risk", identity)

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test") as client:
            login = asyncio.create_task(client.post("/api/auth/login", json={
                "email": user["email"], "password": "fixture", "client": "customer"}))
            try:
                assert await asyncio.to_thread(started.wait, 1)
                health = await asyncio.wait_for(client.get("/api/health"), .5)
                assert health.status_code == 200
                assert not login.done(), "Password work blocked health until login finished"
                assert health.headers["server-timing"].startswith("app;dur=")
                assert len(health.headers["x-request-id"]) == 12
            finally:
                release.set()
            response = await login
            assert response.status_code == status
            if status == 401:
                assert response.json()["detail"] == "Feil innlogging"

    asyncio.run(run())
