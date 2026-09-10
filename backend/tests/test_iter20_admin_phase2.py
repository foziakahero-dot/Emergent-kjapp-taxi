"""
Iter20 backend tests — Phase 2 Superadmin Operations Control Center.
Covers: /api/admin/live, drivers-full, vehicles, trips-full, timeline,
finance (+export), documents, support tickets, analytics, settings,
fleet detail, RBAC and regressions after require_driver fix.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://github-app-builder-28.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@kjapp.no", "admin123")
PASS = ("ola@kjapp.no", "test1234")
DRIVER = ("sjafor@kjapp.no", "sjafor1234")
FLEET = ("floteier1@kjapp.no", "fleet1234")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} => {r.status_code} {r.text[:200]}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="session")
def admin_hdr():
    tok, _ = _login(*ADMIN)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def pass_hdr():
    tok, _ = _login(*PASS)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def driver_hdr():
    tok, _ = _login(*DRIVER)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def fleet_hdr():
    tok, _ = _login(*FLEET)
    return {"Authorization": f"Bearer {tok}"}


# ---------- Health ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200 and r.json().get("status") == "ok"


# ---------- Login roles ----------
def test_admin_login_role():
    _, u = _login(*ADMIN)
    assert u["role"] == "superadmin"


# ---------- /admin/live ----------
def test_admin_live(admin_hdr):
    r = requests.get(f"{API}/admin/live", headers=admin_hdr, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "drivers" in d and "trips" in d and "as_of" in d
    assert isinstance(d["drivers"], list) and isinstance(d["trips"], list)


# ---------- /admin/drivers-full ----------
def test_drivers_full_filters(admin_hdr):
    for st in ("all", "approved", "pending", "online"):
        params = {} if st == "all" else {"status": st}
        r = requests.get(f"{API}/admin/drivers-full", headers=admin_hdr, params=params, timeout=15)
        assert r.status_code == 200, f"status={st} => {r.status_code}"
        assert "drivers" in r.json()

    r = requests.get(f"{API}/admin/drivers-full", headers=admin_hdr, params={"q": "sjafor"}, timeout=15)
    assert r.status_code == 200


def test_set_driver_status_toggle_and_audit(admin_hdr):
    r = requests.get(f"{API}/admin/drivers-full", headers=admin_hdr, timeout=15)
    drivers = r.json()["drivers"]
    assert drivers, "need at least one driver"
    # Pick sjafor if possible, else first
    d = next((x for x in drivers if x.get("email") == "sjafor@kjapp.no"), drivers[0])
    uid = d["id"]
    original = bool(d.get("approved"))

    # Toggle
    r = requests.post(f"{API}/admin/drivers/{uid}/set-status", headers=admin_hdr, json={"approved": not original}, timeout=15)
    assert r.status_code == 200

    # verify
    r = requests.get(f"{API}/admin/drivers-full", headers=admin_hdr, timeout=15)
    now = next(x for x in r.json()["drivers"] if x["id"] == uid)
    assert bool(now["approved"]) == (not original)

    # audit log entry
    r = requests.get(f"{API}/admin/audit-log", headers=admin_hdr, params={"entity_type": "driver"}, timeout=15)
    assert r.status_code == 200
    log = r.json()
    events = log.get("events") or log.get("audit") or log if isinstance(log, list) else log.get("events", [])
    # accept various key names
    items = log if isinstance(log, list) else log.get("events") or log.get("items") or log.get("audit") or []
    assert any(e.get("entity_id") == uid for e in items), f"no audit for {uid} in {str(items)[:400]}"

    # restore
    r = requests.post(f"{API}/admin/drivers/{uid}/set-status", headers=admin_hdr, json={"approved": original}, timeout=15)
    assert r.status_code == 200


# ---------- /admin/vehicles ----------
def test_vehicles(admin_hdr):
    r = requests.get(f"{API}/admin/vehicles", headers=admin_hdr, timeout=15)
    assert r.status_code == 200
    assert "vehicles" in r.json()
    r = requests.get(f"{API}/admin/vehicles", headers=admin_hdr, params={"q": "a"}, timeout=15)
    assert r.status_code == 200


# ---------- /admin/trips-full + timeline ----------
def test_trips_full_and_timeline(admin_hdr):
    for st in ("active", "completed", "cancelled"):
        r = requests.get(f"{API}/admin/trips-full", headers=admin_hdr, params={"status": st}, timeout=15)
        assert r.status_code == 200

    r = requests.get(f"{API}/admin/trips-full", headers=admin_hdr, timeout=15)
    trips = r.json()["trips"]
    if trips:
        tid = trips[0]["trip_id"]
        r = requests.get(f"{API}/admin/trips/{tid}/timeline", headers=admin_hdr, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["trip_id"] == tid and "events" in d


# ---------- /admin/finance + export ----------
def test_finance(admin_hdr):
    r = requests.get(f"{API}/admin/finance", headers=admin_hdr, params={"days": 30}, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["days"] == 30
    for k in ("gmv", "kjapp_revenue", "trips", "avg_price"):
        assert k in d["totals"], f"missing totals.{k}"
    assert len(d["series"]) == 30
    assert "fleets" in d
    if d["fleets"]:
        assert "commission_rate" in d["fleets"][0] and "commission_amount" in d["fleets"][0]


def test_finance_export_csv(admin_hdr):
    r = requests.get(f"{API}/admin/finance/export", headers=admin_hdr, params={"days": 30}, timeout=30)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    body = r.text
    # Semicolon delimiter + Norwegian header row
    first = body.splitlines()[0]
    assert ";" in first
    assert "dato" in first and "trip_id" in first


# ---------- /admin/documents ----------
def test_documents(admin_hdr):
    r = requests.get(f"{API}/admin/documents", headers=admin_hdr, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "documents" in d and "scopes" in d
    # filters don't 500
    r = requests.get(f"{API}/admin/documents", headers=admin_hdr, params={"scope": "all", "q": "a"}, timeout=15)
    assert r.status_code == 200


# ---------- Support tickets CRUD ----------
def test_support_ticket_flow(admin_hdr):
    payload = {"subject": "TEST_iter20 sak", "body": "auto test", "category": "teknisk", "priority": "normal"}
    r = requests.post(f"{API}/admin/support/tickets", headers=admin_hdr, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    t = r.json()
    tid = t["id"]
    assert t["subject"] == payload["subject"]
    assert t["status"] == "open"

    # list with open filter
    r = requests.get(f"{API}/admin/support/tickets", headers=admin_hdr, params={"status": "open"}, timeout=15)
    assert r.status_code == 200
    assert any(x["id"] == tid for x in r.json()["tickets"])

    # patch status + note
    r = requests.patch(f"{API}/admin/support/tickets/{tid}", headers=admin_hdr, json={"status": "resolved", "note": "løst"}, timeout=15)
    assert r.status_code == 200

    r = requests.get(f"{API}/admin/support/tickets", headers=admin_hdr, params={"status": "resolved"}, timeout=15)
    assert any(x["id"] == tid for x in r.json()["tickets"])

    # audit trail for status change
    r = requests.get(f"{API}/admin/audit-log", headers=admin_hdr, params={"entity_type": "ticket"}, timeout=15)
    assert r.status_code == 200


# ---------- /admin/analytics ----------
def test_analytics(admin_hdr):
    r = requests.get(f"{API}/admin/analytics", headers=admin_hdr, params={"days": 14}, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["days"] == 14
    for k in ("acceptance_rate", "cancellation_rate", "avg_price", "avg_distance_km", "avg_duration_min"):
        assert k in d["metrics"]
    assert len(d["hours"]) == 24
    assert isinstance(d["top_drivers"], list)
    assert isinstance(d["series"], list) and len(d["series"]) == 14


# ---------- /admin/settings ----------
def test_settings_get_defaults(admin_hdr):
    r = requests.get(f"{API}/admin/settings", headers=admin_hdr, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert "default_commission" in d
    assert "ride_classes" in d and len(d["ride_classes"]) == 4
    assert "features" in d


def test_settings_patch_superadmin_and_validation(admin_hdr):
    # invalid > 0.5 → 400
    r = requests.patch(f"{API}/admin/settings", headers=admin_hdr, json={"default_commission": 0.6}, timeout=10)
    assert r.status_code == 400

    # valid change
    r = requests.patch(f"{API}/admin/settings", headers=admin_hdr, json={"default_commission": 0.12}, timeout=10)
    assert r.status_code == 200
    g = requests.get(f"{API}/admin/settings", headers=admin_hdr, timeout=10).json()
    assert g["default_commission"] == 0.12

    # restore
    r = requests.patch(f"{API}/admin/settings", headers=admin_hdr, json={"default_commission": 0.10}, timeout=10)
    assert r.status_code == 200
    g = requests.get(f"{API}/admin/settings", headers=admin_hdr, timeout=10).json()
    assert g["default_commission"] == 0.10


def test_settings_patch_forbidden_for_passenger(pass_hdr):
    r = requests.patch(f"{API}/admin/settings", headers=pass_hdr, json={"default_commission": 0.11}, timeout=10)
    assert r.status_code == 403


# ---------- /admin/fleets/{id} ----------
def test_fleet_detail(admin_hdr):
    # invalid id → 400
    r = requests.get(f"{API}/admin/fleets/not-an-oid", headers=admin_hdr, timeout=10)
    assert r.status_code == 400

    # unknown id → 404
    r = requests.get(f"{API}/admin/fleets/000000000000000000000000", headers=admin_hdr, timeout=10)
    assert r.status_code == 404

    # real fleet
    r = requests.get(f"{API}/admin/fleets", headers=admin_hdr, timeout=10)
    fleets = r.json().get("fleets") if isinstance(r.json(), dict) else r.json()
    if fleets:
        fid = fleets[0].get("id") or fleets[0].get("_id")
        r = requests.get(f"{API}/admin/fleets/{fid}", headers=admin_hdr, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "fleet" in d and "drivers" in d
        assert "commission_history" in d and "audit" in d and "payouts" in d


# ---------- RBAC ----------
@pytest.mark.parametrize("path", [
    "/admin/live",
    "/admin/drivers-full",
    "/admin/vehicles",
    "/admin/trips-full",
    "/admin/finance",
    "/admin/documents",
    "/admin/support/tickets",
    "/admin/analytics",
    "/admin/settings",
])
def test_rbac_no_token(path):
    r = requests.get(f"{API}{path}", timeout=10)
    assert r.status_code == 401


@pytest.mark.parametrize("path", [
    "/admin/live",
    "/admin/drivers-full",
    "/admin/vehicles",
    "/admin/finance",
    "/admin/analytics",
])
def test_rbac_passenger_forbidden(path, pass_hdr):
    r = requests.get(f"{API}{path}", headers=pass_hdr, timeout=10)
    assert r.status_code == 403


# ---------- Regressions after require_driver fix ----------
def test_passenger_trips_regression(pass_hdr):
    r = requests.get(f"{API}/trips", headers=pass_hdr, timeout=15)
    assert r.status_code in (200, 404)  # endpoint exists


def test_driver_pending_regression(driver_hdr):
    r = requests.get(f"{API}/driver/pending", headers=driver_hdr, timeout=15)
    assert r.status_code == 200


def test_driver_summary_today_regression(driver_hdr):
    r = requests.get(f"{API}/driver/summary/today", headers=driver_hdr, timeout=15)
    assert r.status_code == 200


def test_fleet_overview_regression(fleet_hdr):
    r = requests.get(f"{API}/fleet/overview", headers=fleet_hdr, timeout=15)
    assert r.status_code == 200


def test_driver_rate_passenger_endpoint_exists(driver_hdr):
    # Must NOT be 502; may be 404/400/405 depending on payload
    r = requests.post(f"{API}/driver/trip/nonexistent-trip/rate-passenger", headers=driver_hdr, json={"rating": 5}, timeout=15)
    assert r.status_code != 502, f"got 502 {r.text[:200]}"
    assert r.status_code in (400, 404, 405, 422)
