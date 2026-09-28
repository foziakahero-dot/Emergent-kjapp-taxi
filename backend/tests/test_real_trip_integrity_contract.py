from pathlib import Path
import ast

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "backend" / "server.py"
SOURCE = SERVER.read_text(encoding="utf-8")


def test_server_syntax_after_real_trip_hardening():
    ast.parse(SOURCE)


def test_canonical_real_trip_filter_is_comprehensive():
    required = [
        'SYNTHETIC_TRIP_ID_RE',
        '"demo": {"$ne": True}',
        '"is_demo": {"$ne": True}',
        '"trip_id": {"$not": {"$regex": SYNTHETIC_TRIP_ID_RE}}',
        '"pickup_address": {"$not": {"$regex": SYNTHETIC_ADDRESS_RE}}',
        '"dropoff_address": {"$not": {"$regex": SYNTHETIC_ADDRESS_RE}}',
        'def _real_trip_filter(extra: Optional[dict] = None)',
    ]
    for marker in required:
        assert marker in SOURCE, marker


def test_operational_trip_surfaces_use_real_trip_filter():
    required = [
        'cursor = db.trips.find(_real_trip_filter({"user_id": current["id"]}))',
        'db.trips.find(_real_trip_filter({"driver_id": driver_id, "rating": {"$gt": 0}}))',
        'async for t in db.trips.find(_real_trip_filter({\n        "driver_id": driver_id,',
        'async for t in db.trips.find(_real_trip_filter()).sort("created_at", -1).limit(limit)',
    ]
    for marker in required:
        assert marker in SOURCE, marker

    # Fleet ownership now uses the booking-time fleet snapshot plus a legacy
    # driver fallback. Check every trip query without tying the guard to the
    # first dictionary key or its indentation.
    functions = {node.name: node for node in ast.parse(SOURCE).body if isinstance(node, ast.AsyncFunctionDef)}
    for name in ("fleet_overview", "fleet_live", "fleet_trip_history", "fleet_export_monthly"):
        queries = [node for node in ast.walk(functions[name]) if isinstance(node, ast.Call)
                   and isinstance(node.func, ast.Attribute)
                   and node.func.attr == "find"
                   and ast.unparse(node.func.value) == "db.trips"]
        assert queries, name
        for query in queries:
            assert isinstance(query.args[0], ast.Call), name
            assert ast.unparse(query.args[0].func) == "_real_trip_filter", name


def test_startup_purge_catches_flagged_and_prefixed_synthetic_trips():
    required = [
        '{"demo": True}',
        '{"is_demo": True}',
        '{"trip_id": {"$regex": SYNTHETIC_TRIP_ID_RE}}',
        '{"pickup_address": {"$regex": SYNTHETIC_ADDRESS_RE}}',
        '{"dropoff_address": {"$regex": SYNTHETIC_ADDRESS_RE}}',
    ]
    purge = SOURCE[SOURCE.index("async def purge_synthetic_data"):SOURCE.index("def create_access_token")]
    for marker in required:
        assert marker in purge, marker


def test_demo_data_is_opt_in_and_never_defaults_on():
    block = SOURCE[SOURCE.index("def demo_data_enabled"):SOURCE.index("def compute_cors_origins")]
    assert 'allowed_envs = {"development", "dev", "test", "local"}' in block
    assert "if env not in allowed_envs:" in block
    assert "if flag is None:\n        return False" in block
    assert 'return str(flag).strip().lower() in ("1", "true", "yes", "on")' in block


def test_shared_runtime_disables_legacy_demo_accounts_when_demo_mode_is_off():
    startup = SOURCE[SOURCE.index("# Shared beta/staging/prod"):SOURCE.index("# Nearest-driver-first dispatch")]
    assert "if not ENABLE_DEMO_DATA:" in startup
    assert "disable_legacy_demo_users(db, True, admin_email)" in startup


def test_public_seed_places_never_impersonate_user_home_or_work():
    startup = SOURCE[SOURCE.index("# seed places"):SOURCE.index("# seed admin")]
    # Old labels must be present in the migration selector, but never in
    # inserted public places or the migration's replacement labels.
    import textwrap
    calls = [node for node in ast.walk(ast.parse(textwrap.dedent(startup.partition("\n")[2]))) if isinstance(node, ast.Call)
             and isinstance(node.func, ast.Attribute)
             and ast.unparse(node.func.value) == "db.places"]
    inserted = [ast.literal_eval(call.args[0]) for call in calls if call.func.attr == "insert_many"]
    updates = [ast.literal_eval(call.args[1]) for call in calls if call.func.attr == "update_one"]
    assert inserted and updates
    assert all(place["label"] not in ("Hjem", "Jobb") for batch in inserted for place in batch)
    assert all(change["$set"]["label"] not in ("Hjem", "Jobb") for change in updates)
    assert '{"slug": "karl-johans", "label": "Hjem"}' in startup
    assert '{"slug": "aker-brygge", "label": "Jobb"}' in startup
    assert '"label": "Karl Johan"' in startup
    assert '"label": "Aker Brygge"' in startup


def test_dev_seed_accounts_are_explicitly_marked_demo():
    startup = SOURCE[SOURCE.index("# seed test user (demo only)"):SOURCE.index("# ---- Simulated")]
    assert startup.count('"demo": True') >= 2
    assert startup.count('"is_demo": True') >= 2


def test_admin_settings_can_never_reenable_demo_trips():
    source = SOURCE
    get_block = source[source.index("async def admin_get_settings"):source.index("async def admin_update_settings")]
    update_block = source[source.index("async def admin_update_settings"):source.index("class PricingTestRequest")]
    assert 'features["demo_trips"] = False' in get_block
    assert 'next_features["demo_trips"] = False' in update_block
    assert "allowed_features" in update_block
    assert "Feature-flagg må være true/false" in update_block


def test_all_mutating_e2e_scripts_refuse_shared_beta_and_require_isolation():
    paths = [
        ROOT / "backend" / "scripts" / "e2e_dispatch.py",
        ROOT / "backend" / "scripts" / "e2e_driver_flow.py",
        ROOT / "backend" / "scripts" / "e2e_bonus.py",
    ]
    for path in paths:
        source = path.read_text(encoding="utf-8")
        assert "github-app-builder-28.emergent.host" in source
        assert "api.kjappapp.no" in source
        assert "KJAPP_E2E_ISOLATED" in source
        assert "KJAPP_E2E_ALLOW_MUTATION" in source
        assert "sys.exit(3)" in source


def test_mutating_e2e_scripts_do_not_store_legacy_passwords():
    for rel in ("e2e_driver_flow.py", "e2e_bonus.py"):
        source = (ROOT / "backend" / "scripts" / rel).read_text(encoding="utf-8")
        assert "admin123" not in source
        assert "test1234" not in source
        assert "sjafor1234" not in source
