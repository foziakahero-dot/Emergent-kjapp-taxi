"""Bonus quests ("Oppdrag") — real end-to-end check.

Admin creates a quest (complete N trips inside a time window -> +X kr). A real driver then
completes real trips and the bonus must be awarded exactly once, shown in today's income and
in the pending payout — paid by KJAPP, so the passenger price is untouched.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

API = (os.environ.get("KJAPP_E2E_API") or "").strip().rstrip("/")
if not API:
    API = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/")
ALLOW_MUTATION = (os.environ.get("KJAPP_E2E_ALLOW_MUTATION") or "").strip().lower() in {"1", "true", "yes", "on"}
ISOLATED = (os.environ.get("KJAPP_E2E_ISOLATED") or "").strip().lower() in {"1", "true", "yes", "on"}
LIVE_APIS = {
    "https://github-app-builder-28.emergent.host",
    "https://api.kjappapp.no",
}
if API in LIVE_APIS:
    print("REFUSED: e2e_bonus.py may never mutate the shared KJAPP beta/production API.")
    sys.exit(3)
if not (ALLOW_MUTATION and ISOLATED):
    print("REFUSED: e2e_bonus.py requires an isolated backend/database and explicit mutation flags.")
    sys.exit(3)

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


admin = login("admin@kjapp.no", "admin123")
cust = login("ola@kjapp.no", "test1234")
drv = login("sjafor@kjapp.no", "sjafor1234")

# A window that definitely contains "now" in Oslo local time
hour = datetime.now(timezone.utc).astimezone(ZoneInfo("Europe/Oslo")).hour
st, camp = call("/api/admin/bonus-campaigns", {
    "name": "E2E testoppdrag", "trips_required": 2, "bonus_kr": 150,
    "start_hour": max(0, hour), "end_hour": min(24, hour + 1), "max_per_driver_per_day": 1, "active": True,
}, admin)
check("admin created a bonus quest", st == 200, f"{camp.get('name')} +{camp.get('bonus_kr')} kr")
cid = camp["id"]

st, before = call("/api/driver/summary/today", None, drv)
income_before, bonus_before = before["income"], before.get("bonus", 0)
st, b0 = call("/api/driver/bonus", None, drv)
quest = next((q for q in b0["campaigns"] if q["id"] == cid), None)
check("driver sees the quest with real progress", quest is not None and quest["in_window"], json.dumps(quest)[:110] if quest else "")
start_progress = quest["progress"] if quest else 0

call("/api/driver/online", {"online": True}, drv)
call("/api/driver/location", {"lat": 59.9139, "lng": 10.7497, "heading": 0}, drv)

awarded = []
for i in range(2):
    st, trip = call("/api/trips/request", {
        "pickup_address": f"Youngstorget {i + 1}, Oslo", "pickup_lat": 59.9139, "pickup_lng": 10.7497,
        "dropoff_address": "Solli plass, Oslo", "dropoff_lat": 59.9138, "dropoff_lng": 10.7213,
        "vehicle_type": "enkelt",
    }, cust)
    assert st == 200, (st, trip)
    tid = trip["trip_id"]
    st, _ = call("/api/driver/accept", {"trip_id": tid}, drv)
    check(f"driver accepted real trip {i + 1}", st == 200)
    for ep in ["at-pickup", "start"]:
        call(f"/api/driver/trip/{tid}/{ep}", {}, drv)
    st, res = call(f"/api/driver/trip/{tid}/arrive", {}, drv)
    check(f"trip {i + 1} completed", st == 200, f"bonuses: {res.get('bonuses') if isinstance(res, dict) else res}")
    if isinstance(res, dict) and res.get("bonuses"):
        awarded += res["bonuses"]

check("bonus awarded exactly once when the target was hit", len(awarded) == 1, str(awarded))
check("bonus amount is the configured one", awarded and awarded[0]["amount"] == 150, str(awarded[:1]))

st, after = call("/api/driver/summary/today", None, drv)
check("today's income includes the bonus", after.get("bonus", 0) == bonus_before + 150,
      f"bonus {bonus_before} -> {after.get('bonus')}")
check("income = trip income + bonus", after["income"] == after["trip_income"] + after["bonus"],
      f"{after['trip_income']} + {after['bonus']} = {after['income']}")

st, pay = call("/api/driver/payouts", None, drv)
check("pending payout contains the bonus", pay.get("pending_bonus", 0) >= 150,
      f"bonus {pay.get('pending_bonus')} kr, netto {pay.get('pending_net')} kr")

st, b1 = call("/api/driver/bonus", None, drv)
q1 = next((q for q in b1["campaigns"] if q["id"] == cid), None)
check("quest is capped after payout (no double dipping)", q1 is not None and q1["cap_reached"], json.dumps(q1)[:110] if q1 else "")

st, ap = call("/api/admin/bonus-payouts", None, admin)
mine = [p for p in ap["payouts"] if p["campaign_id"] == cid]
check("admin sees the payout with driver name", len(mine) == 1 and mine[0].get("driver_name"), json.dumps(mine[:1], ensure_ascii=False)[:150])

st, cl = call("/api/admin/bonus-campaigns", None, admin)
row = next((c for c in cl["campaigns"] if c["id"] == cid), None)
check("admin campaign shows real spend", row and row["payouts_count"] == 1 and row["spent_kr"] == 150,
      f"{row.get('payouts_count')}× / {row.get('spent_kr')} kr" if row else "")

st, _ = call(f"/api/admin/bonus-campaigns/{cid}", {"active": False}, admin, method="PATCH")
check("admin can switch the quest off", st == 200)
st, b2 = call("/api/driver/bonus", None, drv)
check("inactive quest disappears for the driver", not any(q["id"] == cid for q in b2["campaigns"]))

st, _ = call("/api/driver/bonus", None, cust)
check("customer cannot read driver bonuses", st == 403, str(st))
st, _ = call("/api/admin/bonus-campaigns", {"name": "x", "trips_required": 1, "bonus_kr": 1}, drv)
check("driver cannot create campaigns", st == 403, str(st))

call(f"/api/admin/bonus-campaigns/{cid}", None, admin, method="DELETE")
call("/api/driver/online", {"online": False}, drv)

print("\nresult:", "ALL PASSED" if not fails else f"{len(fails)} FAILED -> {fails}")
sys.exit(1 if fails else 0)
