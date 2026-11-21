import asyncio
import hashlib
import hmac
import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import mongomock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from driver_document_identity import PROOF, IdentityConfig, confirm_live_proof, identity_config, install_document_identity


START = "/driver/identity-verification/document/start"
WEBHOOK = "/webhooks/stripe/driver-identity"


@pytest.fixture
def identity_flow(monkeypatch, request):
    live = getattr(request, "param", False)
    raw = mongomock.MongoClient().db.users
    driver_id = raw.insert_one({"role": "driver", "approved": False, "profile_photo_path": "profile-fixture", "drivers_license_path": "licence-fixture"}).inserted_id
    users = AsyncMock(wraps=raw)
    config = IdentityConfig("rk_test_fixture", "whsec_fixture", live, "https://api-qa.snarapp.no/")
    snapshot = {
        "id": "vs_fixture", "object": "identity.verification_session", "type": "document", "livemode": live,
        "options": {"document": {"require_matching_selfie": True}}, "status": "requires_input",
        "url": "https://verify.stripe.com/start/fixture", "client_secret": "not-for-the-app",
    }

    def create(params, _options):
        snapshot["client_reference_id"] = params["client_reference_id"]
        assert params["options"]["document"] == {"require_matching_selfie": True, "allowed_types": ["driving_license"]}
        assert "metadata" not in params
        return snapshot.copy()

    sessions = SimpleNamespace(create=Mock(side_effect=create), retrieve=Mock(side_effect=lambda _: snapshot.copy()))
    monkeypatch.setattr(IdentityConfig, "client", lambda _: sessions)
    monkeypatch.setenv("QA_DRIVER_IDENTITY_ENABLED", "true")
    monkeypatch.setenv("QA_DRIVER_IDENTITY_STRIPE_KEY", config.key)
    monkeypatch.setenv("QA_DRIVER_IDENTITY_STRIPE_WEBHOOK_SECRET", config.webhook_secret)
    app = FastAPI()

    def current_driver():
        return {"id": str(driver_id)}

    if live:
        monkeypatch.setattr("driver_document_identity.identity_config", lambda _: config)
    install_document_identity(app, SimpleNamespace(users=users), current_driver, AsyncMock(),
                              "production" if live else "qa", lambda: "2030-01-01T00:00:00+00:00", AsyncMock())
    return TestClient(app), raw, driver_id, sessions, snapshot, config


def test_creates_one_hosted_session_without_storing_a_link_or_client_secret(identity_flow):
    client, users, driver_id, sessions, _, _ = identity_flow
    first = client.post(START)
    assert first.status_code == 200, first.text
    assert first.headers["cache-control"] == "no-store"
    assert first.json()["verification_url"].startswith("https://verify.stripe.com/")
    assert first.json()["proof"]["mode"] == "test"
    proof = users.find_one({"_id": driver_id})[PROOF]
    assert set(proof) == {"attempt", "status", "livemode", "session_id", "updated_at"}
    assert sessions.create.call_args.args[1]["idempotency_key"] == f"snar-driver-id-{proof['attempt']}"
    assert sessions.create.call_args.args[0]["return_url"].startswith("https://api-qa.snarapp.no/")
    second = client.post(START)
    assert second.status_code == 200, second.text
    sessions.create.assert_called_once()
    sessions.retrieve.assert_called_once_with(proof["session_id"])
    assert "client_secret" not in first.text
    assert "session_id" not in first.json()["proof"]


def test_signed_test_result_checks_provider_and_never_approves_driver(identity_flow):
    client, users, driver_id, sessions, snapshot, config = identity_flow
    assert client.post(START).status_code == 200
    snapshot["status"] = "verified"
    event = {"id": "evt_fixture", "object": "event", "livemode": False,
             "type": "identity.verification_session.verified", "data": {"object": snapshot}}

    def send(*, valid=True):
        body = json.dumps(event).encode()
        stamp = int(time.time())
        key = config.webhook_secret if valid else "invalid_fixture"
        signature = hmac.new(key.encode(), f"{stamp}.".encode() + body, hashlib.sha256).hexdigest()
        return client.post(WEBHOOK, content=body, headers={"Stripe-Signature": f"t={stamp},v1={signature}"})

    assert send(valid=False).status_code == 400
    assert users.find_one({"_id": driver_id})[PROOF]["status"] == "requires_input"
    event["livemode"] = True
    assert send().status_code == 400
    event["livemode"] = False
    assert send().status_code == 200
    driver = users.find_one({"_id": driver_id})
    assert driver[PROOF]["status"] == "verified"
    assert driver["approved"] is False
    assert "identity_verified_at" not in driver
    assert client.post(START).json()["verification_url"] is None
    assert send().status_code == 200
    sessions.retrieve.assert_called_once_with(snapshot["id"])


def test_qa_feature_rejects_a_live_key(monkeypatch):
    monkeypatch.setenv("QA_DRIVER_IDENTITY_ENABLED", "true")
    monkeypatch.setenv("QA_DRIVER_IDENTITY_STRIPE_KEY", "rk_live_fixture")
    monkeypatch.setenv("QA_DRIVER_IDENTITY_STRIPE_WEBHOOK_SECRET", "whsec_fixture")
    assert identity_config("qa") is None


def test_mismatched_session_and_hosted_urls_are_rejected(identity_flow):
    client, _, _, _, snapshot, _ = identity_flow
    snapshot["livemode"] = True
    assert client.post(START).status_code == 502
    snapshot["livemode"] = False
    snapshot["url"] = "https://verify.stripe.com.example.test/start/fixture"
    assert client.post(START).status_code == 502


def test_review_needs_the_live_proof_and_preserves_driver_approval_and_recheck():
    raw = mongomock.MongoClient().db.users
    users = AsyncMock(wraps=raw)
    driver_id = raw.insert_one({"role": "driver", "approved": False,
                                PROOF: {"status": "verified", "livemode": False, "session_id": "vs_fixture"}}).inserted_id

    def confirm():
        return asyncio.run(confirm_live_proof(users, str(driver_id), "vs_fixture", "reviewer", "2027-01-01T00:00:00+00:00"))

    assert confirm() is None
    raw.update_one({"_id": driver_id}, {"$set": {f"{PROOF}.livemode": True, "identity_recheck_reason": "pending"}})
    assert confirm() is None
    raw.update_one({"_id": driver_id}, {"$unset": {"identity_recheck_reason": ""}})
    assert confirm()["identity_verified_at"]
    driver = raw.find_one({"_id": driver_id})
    assert driver["approved"] is False
    assert driver["identity_verification_status"] == "verified"
    assert driver[PROOF]["reviewed_by"] == "reviewer"
    assert confirm() is None

@pytest.mark.parametrize("identity_flow", [True, False], indirect=True)
@pytest.mark.parametrize("enabled,matched,changed", [(False,True,False), (True,True,False), (True,False,False), (True,True,True)])
def test_automatic_identity_confirmation_requires_explicit_activation(identity_flow, enabled, matched, changed, monkeypatch):
    client, users, driver_id, sessions, snapshot, config = identity_flow
    prefix = "SNAR" if config.live else "QA"
    monkeypatch.setenv(f"{prefix}_DRIVER_PROFILE_MATCH_ENABLED", str(enabled).lower())
    match = AsyncMock(return_value=matched)
    monkeypatch.setattr("driver_document_identity.compare_driver_files", match)
    monkeypatch.setattr(IdentityConfig, "stripe_client", lambda self: Mock())
    assert client.post(START, json={"profile_match_consent": True}).status_code == 200
    if changed:
        users.update_one({"_id": driver_id}, {"$set":{"profile_photo_path":"replacement"}})
    snapshot["status"] = "verified"
    event = {"id": "evt_fixture", "object": "event", "livemode": config.live,
             "type": "identity.verification_session.verified", "data": {"object": snapshot}}
    body = json.dumps(event).encode()
    stamp = int(time.time())
    signature = hmac.new(config.webhook_secret.encode(), f"{stamp}.".encode() + body, hashlib.sha256).hexdigest()
    def deliver():
        return client.post(WEBHOOK, content=body, headers={"Stripe-Signature": f"t={stamp},v1={signature}"})
    assert deliver().status_code == 200
    driver = users.find_one({"_id": driver_id})
    assert driver[PROOF]["status"] == "verified"
    assert (driver.get("identity_verification_status") == "verified") == (config.live and enabled and matched and not changed)
    assert driver["approved"] is False
    assert deliver().status_code == 200
    assert users.find_one({"_id": driver_id}) == driver
    assert match.await_count == int(enabled and not changed)
    if enabled and changed:
        assert driver[PROOF]["profile_match"] == "manual_review"

def test_a_changed_image_invalidates_the_automatic_identity_binding():
    from driver_document_identity import profile_binding_current
    inputs = {"profile_photo_path":"registered-picture", "drivers_license_path":"registered-licence"}
    driver = {**inputs, PROOF: {"reviewed_by":"stripe_identity_profile_match", "comparison_inputs":inputs}}
    assert profile_binding_current(driver)
    for field in inputs:
        assert not profile_binding_current({**driver,field:"replacement"})
