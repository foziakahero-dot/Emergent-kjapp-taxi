import asyncio
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "kjapp_test")
os.environ.setdefault("JWT_SECRET", "unit-test-secret-that-is-long-enough-for-hs256")
os.environ.setdefault("APP_ENV", "development")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server  # noqa: E402


def test_qa_google_and_apple_configuration_does_not_enable_shared_oauth(monkeypatch):
    monkeypatch.setattr(server, "APP_ENV", "qa")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "shared-google-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "shared-google-client-secret")
    monkeypatch.setenv("APPLE_CLIENT_ID", "shared-apple-client-id")
    monkeypatch.setenv("APPLE_BUNDLE_ID", "no.nexorahub.kjapp.customer")

    google = asyncio.run(server.google_oauth_config())
    apple = asyncio.run(server.apple_config())

    assert google["enabled"] is False
    assert google["client_id"] == ""
    assert apple["enabled"] is False
    assert apple["client_id"] == ""
    assert apple["bundle_id"] == ""


@pytest.mark.parametrize(
    ("handler", "body"),
    [
        ("google_session", server.GoogleSessionRequest(session_id="test-session")),
        (
            "google_oauth_code",
            server.GoogleCodeRequest(code="test-code", code_verifier="test-verifier", redirect_uri="kjapp://auth"),
        ),
        ("apple_signin", server.AppleSignInRequest(identity_token="synthetic-token-value")),
    ],
)
def test_qa_oauth_exchange_routes_fail_before_provider_access(monkeypatch, handler, body):
    monkeypatch.setattr(server, "APP_ENV", "qa")

    async def forbidden_provider_call(*_args, **_kwargs):
        raise AssertionError("QA OAuth route reached a provider or rate-limit dependency")

    monkeypatch.setattr(server, "_enforce_rate_limit", forbidden_provider_call)
    request = SimpleNamespace()
    response = SimpleNamespace()

    with pytest.raises(HTTPException) as error:
        asyncio.run(getattr(server, handler)(body, request, response))

    assert error.value.status_code == 503
    assert "QA-spesifikk" in error.value.detail


def test_qa_email_and_push_delivery_are_suppressed(monkeypatch):
    monkeypatch.setattr(server, "APP_ENV", "qa")
    monkeypatch.setenv("SENDGRID_API_KEY", "non-secret-test-placeholder")

    async def forbidden_push(*_args, **_kwargs):
        raise AssertionError("QA push reached an external provider")

    monkeypatch.setattr(server, "send_native_push", forbidden_push)

    assert server.send_email("qa@example.test", "Subject", "body") is False
    assert asyncio.run(server.send_push_to_user("synthetic-user", "Title", "Body")) is None
