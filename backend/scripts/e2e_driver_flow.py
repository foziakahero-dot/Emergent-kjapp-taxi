"""LEGACY isolated KJAPP lifecycle test.

IMPORTANT:
This script is intentionally blocked from beta/live. KJAPP no longer creates synthetic
rides against operational driver supply. Use it only after wiring an isolated test backend
and database specifically for synthetic lifecycle testing.

It does not exercise Expo UI or start an EAS build.
"""

import json
import os
import sys
import urllib.error
import urllib.request
import uuid


def _truthy(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


if not _truthy(os.environ.get("KJAPP_E2E_ISOLATED")):
    print(
        "BLOCKED: e2e_driver_flow.py may not run against beta/live. "
        "Synthetic trips are isolated from operational supply by design. "
        "Use a dedicated isolated test backend/database and set KJAPP_E2E_ISOLATED=true."
    )
    sys.exit(2)


def resolve_api():
    explicit = (os.environ.get("KJAPP_API_URL") or "").strip().rstrip("/")
    if explicit:
        return explicit

    candidates = [
        "/app/frontend/.env",
        os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"),
    ]
    for path in candidates:
        try:
            with open(path, encoding="utf-8") as handle:
                for line in handle:
                    if line.startswith("EXPO_PUBLIC_BACKEND_URL=") or line.startswith("REACT_APP_BACKEND_URL="):
                        base = line.split("=", 1)[1].strip().rstrip("/")
                        return base + "/api"
        except FileNotFoundError:
            pass

    return "https://github-app-builder-28.emergent.host/api"


API = resolve_api()
RUN_ID = "e2e-" + uuid.uuid4().hex[:10]
fails = []


def call(method, path, token=None, body=None):
    req = urllib.request.Request(API + path, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", f"KJAPP-beta-e2e/{RUN_ID}")
    req.add_header("X-KJAPP-E2E-Run", RUN_ID)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=35) as response:
            raw = response.read().decode()
            return response.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, raw


def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + (f"  {extra}" if extra else ""))
    if not cond:
        fails.append(name)


def transition(label, status):
    print(f"STATE [{RUN_ID}] {label} -> {status}")


def login(email, password):
    status, payload = call("POST", "/auth/login", body={"email": email, "password": password})
    check(f"customer login {email}", status == 200 and bool(payload and payload.get("token")), str(status))
    if status != 200 or not payload or not payload.get("token"):
        raise RuntimeError(f"customer login failed for {email}: {status} {payload}")
    return payload["token"], payload["user"]


def driver_login(identifier, password):
    status, payload = call(
        "POST",
        "/auth/driver-login",
        body={"identifier": identifier, "password": password},
    )
    check(
        f"driver login {identifier}",
        status == 200 and bool(payload and payload.get("token")),
        str(status),
    )
    if status != 200 or not payload or not payload.get("token"):
        raise RuntimeError(f"driver login failed for {identifier}: {status} {payload}")
    return payload["token"], payload["user"]


print(f"KJAPP E2E run={RUN_ID} api={API}")

customer_token, customer = login("ola@kjapp.no", "test1234")
driver_token, driver = driver_login("sjafor@kjapp.no", "sjafor1234")
check("driver role is driver", driver.get("role") == "driver", str(driver.get("role")))
check("driver is approved", driver.get("approved") is True, str(driver.get("approved")))

# A beta lifecycle test is only valid with a real fleet assignment and selected vehicle.
status, driver_profile = call("GET", "/driver/profile", driver_token)
check("driver profile available", status == 200 and bool(driver_profile), str(status))
if status != 200:
    print("PRECONDITION FAILED: driver profile is unavailable:", driver_profile)
    sys.exit(2)

assigned = driver_profile.get("assigned_vehicles") or []
active_vehicle = driver_profile.get("active_vehicle")
if not active_vehicle:
    if len(assigned) == 1:
        status, selected = call(
            "POST",
            "/driver/vehicle/select",
            driver_token,
            {"vehicle_id": assigned[0]["id"]},
        )
        check("select sole assigned fleet vehicle", status == 200, str(selected))
        if status == 200:
            active_vehicle = selected.get("active_vehicle")
    if not active_vehicle:
        print(
            "PRECONDITION FAILED: beta driver has no active fleet-assigned vehicle. "
            "Assign a vehicle in Fleet Web and select it in Driver before running E2E."
        )
        sys.exit(2)

check("driver has fleet company", bool(driver_profile.get("fleet")), str(driver_profile.get("fleet")))
check("driver has active assigned vehicle", bool(active_vehicle and active_vehicle.get("plate")), str(active_vehicle))
ride_vehicle_type = active_vehicle.get("vehicle_type") or "ai-first"
print(f"INFO  E2E will request vehicle_type={ride_vehicle_type} using {active_vehicle.get('car')} {active_vehicle.get('plate')}")

# Dedicated beta account hygiene: close a stale searching/booking ride before starting a new run.
status, stale = call("GET", "/trips/active", customer_token)
if status == 200 and stale and stale.get("status") in ("searching", "booking", "driver_on_way", "at_pickup"):
    call("POST", f"/trips/{stale['trip_id']}/cancel", customer_token)
    print(f"INFO  closed stale beta trip {stale['trip_id']} ({stale.get('status')})")

# Driver ready with a real GPS position and a fleet-assigned active vehicle.
online_status, online_payload = call("POST", "/driver/online", driver_token, {"online": True})
check("driver online", online_status == 200, str(online_payload))
if online_status != 200:
    print("Cannot continue lifecycle without a valid online driver:", online_payload)
    sys.exit(1)

check(
    "driver GPS update",
    call(
        "POST",
        "/driver/location",
        driver_token,
        {"lat": 59.9125, "lng": 10.7480, "heading": 90, "speed": 0},
    )[0] == 200,
)

_, summary_before = call("GET", "/driver/summary/today", driver_token)
base_income = summary_before.get("income", summary_before.get("trip_income", 0)) or 0
base_trips = summary_before.get("trips", 0) or 0
check("summary reports online", summary_before.get("online") is True, str(summary_before.get("online")))

# Customer quote + request.
status, estimate = call(
    "POST",
    "/trips/estimate",
    customer_token,
    {
        "pickup_lat": 59.9139,
        "pickup_lng": 10.7522,
        "dropoff_lat": 59.9106,
        "dropoff_lng": 10.7285,
        "vehicle_type": ride_vehicle_type,
    },
)
check("real route estimate", status == 200 and estimate.get("distance_km", 0) > 0, str(estimate))

status, trip = call(
    "POST",
    "/trips/request",
    customer_token,
    {
        "pickup_address": f"Jernbanetorget 1, Oslo [{RUN_ID}]",
        "pickup_lat": 59.9139,
        "pickup_lng": 10.7522,
        "dropoff_address": "Stranden 1, Aker Brygge",
        "dropoff_lat": 59.9106,
        "dropoff_lng": 10.7285,
        "vehicle_type": "ai-first",
    },
)
check("customer creates trip", status == 200 and bool(trip and trip.get("trip_id")), str(status))
if status != 200:
    print("trip request failed:", trip)
    sys.exit(1)
trip_id = trip["trip_id"]
transition("customer request", trip.get("status"))

# Driver receives and accepts.
status, pending = call("GET", "/driver/pending", driver_token)
offer = next((item for item in (pending or {}).get("trips", []) if item.get("trip_id") == trip_id), None)
check("driver receives requested trip", status == 200 and offer is not None)
check("offer has pickup route", bool(offer and offer.get("pickup_route")))
check("offer has driver earnings", offer is not None and offer.get("driver_earnings") is not None)

status, accepted = call("POST", "/driver/accept", driver_token, {"trip_id": trip_id})
check("driver accepts trip", status == 200, str(status))
if status == 200:
    snap = (accepted or {}).get("driver") or {}
    check("trip snapshots active fleet vehicle", snap.get("plate") == active_vehicle.get("plate"), str(snap))
    check("trip snapshots driver identity", bool(snap.get("name")), str(snap))
transition("driver accept", accepted.get("status") if isinstance(accepted, dict) else "driver_on_way")

status, customer_trip = call("GET", f"/trips/{trip_id}", customer_token)
check("customer sees driver_on_way", status == 200 and customer_trip.get("status") == "driver_on_way", str(customer_trip.get("status")))

# Two-way trip chat.
customer_text = f"Hei sjåfør {RUN_ID}"
driver_text = f"Hei kunde {RUN_ID}"
status, customer_msg = call("POST", f"/trips/{trip_id}/messages", customer_token, {"text": customer_text})
check("customer -> driver message stored", status == 200 and customer_msg.get("from_role") == "passenger")

status, driver_messages = call("GET", f"/trips/{trip_id}/messages", driver_token)
check(
    "driver reads customer message",
    status == 200 and any(m.get("text") == customer_text for m in driver_messages.get("messages", [])),
)

status, driver_msg = call("POST", f"/trips/{trip_id}/messages", driver_token, {"text": driver_text})
check("driver -> customer message stored", status == 200 and driver_msg.get("from_role") == "driver")

status, customer_messages = call("GET", f"/trips/{trip_id}/messages", customer_token)
check(
    "customer reads driver message",
    status == 200 and any(m.get("text") == driver_text for m in customer_messages.get("messages", [])),
)

# Pickup state.
status, _ = call("POST", f"/driver/trip/{trip_id}/at-pickup", driver_token)
check("driver marks at pickup", status == 200, str(status))
status, customer_trip = call("GET", f"/trips/{trip_id}", customer_token)
check("customer sees at_pickup", customer_trip.get("status") == "at_pickup", str(customer_trip.get("status")))
transition("pickup", customer_trip.get("status"))

# Start state.
status, _ = call("POST", f"/driver/trip/{trip_id}/start", driver_token)
check("driver starts ride", status == 200, str(status))
status, customer_trip = call("GET", f"/trips/{trip_id}", customer_token)
check("customer sees in_trip", customer_trip.get("status") == "in_trip", str(customer_trip.get("status")))
transition("start", customer_trip.get("status"))

# State machine guard: customer cannot close the trip before driver arrival.
status, premature = call("POST", f"/trips/{trip_id}/complete", customer_token)
check("premature customer completion rejected", status == 409, str(premature))

# Driver arrival.
status, _ = call("POST", f"/driver/trip/{trip_id}/arrive", driver_token)
check("driver marks arrived", status == 200, str(status))
status, customer_trip = call("GET", f"/trips/{trip_id}", customer_token)
check("customer sees arrived", customer_trip.get("status") == "arrived", str(customer_trip.get("status")))
transition("arrival", customer_trip.get("status"))

# Customer closes receipt; endpoint must be idempotent.
status, completed = call("POST", f"/trips/{trip_id}/complete", customer_token)
check("customer completes arrived ride", status == 200 and completed.get("status") == "completed", str(completed.get("status")))
transition("receipt close", completed.get("status"))

status, completed_again = call("POST", f"/trips/{trip_id}/complete", customer_token)
check("completion is idempotent", status == 200 and completed_again.get("status") == "completed")

status, active = call("GET", "/trips/active", customer_token)
check("customer has no active ride after completion", status == 200 and not active, str(active))

# Rating moves final status to rated and history keeps it.
status, rated = call("POST", f"/trips/{trip_id}/rate", customer_token, {"rating": 5, "feedback": f"E2E {RUN_ID}"})
check("customer rates trip", status == 200 and rated.get("ok") is True)

status, final_trip = call("GET", f"/trips/{trip_id}", customer_token)
check("final status is rated", status == 200 and final_trip.get("status") == "rated", str(final_trip.get("status")))
transition("rating", final_trip.get("status"))

status, history = call("GET", "/trips", customer_token)
history_items = history.get("trips", history if isinstance(history, list) else [])
check("trip is stored in customer history", any(t.get("trip_id") == trip_id for t in history_items))

# Driver summary and current endpoint: backend may expose the just-finished summary, but it must not
# be an active lifecycle state. The Driver RN UI now filters arrived/completed/rated out of current.
status, current_after = call("GET", "/driver/current", driver_token)
check(
    "driver current is not an active lifecycle state",
    status == 200 and (not current_after or current_after.get("status") in ("arrived", "completed", "rated")),
    str(current_after and current_after.get("status")),
)

_, summary_after = call("GET", "/driver/summary/today", driver_token)
after_trips = summary_after.get("trips", 0) or 0
after_income = summary_after.get("income", summary_after.get("trip_income", 0)) or 0
check("driver trip count increments", after_trips >= base_trips + 1, f"{base_trips} -> {after_trips}")
check("driver income increments", after_income >= base_income, f"{base_income} -> {after_income}")

# GDPR exports contain the ride for both account roles plus trip chat.
status, customer_export = call("GET", "/gdpr/export", customer_token)
check("customer GDPR export v2", status == 200 and customer_export.get("format_version") == 2)
check(
    "customer GDPR contains customer trip",
    any(t.get("trip_id") == trip_id for t in customer_export.get("customer_trips", [])),
)
check(
    "customer GDPR contains trip chat",
    any(m.get("trip_id") == trip_id for m in customer_export.get("trip_messages", [])),
)

status, driver_export = call("GET", "/gdpr/export", driver_token)
check("driver GDPR export v2", status == 200 and driver_export.get("format_version") == 2)
check(
    "driver GDPR contains driven trip",
    any(t.get("trip_id") == trip_id for t in driver_export.get("driver_trips", [])),
)

# Driver back to ready/offline and disappears from customer supply.
call("POST", "/driver/online", driver_token, {"online": False})
_, summary_offline = call("GET", "/driver/summary/today", driver_token)
check("driver offline persists", summary_offline.get("online") is False)

status, nearby = call("POST", "/cars/nearby", body={"lat": 59.9139, "lng": 10.7522})
cars = nearby.get("cars", []) if isinstance(nearby, dict) else []
check(
    "offline test driver is absent from customer map",
    all(str(car.get("id")) != str(driver.get("id")) for car in cars),
    f"{len(cars)} nearby cars",
)

print("\nRESULT:", "ALL PASSED" if not fails else f"{len(fails)} FAILED -> {fails}")
sys.exit(1 if fails else 0)
