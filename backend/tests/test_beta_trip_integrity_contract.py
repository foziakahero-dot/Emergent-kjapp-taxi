from pathlib import Path
import ast

ROOT = Path(__file__).resolve().parents[2]
SERVER_PATH = ROOT / "backend" / "server.py"
CONTROL_PATH = ROOT / "backend" / "admin_control_center.py"
CUSTOMER_BOOKING_PATH = ROOT / "frontend" / "app" / "booking" / "[tripId].tsx"
CUSTOMER_RECEIPT_PATH = ROOT / "frontend" / "app" / "receipt" / "[tripId].tsx"
DRIVER_API_PATH = ROOT / "driver-app" / "src" / "lib" / "api.ts"
DRIVER_TRIPS_PATH = ROOT / "driver-app" / "app" / "driver-trips.tsx"
DRIVER_EARNINGS_PATH = ROOT / "driver-app" / "app" / "(driver)" / "earnings.tsx"

SERVER = SERVER_PATH.read_text(encoding="utf-8")
CONTROL = CONTROL_PATH.read_text(encoding="utf-8")
CUSTOMER_BOOKING = CUSTOMER_BOOKING_PATH.read_text(encoding="utf-8")
CUSTOMER_RECEIPT = CUSTOMER_RECEIPT_PATH.read_text(encoding="utf-8")
DRIVER_API = DRIVER_API_PATH.read_text(encoding="utf-8")
DRIVER_TRIPS = DRIVER_TRIPS_PATH.read_text(encoding="utf-8")
DRIVER_EARNINGS = DRIVER_EARNINGS_PATH.read_text(encoding="utf-8")


def _block(source: str, function_name: str) -> str:
    start = source.index(f"async def {function_name}")
    next_async = source.find("\nasync def ", start + 10)
    next_sync = source.find("\ndef ", start + 10)
    ends = [x for x in (next_async, next_sync) if x > start]
    return source[start:min(ends) if ends else len(source)]


def test_python_sources_parse_after_beta_trip_hardening():
    ast.parse(SERVER)
    ast.parse(CONTROL)


def test_driver_live_dispatch_uses_canonical_fleet_vehicle():
    required = [
        '"vehicle_id",',
        "async def _assigned_fleet_vehicle",
        "assigned_vehicle = await _assigned_fleet_vehicle(d, required=False)",
        "assigned_vehicle = await _assigned_fleet_vehicle(current, required=True)",
        'trip_pre.get("vehicle_type") or "ai-first"',
        '"vehicle_id": str(assigned_vehicle["_id"])',
        '"fleet_id": current.get("fleet_id")',
        '"fleet_org_number": fleet.get("org_number")',
    ]
    for marker in required:
        assert marker in SERVER, marker


def test_driver_cannot_go_online_without_real_assigned_vehicle():
    block = _block(SERVER, "driver_online")
    assert "if body.online:" in block
    assert "await _assigned_fleet_vehicle(current, required=True)" in block


def test_trip_start_requires_fresh_gps_and_pickup_proximity():
    block = _block(SERVER, "driver_start")
    assert "_fresh_driver_location" in block
    assert "PICKUP_ARRIVAL_RADIUS_M" in block
    assert "trip_start_distance_from_pickup_m" in block
    assert "_real_trip_filter" in block


def test_payment_is_the_only_transition_that_releases_arrived_ride():
    helper = _block(SERVER, "_mark_trip_paid_and_complete")
    assert '"payment_status": "paid"' in helper
    assert '"status": "completed"' in helper

    complete = _block(SERVER, "complete_trip")
    assert 'trip.get("payment_status") != "paid"' in complete
    assert "Betalingen må være bekreftet" in complete

    rating = _block(SERVER, "rate_trip")
    assert 'trip.get("payment_status") != "paid"' in rating


def test_payment_success_uses_trip_time_fleet_and_commission_snapshot():
    assert 'fleet_id = trip.get("fleet_id") or (driver or {}).get("fleet_id")' in CONTROL
    assert 'trip.get("commission_rate", (fleet or {}).get("commission_rate", 0.10))' in CONTROL


def test_receipt_prefers_trip_time_vehicle_snapshot():
    receipt = _block(SERVER, "ensure_receipt_snapshot")
    assert '(trip.get("driver") or {}).get("car") or (driver or {}).get("car")' in receipt
    assert '(trip.get("driver") or {}).get("plate") or (driver or {}).get("plate")' in receipt
    assert 'fleet_id = trip.get("fleet_id")' in receipt


def test_driver_and_fleet_money_requires_paid_trip():
    weekly = _block(SERVER, "driver_history_weekly")
    summary = _block(SERVER, "driver_summary")
    payouts = _block(SERVER, "driver_payouts")
    fleet = _block(SERVER, "fleet_overview")
    finance = _block(SERVER, "admin_finance")
    tx = _block(SERVER, "admin_transactions")
    for block in (weekly, summary, payouts, fleet, finance, tx):
        assert '"payment_status": "paid"' in block


def test_bonus_engine_counts_paid_real_trips_and_not_arrival_only():
    progress = _block(SERVER, "_campaign_progress")
    assert "_real_trip_filter" in progress
    assert '"payment_status": "paid"' in progress
    arrive = _block(SERVER, "driver_arrive")
    assert "award_driver_bonuses(driver_id)" not in arrive
    paid = _block(SERVER, "_mark_trip_paid_and_complete")
    assert "bonus_evaluated_at" in paid
    assert "await award_driver_bonuses" in paid


def test_customer_app_does_not_fake_complete_before_payment():
    assert "try { await tripsApi.complete(tripId!); } catch {}" not in CUSTOMER_BOOKING
    assert "['arrived', 'completed', 'rated'].includes(t.status)" in CUSTOMER_BOOKING
    assert "trip?.payment_status !== 'paid'" in CUSTOMER_RECEIPT
    assert "Vurdering åpnes når betalingen er bekreftet." in CUSTOMER_RECEIPT
    assert "{isPaid ? (" in CUSTOMER_RECEIPT


def test_driver_app_does_not_mask_money_failures_or_recompute_trip_earnings():
    assert ".catch(() => normalizePayouts())" not in DRIVER_API
    assert "t.driver_earnings != null ? kr(t.driver_earnings) : 'Venter betaling'" in DRIVER_TRIPS
    assert "t.driver_earnings != null ? kr(t.driver_earnings) : 'Venter betaling'" in DRIVER_EARNINGS
    assert "KJAPP viser ikke 0 kr som fallback" in DRIVER_EARNINGS


def test_customer_and_driver_roles_are_server_separated():
    assert "def require_customer(current=Depends(get_current_user))" in SERVER
    passenger_endpoints = [
        "request_trip", "active_trip", "get_trip", "change_trip_destination",
        "complete_trip", "rate_trip", "cancel_trip_preview", "cancel_trip",
        "list_trips", "create_trip_checkout", "get_payment_status",
    ]
    for name in passenger_endpoints:
        block = _block(SERVER, name)
        assert "Depends(require_customer)" in block, name


def test_driver_login_is_role_scoped_and_supports_email_or_phone():
    login = _block(SERVER, "login")
    assert 'body.client == "driver"' in login
    assert '"role": "driver"' in login
    assert '"phone": {"$regex": phone_pattern}' in login
    assert 'lookup = {"role": "driver", "email": identifier.lower()}' in login


def test_driver_profile_truth_comes_from_fleet_vehicle_assignment():
    me = _block(SERVER, "me")
    assert 'current["fleet_name"] = fleet.get("name")' in me
    assert 'current["fleet_org_number"] = fleet.get("org_number")' in me
    assert "await _assigned_fleet_vehicle(current, required=False)" in me


def test_driver_invites_are_bound_to_registered_fleet_vehicle():
    invite = _block(SERVER, "fleet_create_driver_invite")
    assert "if not body.vehicle_id" in invite
    assert 'db.fleet_vehicles.find_one({"_id": vehicle_oid, "fleet_id": fleet_id})' in invite
    assert '"vehicle_id": str(vehicle["_id"])' in invite
    assert "Bilen er allerede tildelt en sjåfør" in invite

    accept = _block(SERVER, "accept_driver_invite")
    assert "canonical_vehicle_id" in accept
    assert '"vehicle_id": canonical_vehicle_id' in accept
    assert '"assigned_driver_id": uid' in accept
    assert "assigned.modified_count != 1" in accept
    assert "await db.users.delete_one" in accept


def test_orphan_generic_admin_driver_invites_are_disabled():
    invite = _block(SERVER, "create_driver_invite")
    assert "status_code=410" in invite
    assert "konkret løyvehaver/flåte" in invite


def test_fleet_operational_history_is_separate_from_paid_accounting():
    fleet_trips = _block(SERVER, "fleet_trip_history")
    assert "_real_trip_filter(scope)" in fleet_trips
    assert '"payment_status": "paid"' not in fleet_trips
    assert '"payment_status": t.get("payment_status")' in fleet_trips

    export = _block(SERVER, "fleet_export_monthly")
    assert '"payment_status": "paid"' in export


def test_unresolved_checkout_cannot_escape_payment_state():
    receipt_source = CUSTOMER_RECEIPT
    assert "Vurdering åpnes når betalingen er bekreftet." in receipt_source
    payment_success = (ROOT / "frontend" / "app" / "payment" / "success.tsx").read_text(encoding="utf-8")
    assert "turen forblir åpen til serveren bekrefter betalingen" in payment_success
    assert "Tilbake til kvittering" in payment_success


def test_booking_requires_verified_real_payment_method():
    booking = _block(SERVER, "request_trip")
    assert 'verified_count = await db.payment_methods.count_documents' in booking
    assert '"verified": True' in booking
    assert '"setup_status": "succeeded"' in booking
    assert '"stripe_payment_method_id": {"$type": "string"}' in booking
    assert "Kortet ditt må verifiseres før du kan bestille tur" in booking


def test_busy_driver_never_receives_new_pending_offers():
    pending = _block(SERVER, "driver_pending")
    assert 'if current.get("active_trip_id")' in pending
    assert '"busy": True' in pending
    assert "_real_trip_filter" in pending


def test_atomic_accept_requires_driver_still_online_and_releases_failed_claim():
    accept = _block(SERVER, "driver_accept")
    assert '"online": True' in accept
    assert '"approved": True' in accept
    assert '"active_trip_id": body.trip_id' in accept
    assert 'if result.modified_count == 0' in accept
    assert '"$unset": {"active_trip_id": "", "active_trip_locked_at": ""}' in accept


def test_customer_login_and_social_auth_cannot_cross_into_driver_or_admin_roles():
    login = _block(SERVER, "login")
    assert 'body.client == "customer"' in login
    assert '{"role": "user", "email": identifier.lower()}' in login

    google_legacy = _block(SERVER, "google_session")
    assert 'user.get("role", "user") != "user"' in google_legacy

    google_pkce = _block(SERVER, "google_oauth_code")
    assert 'user.get("role", "user") != "user"' in google_pkce

    apple = _block(SERVER, "apple_signin")
    assert 'existing.get("role", "user") != "user"' in apple


def test_driver_bundle_contains_no_google_or_self_registration_auth_path():
    driver_auth = (ROOT / "driver-app" / "src" / "context" / "AuthContext.tsx").read_text(encoding="utf-8")
    driver_api = (ROOT / "driver-app" / "src" / "lib" / "api.ts").read_text(encoding="utf-8")
    driver_login = (ROOT / "driver-app" / "app" / "driver-login.tsx").read_text(encoding="utf-8")

    for forbidden in (
        "signInWithGoogle",
        "googleSession",
        "authApi.register",
        "WebBrowser.openAuthSessionAsync",
        "auth.emergentagent.com",
    ):
        assert forbidden not in driver_auth
    assert "register:" not in driver_api
    assert "googleSession:" not in driver_api
    assert "E-post eller telefonnummer" in driver_login


def test_customer_and_driver_apps_fail_closed_on_wrong_restored_role():
    customer_auth = (ROOT / "frontend" / "src" / "context" / "AuthContext.tsx").read_text(encoding="utf-8")
    driver_auth = (ROOT / "driver-app" / "src" / "context" / "AuthContext.tsx").read_text(encoding="utf-8")
    assert "u?.role !== 'user'" in customer_auth
    assert "client: 'customer'" in customer_auth
    assert "u?.role !== 'driver' || u?.approved !== true" in driver_auth


def test_driver_can_select_only_explicit_fleet_assignments():
    resolver = SOURCE = SERVER
    block = SOURCE[SOURCE.index("async def _assigned_fleet_vehicle"):SOURCE.index("def _parse_iso_utc")]
    assert '"assigned_driver_id": driver_id' in block
    assert '"assigned_driver_id": {"$in": [None, ""]}' not in block
    assert "Clear stale compatibility mirrors" in block

    listing = _block(SERVER, "driver_assigned_vehicles")
    assert '"assigned_driver_id": driver_id' in listing
    assert '"selected": vid == selected_id' in listing

    select = _block(SERVER, "driver_select_vehicle")
    assert 'current.get("online") is True' in select
    assert "ACTIVE_TRIP_STATUSES" in select
    assert '"assigned_driver_id": current["id"]' in select
    assert '"active": {"$ne": False}' in select


def test_fleet_can_assign_multiple_vehicles_without_forcing_selected_car():
    block = _block(SERVER, "fleet_assign_vehicle_driver")
    assert 'assigned_driver_id": body.driver_id' in block
    assert 'selected_vehicle = await db.fleet_vehicles.find_one' in block
    assert 'if not selected_vehicle:' in block
    assert 'db.fleet_vehicles.update_many(\n            {"fleet_id": fid, "assigned_driver_id": body.driver_id' not in block


def test_driver_profile_photo_is_private_driver_doc_and_replaceable():
    block = _block(SERVER, "driver_update_profile_photo")
    assert '"scope": "driver-docs"' in block
    assert '"doc_type": "profile_photo"' in block
    assert '"owner_user_id": current["id"]' in block
    assert '"profile_photo_path": stored["path"]' in block
    assert '"is_deleted": True' in block


def test_driver_app_exposes_vehicle_selector_and_profile_photo_without_redesign():
    profile = (ROOT / "driver-app" / "app" / "(driver)" / "profile.tsx").read_text(encoding="utf-8")
    vehicles = (ROOT / "driver-app" / "app" / "driver-vehicles.tsx").read_text(encoding="utf-8")
    photo = (ROOT / "driver-app" / "app" / "driver-profile-photo.tsx").read_text(encoding="utf-8")
    api = (ROOT / "driver-app" / "src" / "lib" / "api.ts").read_text(encoding="utf-8")

    assert 'label="Mine biler"' in profile
    assert "authenticatedFileSource" in profile
    assert "Kun biler tildelt av løyvehaveren" in vehicles
    assert "selectVehicle" in vehicles
    assert "CameraView" in photo
    assert "updateProfilePhoto" in photo
    assert "api.get('/driver/vehicles')" in api
    assert "api.post('/driver/profile-photo'" in api
