"""P0 A — mandatory admin 2FA integration regressions.

Requires the KJAPP backend to be running and test MongoDB to be reachable, matching
the existing backend integration-test convention.
"""
import os
import sys
import uuid
from datetime import datetime, timezone

import pyotp
import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402


BASE = os.environ.get("P0_TEST_API", "http://localhost:8001/api").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
mdb = MongoClient(MONGO_URL)[os.environ.get("DB_NAME", "kjapp")]
PASSWORD = "P0-A-Strong-Test-Password-42!"


def _hdr(token: str):
    return {"Authorization": f"Bearer {token}"}


def _login(email: str, password: str = PASSWORD):
    return requests.post(
        f"{BASE}/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )


def _new_user(role: str, *, totp_secret=None, backup_code=None):
    email = f"p0a_{role}_{uuid.uuid4().hex[:10]}@example.invalid"
    doc = {
        "email": email,
        "password_hash": server.hash_password(PASSWORD),
        "fullName": f"P0 A {role}",
        "phone": "",
        "role": role,
        "disabled": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if role in ("admin", "superadmin"):
        doc["permissions"] = ["operations"]
    if totp_secret:
        doc.update({
            "totp_enabled": True,
            "totp_secret": totp_secret,
            "totp_enabled_at": datetime.now(timezone.utc).isoformat(),
            "totp_backup_codes": [server.hash_password(backup_code)] if backup_code else [],
        })
    result = mdb.users.insert_one(doc)
    return email, str(result.inserted_id)


def _cleanup(email: str, user_id: str):
    mdb.users.delete_many({"_id": server.ObjectId(user_id)})
    mdb.audit_events.delete_many({"entity_type": "user", "entity_id": user_id})
    mdb.login_attempts.delete_many({"identifier": f"email:{email}"})
    mdb.login_attempts.delete_many({"identifier": "ip:127.0.0.1"})


def _wrong_totp(secret: str) -> str:
    valid = pyotp.TOTP(secret).now()
    return "111111" if valid == "000000" else "000000"


def test_admin_without_2fa_gets_enrollment_not_session():
    email, uid = _new_user("admin")
    try:
        r = _login(email)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("twofa_setup_required") is True
        assert data.get("twofa_token")
        assert "token" not in data and "access_token" not in data

        preauth = data["twofa_token"]
        assert requests.get(f"{BASE}/auth/me", headers=_hdr(preauth), timeout=10).status_code == 401
        assert requests.get(f"{BASE}/admin/overview", headers=_hdr(preauth), timeout=10).status_code == 401

        setup = requests.post(
            f"{BASE}/auth/2fa/enroll/setup",
            json={"twofa_token": preauth},
            timeout=15,
        )
        assert setup.status_code == 200, setup.text
        secret = setup.json()["secret"]

        enabled = requests.post(
            f"{BASE}/auth/2fa/enroll/enable",
            json={"twofa_token": preauth, "code": pyotp.TOTP(secret).now()},
            timeout=15,
        )
        assert enabled.status_code == 200, enabled.text
        final = enabled.json()
        assert final.get("token")
        assert final.get("enabled") is True
        assert len(final.get("backup_codes") or []) >= 1

        token = final["token"]
        me = requests.get(f"{BASE}/auth/me", headers=_hdr(token), timeout=10)
        assert me.status_code == 200
        assert me.json()["role"] == "admin"
        assert requests.get(f"{BASE}/admin/overview", headers=_hdr(token), timeout=15).status_code == 200

        actions = [x["action"] for x in mdb.audit_events.find({"entity_type": "user", "entity_id": uid})]
        assert "auth.2fa_setup" in actions
        assert "auth.2fa_success" in actions
    finally:
        _cleanup(email, uid)


def test_admin_with_totp_requires_and_accepts_second_factor():
    secret = pyotp.random_base32()
    email, uid = _new_user("admin", totp_secret=secret)
    try:
        r = _login(email)
        assert r.status_code == 200
        data = r.json()
        assert data.get("twofa_required") is True
        assert data.get("twofa_token")
        assert "token" not in data and "access_token" not in data

        verified = requests.post(
            f"{BASE}/auth/2fa/verify-login",
            json={"twofa_token": data["twofa_token"], "code": pyotp.TOTP(secret).now()},
            timeout=15,
        )
        assert verified.status_code == 200, verified.text
        token = verified.json()["token"]
        assert requests.get(f"{BASE}/admin/overview", headers=_hdr(token), timeout=15).status_code == 200

        assert mdb.audit_events.find_one({
            "entity_type": "user", "entity_id": uid, "action": "auth.2fa_success"
        })
    finally:
        _cleanup(email, uid)


def test_wrong_admin_totp_is_rejected_and_audited():
    secret = pyotp.random_base32()
    email, uid = _new_user("admin", totp_secret=secret)
    try:
        challenge = _login(email).json()
        r = requests.post(
            f"{BASE}/auth/2fa/verify-login",
            json={"twofa_token": challenge["twofa_token"], "code": _wrong_totp(secret)},
            timeout=15,
        )
        assert r.status_code == 401
        assert "token" not in r.json()
        assert mdb.audit_events.find_one({
            "entity_type": "user", "entity_id": uid, "action": "auth.2fa_failed"
        })
    finally:
        _cleanup(email, uid)


def test_backup_code_is_single_use():
    secret = pyotp.random_base32()
    backup = "a1b2-c3d4"
    email, uid = _new_user("admin", totp_secret=secret, backup_code=backup)
    try:
        first = _login(email).json()
        used = requests.post(
            f"{BASE}/auth/2fa/verify-login",
            json={"twofa_token": first["twofa_token"], "code": backup},
            timeout=15,
        )
        assert used.status_code == 200, used.text
        assert used.json().get("token")

        second = _login(email).json()
        reused = requests.post(
            f"{BASE}/auth/2fa/verify-login",
            json={"twofa_token": second["twofa_token"], "code": backup},
            timeout=15,
        )
        assert reused.status_code == 401

        events = list(mdb.audit_events.find({"entity_type": "user", "entity_id": uid}))
        assert any(e.get("action") == "auth.2fa_backup_used" for e in events)
        assert any(e.get("action") == "auth.2fa_failed" for e in events)
    finally:
        _cleanup(email, uid)


@pytest.mark.parametrize("role", ["user", "driver"])
def test_customer_and_driver_login_are_not_forced_into_admin_2fa(role):
    email, uid = _new_user(role)
    try:
        r = _login(email)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("token")
        assert not data.get("twofa_required")
        assert not data.get("twofa_setup_required")
    finally:
        _cleanup(email, uid)


def test_rbac_still_holds_after_admin_2fa():
    secret = pyotp.random_base32()
    admin_email, admin_uid = _new_user("admin", totp_secret=secret)
    customer_email, customer_uid = _new_user("user")
    try:
        challenge = _login(admin_email).json()
        verified = requests.post(
            f"{BASE}/auth/2fa/verify-login",
            json={"twofa_token": challenge["twofa_token"], "code": pyotp.TOTP(secret).now()},
            timeout=15,
        )
        assert verified.status_code == 200
        admin_token = verified.json()["token"]
        assert requests.get(f"{BASE}/admin/overview", headers=_hdr(admin_token), timeout=15).status_code == 200

        customer_token = _login(customer_email).json()["token"]
        assert requests.get(f"{BASE}/admin/overview", headers=_hdr(customer_token), timeout=15).status_code == 403
    finally:
        _cleanup(admin_email, admin_uid)
        _cleanup(customer_email, customer_uid)


def test_disabling_admin_2fa_revokes_session_and_requires_reenrollment():
    secret = pyotp.random_base32()
    email, uid = _new_user("admin", totp_secret=secret)
    try:
        challenge = _login(email).json()
        verified = requests.post(
            f"{BASE}/auth/2fa/verify-login",
            json={"twofa_token": challenge["twofa_token"], "code": pyotp.TOTP(secret).now()},
            timeout=15,
        )
        assert verified.status_code == 200
        token = verified.json()["token"]

        disabled = requests.post(
            f"{BASE}/auth/2fa/disable",
            headers=_hdr(token),
            json={"password": PASSWORD, "code": pyotp.TOTP(secret).now()},
            timeout=15,
        )
        assert disabled.status_code == 200, disabled.text
        assert disabled.json().get("reauth_required") is True

        assert requests.get(f"{BASE}/auth/me", headers=_hdr(token), timeout=10).status_code == 401

        relogin = _login(email)
        assert relogin.status_code == 200
        data = relogin.json()
        assert data.get("twofa_setup_required") is True
        assert data.get("twofa_token")
        assert "token" not in data and "access_token" not in data

        assert mdb.audit_events.find_one({
            "entity_type": "user", "entity_id": uid, "action": "auth.2fa_disabled"
        })
    finally:
        _cleanup(email, uid)
