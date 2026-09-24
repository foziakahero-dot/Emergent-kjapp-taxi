"""Nearest-driver-first dispatch check with two REAL driver accounts.

Driver A sits closer to the pickup than driver B. The trip must be offered to A first,
forwarded to B when A does not answer (or declines), and B must then be able to accept it.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

import asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.environ.get("KJAPP_BACKEND_ENV", "/app/backend/.env"))
API = (
    os.environ.get("KJAPP_E2E_API")
    or os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://github-app-builder-28.emergent.host"
).rstrip("/")
UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}
fails = []


def call(path, data=None, token=None, method=None):
    h = dict(UA)
    if token:
        h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(
        API + path, data=json.dumps(data).encode() if data is not None else None, headers=h, method=method
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200].decode("utf-8", "ignore")


def check(name, ok, detail=""):
    print(("PASS  " if ok else "FAIL  ") + name, detail)
    if not ok:
        fails.append(name)


def login(email, pw):
    st, d = call("/api/auth/login", {"email": email, "password": pw})
    assert st == 200, (email, st, d)
    return d["token"]


DRIVER_B_EMAIL = "sjafor2@kjapp.no"
DRIVER_B_PW = "sjafor2234"


async def ensure_driver_b():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    u = await db.users.find_one({"email": DRIVER_B_EMAIL})
    if u:
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"role": "driver", "approved": True}})
        return
    st, d = call("/api/auth/register", {
        "fullName": "Kari Sjåfør", "email": DRIVER_B_EMAIL, "password": DRIVER_B_PW, "phone": "+4790000002",
    })
    assert st in (200, 201), (st, d)
    await db.users.update_one(
        {"email": DRIVER_B_EMAIL},
        {"$set": {"role": "driver", "approved": True, "car": "Volvo XC60", "plate": "KA98765", "fullName": "Kari Sjåfør"}},
    )


asyncio.run(ensure_driver_b())

cust = login("ola@kjapp.no", "test1234")
drv_a = login("sjafor@kjapp.no", "sjafor1234")
drv_b = login(DRIVER_B_EMAIL, DRIVER_B_PW)

# Pickup: Youngstorget. A is 300 m away, B is ~3 km away.
PICKUP = (59.9139, 10.7497)
call("/api/driver/online", {"online": True}, drv_a)
now_iso = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
call("/api/driver/location", {"lat": 59.9160, "lng": 10.7500, "heading": 10, "recorded_at": now_iso}, drv_a)
call("/api/driver/online", {"online": True}, drv_b)
call("/api/driver/location", {"lat": 59.9400, "lng": 10.7800, "heading": 10, "recorded_at": now_iso}, drv_b)

st, trip = call("/api/trips/request", {
    "pickup_address": "Youngstorget 1, Oslo", "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
    "dropoff_address": "Solli plass, Oslo", "dropoff_lat": 59.9138, "dropoff_lng": 10.7213,
    "vehicle_type": "enkelt",
}, cust)
check("customer created a real trip", st == 200, f"{trip.get('trip_id','')[:8]} {trip.get('price')} kr")
if st != 200:
    print("\nCannot continue E2E because trip creation failed:", trip)
    sys.exit(1)
tid = trip["trip_id"]

st2, duplicate = call("/api/trips/request", {
    "pickup_address": "Youngstorget 1, Oslo", "pickup_lat": PICKUP[0], "pickup_lng": PICKUP[1],
    "dropoff_address": "Aker Brygge, Oslo", "dropoff_lat": 59.9108, "dropoff_lng": 10.7290,
    "vehicle_type": "enkelt",
}, cust)
check("duplicate active customer booking is rejected", st2 == 409, str(duplicate)[:90])

st, pa = call("/api/driver/pending", None, drv_a)
st, pb = call("/api/driver/pending", None, drv_b)
ids_a = [t["trip_id"] for t in pa["trips"]]
ids_b = [t["trip_id"] for t in pb["trips"]]
check("nearest driver got the offer", tid in ids_a, f"A sees {len(ids_a)}")
check("far driver does NOT see it yet", tid not in ids_b, f"B sees {len(ids_b)}")
offer = next((t for t in pa["trips"] if t["trip_id"] == tid), {})
check("offer has a real countdown", bool(offer.get("offer_expires_at")), str(offer.get("offer_expires_at"))[11:19])

st, res = call("/api/driver/accept", {"trip_id": tid}, drv_b)
check("far driver cannot snipe the offer", st == 409, str(res)[:80])

print("... waiting for the 20 s offer window to expire")
time.sleep(26)
st, pb2 = call("/api/driver/pending", None, drv_b)
st, pa2 = call("/api/driver/pending", None, drv_a)
check("unanswered offer forwarded to next driver", tid in [t["trip_id"] for t in pb2["trips"]], f"B sees {len(pb2['trips'])}")

st, res = call("/api/driver/accept", {"trip_id": tid}, drv_b)
check("second driver can accept the forwarded trip", st == 200, str(res)[:60])

st_again, res_again = call("/api/driver/accept", {"trip_id": tid}, drv_a)
check("losing driver cannot accept after assignment", st_again == 409, str(res_again)[:80])
st, cur = call("/api/driver/current", None, drv_b)
check("trip is assigned to the accepting driver", (cur or {}).get("trip_id") == tid, (cur or {}).get("status"))
st, cur_a = call("/api/driver/current", None, drv_a)
check(
    "other driver has no ACTIVE trip",
    not cur_a or cur_a.get("status") in ("arrived", "completed", "rated"),
    (cur_a or {}).get("status", "none"),
)

for ep in ["at-pickup", "start", "arrive"]:
    st, _ = call(f"/api/driver/trip/{tid}/{ep}", {}, drv_b)
    check(f"state machine: {ep}", st == 200)

st, done = call(f"/api/trips/{tid}/complete", {}, cust)
check("customer completion is accepted only after arrival", st == 200, str(done)[:80])

st, done2 = call(f"/api/trips/{tid}/complete", {}, cust)
check("customer completion is idempotent", st == 200, str(done2)[:80])

st, s = call("/api/driver/summary/today", None, drv_b)
check("earnings landed on the driver who drove", s["trips"] >= 1, f"{s['trips']} turer {s['income']} kr")

st, cfg = call("/api/push/native-config")
check("native push config endpoint is available", st == 200 and cfg.get("provider") == "expo", json.dumps(cfg)[:120])

st, area = call("/api/service-area")
check("Oslo beta service-area endpoint is available", st == 200 and area.get("launch_city") == "Oslo", json.dumps(area)[:120])

call("/api/driver/online", {"online": False}, drv_b)
call("/api/driver/online", {"online": False}, drv_a)

print("\nresult:", "ALL PASSED" if not fails else f"{len(fails)} FAILED -> {fails}")
sys.exit(1 if fails else 0)
