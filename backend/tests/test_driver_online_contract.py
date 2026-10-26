"""Driver online state must remain server- and GPS-confirmed."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER = (ROOT / "server.py").read_text(encoding="utf-8")
DRIVER_HOME = (ROOT.parent / "driver-app" / "app" / "(driver)" / "home.tsx").read_text(encoding="utf-8")
DRIVER_API = (ROOT.parent / "driver-app" / "src" / "lib" / "api.ts").read_text(encoding="utf-8")


def test_backend_rejects_online_without_fresh_authenticated_gps():
    block = SERVER.split('@api.post("/driver/online")', 1)[1].split("\n\n@api.", 1)[0]
    assert "_fresh_driver_location(current.get(\"last_location_at\"))" in block
    assert 'detail="Hent en fersk GPS-posisjon før du går online"' in block
    assert 'return {"online": body.online' in block


def test_backend_exposes_the_same_document_gate_used_by_online():
    assert '@api.get("/driver/compliance")' in SERVER
    block = SERVER.split('@api.get("/driver/compliance")', 1)[1].split("\n\n# ---- Push endpoints ----", 1)[0]
    assert "_driver_shift_compliance(current, assigned_vehicle)" in block
    assert 'result["location_ready"]' in block


def test_driver_preflights_location_and_canonical_status_before_green_switch():
    assert "Location.requestForegroundPermissionsAsync()" in DRIVER_HOME
    assert "Location.getCurrentPositionAsync" in DRIVER_HOME
    assert "driverApi.location(" in DRIVER_HOME
    assert "driverApi.compliance()" in DRIVER_HOME
    assert "driverApi.online(next)" in DRIVER_HOME
    assert "const canonical = await driverApi.summary()" in DRIVER_HOME
    assert "if (canonical?.online !== next)" in DRIVER_HOME


def test_driver_api_has_compliance_route():
    assert "compliance: () => api.get('/driver/compliance')" in DRIVER_API
