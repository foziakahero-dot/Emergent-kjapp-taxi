import ast
import re
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1] / "server.py"
SOURCE = SERVER.read_text(encoding="utf-8")


def _load_normalize_org_number():
    tree = ast.parse(SOURCE)
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "normalize_org_number")
    namespace = {"re": re}
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(SERVER), "exec"), namespace)
    return namespace["normalize_org_number"]


def test_org_number_accepts_valid_mod11_and_strips_formatting():
    normalize = _load_normalize_org_number()
    assert normalize("923 609 016") == "923609016"
    assert normalize("974.760.673") == "974760673"


def test_org_number_rejects_wrong_length_and_bad_check_digit():
    normalize = _load_normalize_org_number()
    for bad in ("12345678", "1234567890", "abcdefghi", "923609017"):
        try:
            normalize(bad)
        except ValueError:
            continue
        raise AssertionError(f"{bad} should be rejected")


def test_draft_and_submit_block_duplicate_companies():
    draft = SOURCE.split('def create_fleet_application_draft', 1)[1].split("\n@api.", 1)[0]
    submit = SOURCE.split('def submit_fleet_application', 1)[1].split("\n@api.", 1)[0]
    assert "normalize_org_number(body.org_number)" in draft
    assert "_ensure_no_duplicate_fleet_application(org_number)" in draft
    assert "_ensure_no_duplicate_fleet_application(" in submit and "exclude_token=body.upload_token" in submit


def test_admin_list_includes_every_open_status():
    assert 'q["status"] = {"$in": FLEET_APPLICATION_OPEN_STATUSES + ["approved", "rejected"]}' in SOURCE
    for status in ("submitted", "under_review", "documents_required"):
        assert f'"{status}"' in SOURCE.split("FLEET_APPLICATION_OPEN_STATUSES = ", 1)[1].split("\n", 1)[0]


def test_change_password_clears_temporary_flag_and_revokes_sessions():
    body = SOURCE.split('@api.post("/auth/change-password")', 1)[1].split("\n@api.", 1)[0]
    assert "Depends(get_current_user)" in body
    assert "asyncio.to_thread(verify_password, body.current_password" in body
    assert '"$unset": {"must_reset_password": ""}' in body
    assert '"tokens_valid_after": cutoff' in body
    assert "create_access_token(" in body
