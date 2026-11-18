"""Cryptographic auth and HTTP contracts. Repository is a fake, not a live DB test."""
import time

import jwt
import psycopg
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from gateway import Identity, Settings, create_app


@pytest.fixture(scope="module")
def keys():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = private.public_key().public_bytes(serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    return private, public


class FakeRepository:
    def __init__(self):
        self.calls = []
        self.error = None

    def open(self): pass
    def close(self): pass

    def execute(self, identity, operation, args):
        self.calls.append((identity, operation, args))
        if self.error:
            raise self.error
        if operation in {"me", "my_vehicles", "my_rides"} or identity.subject == "admin":
            return {"rows": [], "operation": operation}
        raise psycopg.errors.InsufficientPrivilege("private SQL detail")


@pytest.fixture
def context(keys):
    repo = FakeRepository()
    settings = Settings("https://qa.example.invalid", "snar-admin-qa", keys[1])
    with TestClient(create_app(settings, repo)) as client:
        yield client, repo, keys[0]


def auth(context, subject="admin", **overrides):
    now = int(time.time())
    claims = {"iss": "https://qa.example.invalid", "aud": "snar-admin-qa", "sub": subject,
        "iat": now, "exp": now + 900, **overrides}
    return {"Authorization": "Bearer " + jwt.encode(claims, context[2], algorithm="RS256")}


def test_all_data_routes_require_verified_token(context):
    client, repo, _ = context
    for path in ["/me", "/admin/dashboard", "/admin/drivers", "/admin/vehicles", "/admin/prices",
                 "/admin/rides/active", "/driver/vehicles", "/driver/rides"]:
        assert client.get(path).status_code == 401
    assert not repo.calls


@pytest.mark.parametrize("claim,value", [("iss", "https://evil.example.invalid"), ("aud", "other-app"),
    ("exp", 1), ("iat", 9999999999), ("exp", int(time.time()) + 4000), ("sub", ""), ("sub", 123)])
def test_invalid_claims_rejected_before_database(context, claim, value):
    client, repo, _ = context
    response = client.get("/me", headers=auth(context, **{claim: value}))
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert not repo.calls


def test_forged_signature_and_unsigned_jwt_rejected(context):
    client, repo, _ = context
    valid = auth(context)["Authorization"].split(" ", 1)[1]
    payload = jwt.decode(valid, options={"verify_signature": False})
    wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    for token in [jwt.encode(payload, wrong_key, algorithm="RS256"), jwt.encode(payload, "", algorithm="none")]:
        assert client.get("/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert not repo.calls


def test_missing_required_claim_rejected(context):
    client, repo, key = context
    token = jwt.encode({"iss": "https://qa.example.invalid", "aud": "snar-admin-qa", "sub": "admin"}, key, algorithm="RS256")
    assert client.get("/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert not repo.calls


def test_token_role_claim_and_query_actor_id_cannot_elevate_driver(context):
    client, repo, _ = context
    response = client.get("/admin/drivers?admin_id=101", headers=auth(context, "driver-a", role="ADMIN"))
    assert response.status_code == 403
    assert repo.calls[0][0] == Identity("https://qa.example.invalid", "driver-a")
    assert "private SQL detail" not in response.text


def test_own_data_query_does_not_accept_other_driver_id(context):
    client, repo, _ = context
    response = client.get("/driver/vehicles?driver_id=301", headers=auth(context, "driver-a"))
    assert response.status_code == 200
    assert repo.calls[-1] == (Identity("https://qa.example.invalid", "driver-a"), "my_vehicles", ())


def test_driver_action_passes_version_and_never_client_actor(context):
    client, repo, _ = context
    response = client.post("/admin/drivers/11/status", headers=auth(context),
        json={"version": 0, "action": "approved"})
    assert response.status_code == 200
    assert repo.calls[-1][1:] == ("set_driver_status", (11, 0, "approved", None))
    response = client.post("/admin/drivers/11/status", headers=auth(context),
        json={"version": 0, "action": "approved", "admin_id": 501})
    assert response.status_code == 422


@pytest.mark.parametrize("body", [{"version": None, "action": "approved"},
    {"version": "0", "action": "approved"}, {"version": True, "action": "approved"},
    {"version": -1, "action": "approved"}, {"version": 0, "action": "deleted"}])
def test_malformed_action_rejected(context, body):
    client, repo, _ = context
    assert client.post("/admin/drivers/11/status", headers=auth(context), json=body).status_code == 422
    assert not repo.calls


@pytest.mark.parametrize("error,expected", [(psycopg.errors.SerializationFailure("private"), 409),
    (psycopg.errors.NoDataFound("private"), 404), (psycopg.errors.InvalidParameterValue("private"), 422),
    (psycopg.OperationalError("private-host-and-password"), 503)])
def test_database_errors_use_safe_status_and_do_not_leak(context, error, expected):
    client, repo, _ = context
    repo.error = error
    response = client.get("/admin/dashboard", headers=auth(context))
    assert response.status_code == expected
    assert "private" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_search_is_only_bound_as_data_and_limit_is_validated(context):
    client, repo, _ = context
    assert client.get("/admin/drivers", params={"search": "' OR true--"}, headers=auth(context)).status_code == 200
    assert repo.calls[-1][2] == ("pending", "' OR true--", 25, 0)
    assert client.get("/admin/drivers?limit=1000", headers=auth(context)).status_code == 422


def test_no_unsafe_cors_or_invalid_signing_key(keys):
    with pytest.raises(ValueError):
        Settings("https://qa.example.invalid", "app", keys[1], origins=("*",))
    with pytest.raises(ValueError):
        Settings("http://qa.example.invalid", "app", keys[1])
    with pytest.raises(ValueError):
        Settings("https://qa.example.invalid", "app", "not-a-key")
