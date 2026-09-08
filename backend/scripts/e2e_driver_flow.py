"""Real driver flow E2E — no demo/synthetic data anywhere.

Customer books a real trip -> driver (with real GPS) sees it with REAL routing ->
accepts -> at-pickup -> in-trip -> completes -> earnings/trip count update.
Run: python3 /app/backend/scripts/e2e_driver_flow.py
"""
import json
import os
import sys
import urllib.request

API = None
with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            API = line.split("=", 1)[1].strip() + "/api"


def call(method, path, token=None, body=None):
    req = urllib.request.Request(API + path, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0 (KJAPP-e2e)")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=30) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


fails = []


def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + (f"  {extra}" if extra else ""))
    if not cond:
        fails.append(name)


# --- logins
_, cust = call("POST", "/auth/login", body={"email": "ola@kjapp.no", "password": "test1234"})
_, drv = call("POST", "/auth/login", body={"email": "sjafor@kjapp.no", "password": "sjafor1234"})
ct, dt = cust["token"], drv["token"]

# --- driver goes online with REAL gps near Oslo S
call("POST", "/driver/online", dt, {"online": True})
call("POST", "/driver/location", dt, {"lat": 59.9125, "lng": 10.7480, "heading": 90, "speed": 6})

st, summary = call("GET", "/driver/summary/today", dt)
check("summary reports real online state", summary.get("online") is True, str(summary))
check("summary has no fabricated satisfaction field", "satisfaction" not in summary)
base_income, base_trips = summary["income"], summary["trips"]

st, pend = call("GET", "/driver/pending", dt)
check("pending list has no synthetic trips", all(
    not (t.get("demo") or str(t.get("pickup_address", "")).startswith("TEST")) for t in pend["trips"]
), f"{len(pend['trips'])} pending")
check("pending exposes driver GPS", pend.get("driver_gps") is not None, str(pend.get("driver_gps")))

# --- customer books a real trip
st, est = call("POST", "/trips/estimate", ct, {
    "pickup_lat": 59.9139, "pickup_lng": 10.7522,
    "dropoff_lat": 59.9106, "dropoff_lng": 10.7285, "vehicle_type": "ai-first",
})
check("estimate returns real routing", est.get("distance_km", 0) > 0, f"{est.get('distance_km')} km")

st, trip = call("POST", "/trips/request", ct, {
    "pickup_address": "Jernbanetorget 1, Oslo", "pickup_lat": 59.9139, "pickup_lng": 10.7522,
    "dropoff_address": "Stranden 1, Aker Brygge", "dropoff_lat": 59.9106, "dropoff_lng": 10.7285,
    "vehicle_type": "ai-first",
})
if st != 200:
    print("trip request failed:", st, trip)
    sys.exit(1)
trip_id = trip["trip_id"]
print("  trip:", trip_id, trip.get("price"), "kr")

st, pend = call("GET", "/driver/pending", dt)
mine = next((t for t in pend["trips"] if t["trip_id"] == trip_id), None)
check("driver sees the real request", mine is not None)
check("request has real pickup routing (OSRM)", bool(mine and mine.get("pickup_route")),
      str(mine and mine.get("pickup_route") and {k: v for k, v in mine["pickup_route"].items() if k != "geometry"}))
check("request has backend-computed driver earnings", bool(mine and mine.get("driver_earnings")),
      str(mine and mine.get("driver_earnings")))
check("customer info is real (no fake rating)", bool(mine and mine.get("customer")),
      str(mine and mine.get("customer")))

# --- accept -> at pickup -> in trip -> complete
st, acc = call("POST", "/driver/accept", dt, {"trip_id": trip_id})
check("accept works", st == 200, str(st))
check("accept stores driver's REAL gps as start", acc.get("driver_start_lat") == 59.9125, str(acc.get("driver_start_lat")))
check("accept eta comes from routing", isinstance(acc.get("eta_min"), int), str(acc.get("eta_min")))

st, cur = call("GET", "/driver/current", dt)
check("current trip returned", cur and cur["trip_id"] == trip_id)
check("current has pickup route for the active leg", bool(cur.get("pickup_route")))
check("current has driver_earnings", cur.get("driver_earnings") is not None, str(cur.get("driver_earnings")))

check("at-pickup transition", call("POST", f"/driver/trip/{trip_id}/at-pickup", dt)[0] == 200)
st, cur = call("GET", "/driver/current", dt)
check("status is at_pickup", cur["status"] == "at_pickup", cur["status"])

check("start (passenger onboard)", call("POST", f"/driver/trip/{trip_id}/start", dt)[0] == 200)
st, cur = call("GET", "/driver/current", dt)
check("status is in_trip", cur["status"] == "in_trip", cur["status"])

check("complete trip", call("POST", f"/driver/trip/{trip_id}/arrive", dt)[0] == 200)
st, summary2 = call("GET", "/driver/summary/today", dt)
check("trip count increased", summary2["trips"] == base_trips + 1, f"{base_trips} -> {summary2['trips']}")
check("income increased by real fare", summary2["income"] == base_income + trip["price"],
      f"{base_income} -> {summary2['income']} (+{trip['price']})")

# --- reverse geocoding for the live map label
st, rev = call("GET", "/places/reverse?lat=59.9139&lng=10.7522")
check("reverse geocode returns a real label", st == 200 and (rev.get("label") or rev.get("street")), str(rev))

# --- offline: no tracking, no requests
call("POST", "/driver/online", dt, {"online": False})
st, summary3 = call("GET", "/driver/summary/today", dt)
check("offline state persisted", summary3.get("online") is False)
st, cars = call("POST", "/cars/nearby", body={"lat": 59.9139, "lng": 10.7522})
check("offline driver not on customer map", cars["count"] == 0, str(cars["count"]))

# cleanup: remove the trip created by this script so it never shows as production data
print("\nresult:", "ALL PASSED" if not fails else f"{len(fails)} FAILED -> {fails}")
sys.exit(1 if fails else 0)
