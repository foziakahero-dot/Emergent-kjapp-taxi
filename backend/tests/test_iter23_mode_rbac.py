"""Iter 23: Server-side RBAC for /api/admin/overview and /api/fleet/overview.

Validates that same-API multi-mode architecture cannot be bypassed by URL — the
frontend hostname/mode has no bearing on backend authorisation.
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://mobile-forge-1487.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "customer": ("ola@kjapp.no", "test1234"),
    "driver": ("sjafor@kjapp.no", "sjafor1234"),
    "fleet": ("floteier1@kjapp.no", "fleet1234"),
    "admin": ("admin@kjapp.no", "admin123"),
}


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(*v) for k, v in CREDS.items()}


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- /api/admin/overview ---
def test_admin_overview_unauthenticated_401():
    r = requests.get(f"{API}/admin/overview", timeout=15)
    assert r.status_code in (401, 403), r.status_code  # 401 preferred
    assert r.status_code == 401, f"expected 401, got {r.status_code}"


def test_admin_overview_customer_forbidden(tokens):
    r = requests.get(f"{API}/admin/overview", headers=_auth(tokens["customer"]), timeout=15)
    assert r.status_code == 403, r.text


def test_admin_overview_driver_forbidden(tokens):
    r = requests.get(f"{API}/admin/overview", headers=_auth(tokens["driver"]), timeout=15)
    assert r.status_code == 403, r.text


def test_admin_overview_fleet_owner_forbidden(tokens):
    r = requests.get(f"{API}/admin/overview", headers=_auth(tokens["fleet"]), timeout=15)
    assert r.status_code == 403, r.text


def test_admin_overview_admin_ok(tokens):
    r = requests.get(f"{API}/admin/overview", headers=_auth(tokens["admin"]), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, dict)


# --- /api/fleet/overview ---
def test_fleet_overview_unauthenticated_401():
    r = requests.get(f"{API}/fleet/overview", timeout=15)
    assert r.status_code == 401, r.status_code


def test_fleet_overview_customer_forbidden(tokens):
    r = requests.get(f"{API}/fleet/overview", headers=_auth(tokens["customer"]), timeout=15)
    assert r.status_code == 403, r.text


def test_fleet_overview_driver_forbidden(tokens):
    r = requests.get(f"{API}/fleet/overview", headers=_auth(tokens["driver"]), timeout=15)
    assert r.status_code == 403, r.text


def test_fleet_overview_fleet_owner_ok(tokens):
    r = requests.get(f"{API}/fleet/overview", headers=_auth(tokens["fleet"]), timeout=15)
    assert r.status_code == 200, r.text


def test_single_backend_url_shared():
    # Ensure the base URL responds — same API base is used by all modes.
    r = requests.get(f"{API}/health", timeout=15)
    assert r.status_code in (200, 404)  # health may not exist, but base must be reachable
