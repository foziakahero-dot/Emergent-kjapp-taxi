"""Iter 21 — P0 beta security hardening regression tests.

Covers: production CORS whitelist, weak-secret rejection, demo-seed gating,
login brute-force (429), RBAC (customer/driver/fleet/superadmin), cross-fleet isolation.
Run: cd /app/backend && python -m pytest tests/test_iter21_hardening.py -q
"""
import os
import sys
import uuid

import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE = "http://localhost:8001/api"
mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
mdb = mongo[os.environ.get("DB_NAME", "kjapp")]


def login(email, password):
    return requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=15)


def auth_headers(email, password):
    r = login(email, password)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:200]}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---------- 1. Config unit tests (import server module functions) ----------

def test_cors_production_no_wildcard():
    from server import compute_cors_origins
    origins = compute_cors_origins("production", "https://whatever.example.com")
    assert "*" not in origins
    # the three production web hosts must always be allowed
    web_hosts = {"https://kjappapp.no", "https://fleet.kjappapp.no", "https://admin.kjappapp.no"}
    assert web_hosts.issubset(set(origins))
    # native mobile WebView origins are allowed so the app can reach api.kjapp.no
    assert "capacitor://localhost" in origins


def test_cors_development_allows_localhost_and_preview():
    from server import compute_cors_origins
    origins = compute_cors_origins("development", "https://mobile-forge-1487.preview.emergentagent.com")
    assert "http://localhost:3000" in origins
    assert "https://mobile-forge-1487.preview.emergentagent.com" in origins
    # wildcard fallback only when no preview origin is known
    assert "*" in compute_cors_origins("development", "*")


def test_production_rejects_weak_jwt_secret():
    from server import validate_production_config
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        validate_production_config({"JWT_SECRET": "secret", "ADMIN_EMAIL": "a@b.no", "ADMIN_PASSWORD": "x" * 20})
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        validate_production_config({"JWT_SECRET": "short", "ADMIN_EMAIL": "a@b.no", "ADMIN_PASSWORD": "x" * 20})
    with pytest.raises(RuntimeError):
        validate_production_config({"ADMIN_EMAIL": "a@b.no", "ADMIN_PASSWORD": "x" * 20})


def test_production_rejects_default_admin_password():
    from server import validate_production_config
    strong_secret = "a" * 64
    with pytest.raises(RuntimeError, match="ADMIN_PASSWORD"):
        validate_production_config({"JWT_SECRET": strong_secret, "ADMIN_EMAIL": "a@b.no", "ADMIN_PASSWORD": "admin123"})
    with pytest.raises(RuntimeError, match="ADMIN_PASSWORD"):
        validate_production_config({"JWT_SECRET": strong_secret, "ADMIN_EMAIL": "a@b.no"})
    # strong config passes
    validate_production_config({"JWT_SECRET": strong_secret, "ADMIN_EMAIL": "a@b.no", "ADMIN_PASSWORD": "Sup3r-Str0ng-Passw0rd!"})


def test_demo_data_never_enabled_in_production():
    from server import demo_data_enabled
    assert demo_data_enabled("production", "true") is False
    assert demo_data_enabled("production", None) is False
    assert demo_data_enabled("development", None) is True
    assert demo_data_enabled("development", "false") is False
    assert demo_data_enabled("staging", "true") is True


def test_server_source_has_no_hardcoded_admin_password():
    src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server.py")).read()
    assert 'os.environ.get("ADMIN_PASSWORD", "admin123")' not in src
    assert 'allow_origins=["*"]' not in src


# ---------- 2. Brute-force protection (live server) ----------

def test_login_brute_force_429():
    fake_email = f"bruteforce_{uuid.uuid4().hex[:8]}@kjapp.no"
    try:
        statuses = []
        for _ in range(5):
            r = requests.post(f"{BASE}/auth/login", json={"email": fake_email, "password": "wrongpass"}, timeout=15)
            statuses.append(r.status_code)
        assert all(s == 401 for s in statuses), f"first 5 attempts should be 401, got {statuses}"
        # generic message — no user-enumeration
        r6 = requests.post(f"{BASE}/auth/login", json={"email": fake_email, "password": "wrongpass"}, timeout=15)
        assert r6.status_code == 429, f"6th attempt should be 429, got {r6.status_code}"
        assert "innloggingsforsøk" in r6.json()["detail"]
    finally:
        mdb.login_attempts.delete_many({"identifier": {"$regex": "bruteforce_"}})


def test_login_no_user_enumeration():
    fake = f"noexist_{uuid.uuid4().hex[:8]}@kjapp.no"
    try:
        r_missing = requests.post(f"{BASE}/auth/login", json={"email": fake, "password": "x"}, timeout=15)
        r_wrongpw = requests.post(f"{BASE}/auth/login", json={"email": "ola@kjapp.no", "password": "definitely-wrong"}, timeout=15)
        assert r_missing.status_code == r_wrongpw.status_code == 401
        assert r_missing.json()["detail"] == r_wrongpw.json()["detail"]
    finally:
        mdb.login_attempts.delete_many({"identifier": {"$regex": "noexist_"}})
        mdb.login_attempts.delete_many({"identifier": "email:ola@kjapp.no"})


def test_successful_login_clears_failed_attempts():
    email = "ola@kjapp.no"
    try:
        for _ in range(3):
            requests.post(f"{BASE}/auth/login", json={"email": email, "password": "wrong"}, timeout=15)
        assert mdb.login_attempts.count_documents({"identifier": f"email:{email}"}) >= 3
        r = login(email, "test1234")
        assert r.status_code == 200
        assert mdb.login_attempts.count_documents({"identifier": f"email:{email}"}) == 0
    finally:
        mdb.login_attempts.delete_many({"identifier": f"email:{email}"})


def test_normal_login_still_works_all_roles():
    for email, pw, role in [
        ("ola@kjapp.no", "test1234", "user"),
        ("sjafor@kjapp.no", "sjafor1234", "driver"),
        ("floteier1@kjapp.no", "fleet1234", "fleet_owner"),
        ("admin@kjapp.no", "admin123", "superadmin"),
    ]:
        r = login(email, pw)
        assert r.status_code == 200, f"{email}: {r.status_code}"
        assert r.json()["user"]["role"] == role
        assert "token" in r.json()


# ---------- 3. RBAC / authorization audit ----------

def test_customer_cannot_access_admin_or_fleet():
    h = auth_headers("ola@kjapp.no", "test1234")
    for ep in ["/admin/overview", "/admin/users", "/admin/drivers-full", "/admin/finance",
               "/admin/settings", "/admin/audit-log", "/fleet/overview", "/fleet/drivers", "/fleet/payouts"]:
        r = requests.get(f"{BASE}{ep}", headers=h, timeout=15)
        assert r.status_code == 403, f"{ep} should be 403 for customer, got {r.status_code}"


def test_driver_cannot_access_admin():
    h = auth_headers("sjafor@kjapp.no", "sjafor1234")
    for ep in ["/admin/overview", "/admin/users", "/admin/live", "/admin/finance/export", "/admin/support/tickets"]:
        r = requests.get(f"{BASE}{ep}", headers=h, timeout=15)
        assert r.status_code == 403, f"{ep} should be 403 for driver, got {r.status_code}"


def test_unauthenticated_gets_401():
    for ep in ["/admin/overview", "/fleet/overview", "/auth/me"]:
        r = requests.get(f"{BASE}{ep}", timeout=15)
        assert r.status_code == 401, f"{ep} should be 401 without token, got {r.status_code}"


def test_fleet_owner_cannot_access_admin_or_other_fleets():
    h = auth_headers("floteier1@kjapp.no", "fleet1234")
    # admin endpoints blocked
    for ep in ["/admin/overview", "/admin/fleets", "/admin/users"]:
        r = requests.get(f"{BASE}{ep}", headers=h, timeout=15)
        assert r.status_code == 403, f"{ep} should be 403 for fleet_owner, got {r.status_code}"
    # own fleet id
    me = requests.get(f"{BASE}/fleet/me", headers=h, timeout=15)
    assert me.status_code == 200
    own_fleet_id = me.json()["id"]
    # all drivers returned are scoped to own fleet
    dr = requests.get(f"{BASE}/fleet/drivers", headers=h, timeout=15)
    assert dr.status_code == 200
    for d in dr.json()["drivers"]:
        assert d.get("fleet_id") == own_fleet_id, f"driver {d.get('id')} leaked from fleet {d.get('fleet_id')}"
    # detail endpoint for ANOTHER fleet is admin-only → 403
    other = mdb.fleets.find_one({"_id": {"$ne": None}, "name": {"$ne": None}})
    other_ids = [str(f["_id"]) for f in mdb.fleets.find({}, {"_id": 1}) if str(f["_id"]) != own_fleet_id]
    if other_ids:
        r = requests.get(f"{BASE}/admin/fleets/{other_ids[0]}", headers=h, timeout=15)
        assert r.status_code == 403, f"fleet owner accessed another fleet detail: {r.status_code}"
    # invites are scoped: every invite visible belongs to own fleet
    inv = requests.get(f"{BASE}/fleet/driver-invites", headers=h, timeout=15)
    assert inv.status_code == 200
    for i in inv.json()["invites"]:
        assert i.get("fleet_id") == own_fleet_id


def test_superadmin_access_still_works():
    h = auth_headers("admin@kjapp.no", "admin123")
    for ep in ["/admin/overview", "/admin/fleets-full", "/admin/settings", "/admin/audit-log"]:
        r = requests.get(f"{BASE}{ep}", headers=h, timeout=15)
        assert r.status_code == 200, f"{ep} should be 200 for superadmin, got {r.status_code}"


# ---------- 4. Runtime hygiene ----------

def test_request_id_header_present():
    r = requests.get(f"{BASE}/health", timeout=15)
    assert r.status_code == 200
    assert r.headers.get("X-Request-ID"), "X-Request-ID header missing"


def test_demo_data_active_in_dev_environment():
    """In this dev environment ENABLE_DEMO_DATA=true — demo drivers must exist (control test)."""
    from server import ENABLE_DEMO_DATA, APP_ENV
    assert APP_ENV == "development"
    assert ENABLE_DEMO_DATA is True
    assert mdb.users.count_documents({"demo": True, "role": "driver"}) >= 1
