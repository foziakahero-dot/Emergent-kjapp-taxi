import ast
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1] / "server.py"


def _source():
    return SERVER.read_text(encoding="utf-8")


def test_fleet_live_and_identity_backend_contract():
    source = _source()
    ast.parse(source)
    for route in (
        '/fleet/live',
        '/fleet/vehicles',
        '/fleet/documents',
        '/fleet/drivers/{driver_id}',
        '/driver/identity-verification',
        '/driver/identity-verification/selfie',
        '/admin/identity-verifications',
        '/admin/identity-verifications/{verification_id}/review',
    ):
        assert route in source


def test_identity_rollout_is_guarded_and_selfie_is_private_from_fleet_owner():
    source = _source()
    assert 'KJAPP_DRIVER_IDENTITY_REQUIRED' in source
    assert 'driver-identity-selfie' in source
    assert 'Raw identity selfies are intentionally not exposed to fleet owners.' in source
    assert 'role in ("admin", "superadmin")' in source


def test_fleet_live_routes_require_fleet_owner_scope():
    source = _source()
    tree = ast.parse(source)
    names = {"fleet_live", "fleet_vehicles", "fleet_documents", "fleet_driver_detail"}
    found = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names:
            found.add(node.name)
            args = ast.unparse(node.args)
            assert "require_fleet_owner" in args
    assert found == names
