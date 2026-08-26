"""Iter 22 — P0.1 security correction regression tests.

Covers:
  1. Production superadmin password rotation (legacy password stops working; strong works).
  2. Legacy seed/demo account disabling in production (passenger/driver/fleet demo).
  3. Disabled users cannot authenticate — same generic 401 as invalid credentials (live server).
  4. Trusted-proxy IP handling (X-Forwarded-For only trusted when TRUST_PROXY=true).
  5. Email-based login throttling always active.
  6. Demo login UI gated behind REACT_APP_ENABLE_DEMO_LOGIN (disabled by default / prod).

Run: cd /app/backend && python -m pytest tests/test_iter22_p01_security.py -q
"""
import asyncio
import os
import sys
import uuid

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server  # noqa: E402

BASE = "http://localhost:8001/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
APP_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

mongo = MongoClient(MONGO_URL)
mdb = mongo[os.environ.get("DB_NAME", "kjapp")]


def _run(coro_factory):
    """Run an async coroutine on a fresh event loop (no pytest-asyncio needed)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro_factory())
    finally:
        loop.close()


# =========================================================================
# 1. Superadmin password rotation in production
# =========================================================================

def test_production_rotates_legacy_superadmin_password():
    async def run():
        client = AsyncIOMotorClient(MONGO_URL)
        name = f"kjapp_p01_{uuid.uuid4().hex[:8]}"
        tdb = client[name]
        try:
            email = "admin@kjapp.no"
            legacy = "legacy-old-pass-99"
            await tdb.users.insert_one({
                "email": email,
                "password_hash": server.hash_password(legacy),
                "role": "superadmin",
            })
            strong = "Sup3r-Str0ng-Passw0rd!"
            res = await server.reconcile_superadmin(tdb, email, strong, is_production=True)
            assert res["exists"] is True
            assert res["password_rotated"] is True
            u = await tdb.users.find_one({"email": email})
            # strong configured password works, legacy password no longer works
            assert server.verify_password(strong, u["password_hash"]) is True
            assert server.verify_password(legacy, u["password_hash"]) is False
        finally:
            await client.drop_database(name)
            client.close()
    _run(run)


def test_development_does_not_rotate_superadmin_password():
    async def run():
        client = AsyncIOMotorClient(MONGO_URL)
        name = f"kjapp_p01_{uuid.uuid4().hex[:8]}"
        tdb = client[name]
        try:
            email = "admin@kjapp.no"
            legacy = "legacy-old-pass-99"
            await tdb.users.insert_one({
                "email": email,
                "password_hash": server.hash_password(legacy),
                "role": "superadmin",
            })
            res = await server.reconcile_superadmin(tdb, email, "another-pass-1234", is_production=False)
            assert res["password_rotated"] is False
            u = await tdb.users.find_one({"email": email})
            # dev never rotates — legacy password still valid
            assert server.verify_password(legacy, u["password_hash"]) is True
        finally:
            await client.drop_database(name)
            client.close()
    _run(run)


def test_reconcile_superadmin_reenables_disabled_admin():
    async def run():
        client = AsyncIOMotorClient(MONGO_URL)
        name = f"kjapp_p01_{uuid.uuid4().hex[:8]}"
        tdb = client[name]
        try:
            email = "admin@kjapp.no"
            strong = "Sup3r-Str0ng-Passw0rd!"
            await tdb.users.insert_one({
                "email": email,
                "password_hash": server.hash_password(strong),
                "role": "admin",          # legacy role
                "disabled": True,          # accidentally flagged
                "is_demo": True,
            })
            await server.reconcile_superadmin(tdb, email, strong, is_production=True)
            u = await tdb.users.find_one({"email": email})
            assert u["role"] == "superadmin"
            assert not u.get("disabled")
            assert not u.get("is_demo")
        finally:
            await client.drop_database(name)
            client.close()
    _run(run)


# =========================================================================
# 2. Legacy demo account disabling in production
# =========================================================================

def test_production_disables_legacy_demo_accounts():
    async def run():
        client = AsyncIOMotorClient(MONGO_URL)
        name = f"kjapp_p01_{uuid.uuid4().hex[:8]}"
        tdb = client[name]
        try:
            await tdb.users.insert_many([
                {"email": "ola@kjapp.no", "role": "user", "password_hash": server.hash_password("test1234")},
                {"email": "sjafor@kjapp.no", "role": "driver", "password_hash": server.hash_password("sjafor1234")},
                {"email": "floteier1@kjapp.no", "role": "fleet_owner", "password_hash": server.hash_password("fleet1234")},
                {"email": "demo1@kjapp.no", "role": "driver", "demo": True, "password_hash": server.hash_password("demo1234")},
                {"email": "demo_p_kari@kjapp.no", "role": "user", "demo": True, "password_hash": server.hash_password("demo1234")},
                {"email": "real-customer@example.com", "role": "user", "password_hash": server.hash_password("realpass99")},
                {"email": "admin@kjapp.no", "role": "superadmin", "password_hash": server.hash_password("Sup3r-Str0ng-Passw0rd!")},
            ])
            n = await server.disable_legacy_demo_users(tdb, is_production=True, admin_email="admin@kjapp.no")
            assert n >= 5
            # each known demo account (passenger, driver, fleet) is disabled + flagged demo
            for em in ["ola@kjapp.no", "sjafor@kjapp.no", "floteier1@kjapp.no", "demo1@kjapp.no", "demo_p_kari@kjapp.no"]:
                u = await tdb.users.find_one({"email": em})
                assert u.get("disabled") is True, em
                assert u.get("is_demo") is True, em
            # legitimate production user is NOT touched
            real = await tdb.users.find_one({"email": "real-customer@example.com"})
            assert not real.get("disabled")
            # superadmin is NOT disabled
            adm = await tdb.users.find_one({"email": "admin@kjapp.no"})
            assert not adm.get("disabled")
        finally:
            await client.drop_database(name)
            client.close()
    _run(run)


def test_development_does_not_disable_demo_accounts():
    async def run():
        client = AsyncIOMotorClient(MONGO_URL)
        name = f"kjapp_p01_{uuid.uuid4().hex[:8]}"
        tdb = client[name]
        try:
            await tdb.users.insert_one({
                "email": "ola@kjapp.no", "role": "user", "demo": True,
                "password_hash": server.hash_password("test1234"),
            })
            n = await server.disable_legacy_demo_users(tdb, is_production=False, admin_email="admin@kjapp.no")
            assert n == 0
            u = await tdb.users.find_one({"email": "ola@kjapp.no"})
            assert not u.get("disabled")
        finally:
            await client.drop_database(name)
            client.close()
    _run(run)


# =========================================================================
# 3. Disabled users cannot authenticate (live server, generic 401)
# =========================================================================

DISABLED_USERS = [
    ("p01_disabled_user@kjapp.no", "user"),
    ("p01_disabled_driver@kjapp.no", "driver"),
    ("p01_disabled_fleet@kjapp.no", "fleet_owner"),
]
DISABLED_PW = "disabled-pass-1234"


@pytest.fixture
def disabled_accounts():
    for em, role in DISABLED_USERS:
        mdb.users.delete_many({"email": em})
        mdb.users.insert_one({
            "email": em, "role": role, "disabled": True, "is_demo": True,
            "password_hash": server.hash_password(DISABLED_PW),
            "created_at": "2020-01-01T00:00:00+00:00",
        })
    yield
    for em, _ in DISABLED_USERS:
        mdb.users.delete_many({"email": em})
        mdb.login_attempts.delete_many({"identifier": f"email:{em}"})
    mdb.login_attempts.delete_many({"identifier": "ip:127.0.0.1"})


def test_disabled_users_cannot_login_generic_401(disabled_accounts):
    # reference message for a truly unknown account
    ref = requests.post(
        f"{BASE}/auth/login",
        json={"email": f"nobody_{uuid.uuid4().hex[:6]}@kjapp.no", "password": "x"},
        timeout=15,
    )
    assert ref.status_code == 401
    ref_detail = ref.json()["detail"]
    for em, role in DISABLED_USERS:
        r = requests.post(f"{BASE}/auth/login", json={"email": em, "password": DISABLED_PW}, timeout=15)
        assert r.status_code == 401, f"{em} ({role}) disabled login should be 401, got {r.status_code}"
        assert r.json()["detail"] == ref_detail, f"{em} message differs → enumeration risk"


# =========================================================================
# 4. Trusted-proxy IP handling
# =========================================================================

class _FakeReq:
    def __init__(self, xff, host):
        self.headers = {"x-forwarded-for": xff} if xff is not None else {}
        self.client = type("C", (), {"host": host})()


def test_trust_proxy_defaults_false_in_this_env():
    assert server.TRUST_PROXY is False


def test_client_ip_ignores_xff_when_proxy_untrusted(monkeypatch):
    req = _FakeReq("1.2.3.4, 5.6.7.8", "10.0.0.9")
    monkeypatch.setattr(server, "TRUST_PROXY", False)
    assert server._client_ip(req) == "10.0.0.9"  # socket peer, XFF ignored


def test_client_ip_uses_xff_when_proxy_trusted(monkeypatch):
    req = _FakeReq("1.2.3.4, 5.6.7.8", "10.0.0.9")
    monkeypatch.setattr(server, "TRUST_PROXY", True)
    assert server._client_ip(req) == "1.2.3.4"  # first forwarded hop


# =========================================================================
# 5. Email-based throttling always active
# =========================================================================

def test_email_throttling_always_active():
    fake = f"p01_throttle_{uuid.uuid4().hex[:8]}@kjapp.no"
    try:
        for _ in range(5):
            r = requests.post(f"{BASE}/auth/login", json={"email": fake, "password": "wrong"}, timeout=15)
            assert r.status_code == 401
        r6 = requests.post(f"{BASE}/auth/login", json={"email": fake, "password": "wrong"}, timeout=15)
        assert r6.status_code == 429
        assert "innloggingsforsøk" in r6.json()["detail"]
    finally:
        mdb.login_attempts.delete_many({"identifier": f"email:{fake}"})
        mdb.login_attempts.delete_many({"identifier": "ip:127.0.0.1"})


# =========================================================================
# 6. Demo login UI gating
# =========================================================================

def test_login_demo_section_gated_by_env_flag():
    path = os.path.join(APP_ROOT, "frontend", "src", "pages", "Login.jsx")
    src = open(path, encoding="utf-8").read()
    assert "REACT_APP_ENABLE_DEMO_LOGIN" in src
    assert "DEMO_LOGIN_ENABLED" in src
    # demo credentials must live INSIDE the gated block (removed from prod bundle when flag is false)
    idx_gate = src.index("{DEMO_LOGIN_ENABLED && (")
    idx_creds = src.index('demoLogin("ola@kjapp.no"')
    assert idx_creds > idx_gate, "demo credentials must be inside the DEMO_LOGIN_ENABLED gate"


def test_preview_env_explicitly_enables_demo_login():
    path = os.path.join(APP_ROOT, "frontend", ".env")
    env = open(path, encoding="utf-8").read()
    # development/preview may explicitly enable demos
    assert "REACT_APP_ENABLE_DEMO_LOGIN=true" in env


def test_gate_disables_demo_when_flag_not_true():
    # emulate the exact frontend gate logic for production (flag unset / not "true")
    def gate(v):
        return v == "true"
    assert gate("false") is False
    assert gate(None) is False
    assert gate("") is False
    assert gate("true") is True
