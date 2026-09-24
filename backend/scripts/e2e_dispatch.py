"""Portable KJAPP Oslo beta dispatch E2E.

Uses real API accounts supplied through environment variables; no credentials are stored in Git.

Required:
  KJAPP_E2E_CUSTOMER_EMAIL
  KJAPP_E2E_CUSTOMER_PASSWORD
  KJAPP_E2E_DRIVER_A_EMAIL
  KJAPP_E2E_DRIVER_A_PASSWORD
  KJAPP_E2E_DRIVER_B_EMAIL
  KJAPP_E2E_DRIVER_B_PASSWORD

Optional:
  KJAPP_E2E_API=https://github-app-builder-28.emergent.host
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = (
    os.environ.get("KJAPP_E2E_API")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://github-app-builder-28.emergent.host"
).rstrip("/")
UA = {"User-Agent": "KJAPP-beta-e2e/1.0", "Content-Type": "application/json"}
FAILS = []


def required(name: str) -> str:
    value = (os.environ.get(name) or "").strip()
    if not value:
        print(f"Missing required environment variable: {name}")
        sys.exit(2)
    return value


def call(path, data=None, token=None, method=None):
    headers = dict(UA)
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(
        API + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read() or b"{}"
            try:
                body = json.loads(raw)
            except Exception:
                body = raw.decode("utf-8", "ignore")
            return response.status, body
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            body = json.loads(raw or b"{}")
        except Exception:
            body = raw[:500].decode("utf-8", "ignore")
        return exc.code, body
    except Exception as exc:
        return 0, {"detail": f"{type(exc).__name__}: {exc}"}


def check(name, ok, detail=""):
    print(("PASS  " if ok else "FAIL  ") + name, detail)
    if not ok:
        FAILS.append(name)


def login(email, password):
    status, body = call("/api/auth/login", {"email": email, "password": password})
    if status != 200 or not isinstance(body, dict) or not body.get("token"):
        raise RuntimeError(f"Login failed for {email}: {status} {body}")
    return body["token"]


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def wait_for_offer(token, trip_id, seconds=8):
    end = time.time() + seconds
    last = None
    while time.time() < end:
        status, last = call("/api/driver/pending", None, token)
        if status == 200 and isinstance(last, dict):
            match = next((t for t in (last.get("trips") or []) if t.get("trip_id") == trip_id), None)
            if match:
                return match
        time.sleep(1)
    return None


CUSTOMER_EMAIL = required("KJAPP_E2E_CUSTOMER_EMAIL")
CUSTOMER_PASSWORD = required("KJAPP_E2E_CUSTOMER_PASSWORD")
DRIVER_A_EMAIL = required("KJAPP_E2E_DRIVER_A_EMAIL")
DRIVER_A_PASSWORD = required("KJAPP_E2E_DRIVER_A_PASSWORD")
DRIVER_B_EMAIL = required("KJAPP_E2E_DRIVER_B_EMAIL")
DRIVER_B_PASSWORD = required("KJAPP_E2E_DRIVER_B_PASSWORD")

customer = login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
driver_a = login(DRIVER_A_EMAIL, DRIVER_A_PASSWORD)
driver_b = login(DRIVER_B_EMAIL, DRIVER_B_PASSWORD)

# Youngstorget -> Solli plass. Driver A starts nearest and must receive the first offer.
PICKUP = (59.9139, 10.7497)
DROPOFF = (59.9138, 10.7213)

try:
    call("/api/driver/online", {"online": True}, driver_a)
    call("/api/driver/location", {
        "lat": 59.9160, "lng": 10.7500, "heading": 10, "speed": 0, "recorded_at": now_iso(),
    }, driver_a)

    call("/api/driver/online", {"online": True}, driver_b)
    call("/api/driver/location", {
        "lat": 59.9400, "lng": 10.7800, "heading": 10, "speed": 0, "recorded_at": now_iso(),
    }, driver_b)

    status, trip = call("/api/trips/request", {
        "pickup_address": "Youngstorget 1, Oslo",
        "pickup_lat": PICKUP[0],
        "pickup_lng": PICKUP[1],
        "dropoff_address": "Solli plass, Oslo",
        "dropoff_lat": DROPOFF[0],
        "dropoff_lng": DROPOFF[1],
        "vehicle_type": "ai-first",
    }, customer)
    check("customer created a real trip", status == 200 and isinstance(trip, dict) and trip.get("trip_id"), str(trip)[:120])
    if status != 200 or not isinstance(trip, dict) or not trip.get("trip_id"):
        sys.exit(1)
    trip_id = trip["trip_id"]

    dup_status, duplicate = call("/api/trips/request", {
        "pickup_address": "Youngstorget 1, Oslo",
        "pickup_lat": PICKUP[0],
        "pickup_lng": PICKUP[1],
        "dropoff_address": "Aker Brygge, Oslo",
        "dropoff_lat": 59.9108,
        "dropoff_lng": 10.7290,
        "vehicle_type": "ai-first",
    }, customer)
    check("duplicate active customer booking is rejected", dup_status == 409, str(duplicate)[:120])

    offer_a = wait_for_offer(driver_a, trip_id)
    check("nearest driver got the first offer", bool(offer_a), str(offer_a)[:120])
    if offer_a:
        check("offer has server expiry", bool(offer_a.get("offer_expires_at")), offer_a.get("offer_expires_at"))
        check("offer exposes real pickup route", bool(offer_a.get("pickup_route")), str(offer_a.get("pickup_route"))[:120])

    status, pending_b = call("/api/driver/pending", None, driver_b)
    ids_b = [t.get("trip_id") for t in (pending_b.get("trips") or [])] if isinstance(pending_b, dict) else []
    check("far driver cannot see sequential offer yet", trip_id not in ids_b, f"B sees {ids_b}")

    status, body = call("/api/driver/accept", {"trip_id": trip_id}, driver_b)
    check("far driver cannot snipe another driver's offer", status == 409, str(body)[:120])

    status, body = call("/api/driver/decline", {"trip_id": trip_id}, driver_a)
    check("first driver can decline owned offer", status == 200, str(body)[:120])

    offer_b = wait_for_offer(driver_b, trip_id)
    check("declined offer forwards to next eligible driver", bool(offer_b), str(offer_b)[:120])

    status, body = call("/api/driver/accept", {"trip_id": trip_id}, driver_b)
    check("second driver can accept forwarded offer", status == 200, str(body)[:120])

    status, body = call("/api/driver/accept", {"trip_id": trip_id}, driver_a)
    check("losing driver cannot accept after assignment", status == 409, str(body)[:120])

    status, current = call("/api/driver/current", None, driver_b)
    check("trip belongs to accepting driver", status == 200 and isinstance(current, dict) and current.get("trip_id") == trip_id, str(current)[:120])

    # Server now requires real fresh GPS close to pickup before at-pickup.
    call("/api/driver/location", {
        "lat": PICKUP[0], "lng": PICKUP[1], "heading": 250, "speed": 0, "recorded_at": now_iso(),
    }, driver_b)
    status, body = call(f"/api/driver/trip/{trip_id}/at-pickup", {}, driver_b)
    check("at-pickup requires real pickup GPS", status == 200, str(body)[:120])

    status, body = call(f"/api/driver/trip/{trip_id}/start", {}, driver_b)
    check("trip starts only after at-pickup", status == 200, str(body)[:120])

    # Server now requires real fresh GPS close to destination before arrive.
    call("/api/driver/location", {
        "lat": DROPOFF[0], "lng": DROPOFF[1], "heading": 260, "speed": 0, "recorded_at": now_iso(),
    }, driver_b)
    status, body = call(f"/api/driver/trip/{trip_id}/arrive", {}, driver_b)
    check("arrive requires real destination GPS", status == 200, str(body)[:120])

    status, body = call(f"/api/trips/{trip_id}/complete", {}, customer)
    check("customer completion after arrival succeeds", status == 200, str(body)[:120])

    status, body = call(f"/api/trips/{trip_id}/complete", {}, customer)
    check("customer completion is idempotent", status == 200, str(body)[:120])

    status, body = call(f"/api/trips/{trip_id}/rate", {"rating": 5, "feedback": "Oslo beta E2E"}, customer)
    check("passenger rates finished ride", status == 200, str(body)[:120])

    status, body = call(f"/api/trips/{trip_id}/rate", {"rating": 4, "feedback": "duplicate"}, customer)
    check("duplicate passenger rating is rejected", status == 400, str(body)[:120])

    status, body = call(f"/api/driver/trip/{trip_id}/rate-passenger", {"rating": 5, "feedback": "Oslo beta E2E"}, driver_b)
    check("assigned driver can rate passenger after ride", status == 200, str(body)[:120])

    status, summary = call("/api/driver/summary/today", None, driver_b)
    check("earnings reached assigned driver", status == 200 and isinstance(summary, dict) and summary.get("trips", 0) >= 1, str(summary)[:120])

    status, push = call("/api/push/native-config")
    check("native push config is exposed", status == 200 and isinstance(push, dict) and push.get("provider") == "expo", str(push)[:120])

    status, area = call("/api/service-area")
    check("Oslo service area is exposed", status == 200 and isinstance(area, dict) and area.get("launch_city") == "Oslo", str(area)[:120])

finally:
    call("/api/driver/online", {"online": False}, driver_b)
    call("/api/driver/online", {"online": False}, driver_a)

print("\nTarget:", API)
print("Result:", "ALL PASSED" if not FAILS else f"{len(FAILS)} FAILED -> {FAILS}")
sys.exit(1 if FAILS else 0)
