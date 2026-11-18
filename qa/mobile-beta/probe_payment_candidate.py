"""Reproduce financial release blockers using the candidate code and fake Stripe.

Usage: python probe_payment_candidate.py --repo /path/to/PR145 --output probe.json
No network, real database, provider request or account data is used.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    sys.path[:0] = [str(args.repo / "backend"), str(args.repo / "backend/tests")]
    from bson import ObjectId
    from fastapi import HTTPException
    import mongomock
    from service_fee_policy import resolve_commission_rate, set_platform_commission_rate, get_platform_commission_config
    from test_ride_reservations import Collection, fixture

    async def probe():
        raw = mongomock.MongoClient().financial_probe
        db = SimpleNamespace(fleets=Collection(raw.fleets), fleet_vehicles=Collection(raw.fleet_vehicles))
        result = []

        def record(name, expected, observed):
            result.append({"case": name, "expected": expected, "observed": observed,
                           "status": "PASS" if observed == expected else "FAIL"})

        previous = os.environ.pop("SNAR_SERVICE_FEE_RATE", None)
        try:
            record("platform_default_12_percent", 0.12, (await resolve_commission_rate(db, {}))[0])
            fleet, vehicle = ObjectId(), ObjectId()
            raw.fleets.insert_one({"_id": fleet, "commission_rate": 0.07})
            raw.fleet_vehicles.insert_one({"_id": vehicle, "fleet_id": str(fleet), "commission_rate": 0.03})
            record("fleet_ObjectId_override", 0.07, (await resolve_commission_rate(db, {"fleet_id": str(fleet)}))[0])
            record("vehicle_ObjectId_override", 0.03, (await resolve_commission_rate(db, {"fleet_id": str(fleet), "vehicle_id": str(vehicle)}))[0])
            record("historic_zero_snapshot", 0.0, (await resolve_commission_rate(db, {"commission_rate": 0.0, "commission_source": "subscription_v1"}))[0])
            await set_platform_commission_rate(db, 0.19, {"id": "synthetic-admin"})
            os.environ.pop("SNAR_SERVICE_FEE_RATE", None)  # Simulate a new worker/restart.
            record("platform_setting_survives_worker_restart", 0.19, (await get_platform_commission_config(db))["platform_default_rate"])

            service, trip, raw, intents, events, receipts = fixture()
            async def discount(*_):
                return 20
            service.campaign_discount = discount
            try:
                await service.authorize(trip)
                observed = "authorized_and_dispatched"
            except HTTPException as error:
                observed = {"http": error.status_code, "reason": error.detail,
                            "dispatch_count": sum(event[0] == "dispatch" for event in events)}
            record("discounted_reservation_can_activate", "authorized_and_dispatched", observed)
        finally:
            if previous is None:
                os.environ.pop("SNAR_SERVICE_FEE_RATE", None)
            else:
                os.environ["SNAR_SERVICE_FEE_RATE"] = previous
        return {"scope": "local candidate code, mongomock and fake Stripe only", "cases": result}

    result = asyncio.run(probe())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if any(row["status"] == "FAIL" for row in result["cases"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
