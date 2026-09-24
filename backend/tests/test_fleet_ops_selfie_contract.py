import ast
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1] / "server.py"


def _source():
    return SERVER.read_text(encoding="utf-8")


def test_server_syntax_and_fleet_ops_routes_present():
    source = _source()
    ast.parse(source)
    for route in (
        '/fleet/live',
        '/fleet/vehicles',
        '/fleet/live-trips',
        '/fleet/documents',
        '/fleet/selfie-verifications',
        '/admin/selfie-verifications',
        '/admin/drivers/{driver_id}/selfie-verification',
        '/driver/selfie-verification',
    ):
        assert route in source


def test_selfie_image_is_not_in_generic_public_user_fields():
    source = _source()
    tree = ast.parse(source)
    fields = None
    for node in tree.body:
        if isinstance(node, ast.Assign):
            if any(isinstance(t, ast.Name) and t.id == "USER_RESPONSE_FIELDS" for t in node.targets):
                call = node.value
                if isinstance(call, ast.Call) and call.args:
                    value = ast.literal_eval(call.args[0])
                    fields = set(value)
                    break
    assert fields is not None
    assert "selfie_verification_path" not in fields
    assert "selfie_verification_status" in fields


def test_driver_signup_requires_separate_selfie_scope():
    source = _source()
    assert '"selfie_verification"' in source
    assert '"driver-selfie"' in source
    assert 'scope": {"$in": ["driver-docs", "driver-selfie"]}' in source
    assert 'rec.get("scope") == "driver-selfie"' in source
