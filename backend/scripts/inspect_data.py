import asyncio
import os
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

SYNTHETIC_ADDRESS_RE = r"^\s*TEST[_\s-]"
LEGACY_DEMO_EMAILS = [
    "ola@kjapp.no",
    "sjafor@kjapp.no",
    "floteier1@kjapp.no",
    "demo1@kjapp.no",
    "demo2@kjapp.no",
    "demo3@kjapp.no",
    "demo4@kjapp.no",
    "demo5@kjapp.no",
    "demo6@kjapp.no",
    "demo_p_kari@kjapp.no",
    "demo_p_aisha@kjapp.no",
    "demo_p_erik@kjapp.no",
    "demo_p_sofia@kjapp.no",
]


def truthy(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    app_env = (os.environ.get("APP_ENV") or "development").strip().lower()
    demo_enabled = False if app_env == "production" else truthy(os.environ.get("ENABLE_DEMO_DATA"))

    synthetic_filter = {"$or": [
        {"synthetic": True},
        {"demo": True},
        {"pickup_address": {"$regex": SYNTHETIC_ADDRESS_RE}},
        {"dropoff_address": {"$regex": SYNTHETIC_ADDRESS_RE}},
    ]}
    real_filter = {"$and": [
        {"synthetic": {"$ne": True}},
        {"demo": {"$ne": True}},
        {"pickup_address": {"$not": {"$regex": SYNTHETIC_ADDRESS_RE}}},
        {"dropoff_address": {"$not": {"$regex": SYNTHETIC_ADDRESS_RE}}},
    ]}

    synthetic_trips = await db.trips.count_documents(synthetic_filter)
    real_trips = await db.trips.count_documents(real_filter)
    enabled_demo_users = await db.users.count_documents({"$or": [
        {"demo": True, "disabled": {"$ne": True}},
        {"is_demo": True, "disabled": {"$ne": True}},
        {"email": {"$in": LEGACY_DEMO_EMAILS}, "disabled": {"$ne": True}},
    ]})

    print("KJAPP DATA INTEGRITY")
    print("app_env", app_env)
    print("demo_data_enabled", demo_enabled)
    print("real_trips", real_trips)
    print("synthetic_trips", synthetic_trips)
    print("enabled_demo_users", enabled_demo_users)
    print("pending_real_trips", await db.trips.count_documents({
        "$and": [
            real_filter,
            {"status": {"$in": ["searching", "booking"]}},
        ]
    }))

    if synthetic_trips:
        print("synthetic trip samples:")
        async for t in db.trips.find(synthetic_filter).sort("created_at", -1).limit(10):
            print(
                "  -",
                t.get("trip_id"),
                "|",
                t.get("status"),
                "|",
                t.get("pickup_address"),
                "->",
                t.get("dropoff_address"),
                "| reason=",
                t.get("synthetic_reason") or ("demo" if t.get("demo") else "legacy-test"),
            )

    clean_live_mode = demo_enabled or (synthetic_trips == 0 and enabled_demo_users == 0)
    print("integrity_ok", clean_live_mode)
    client.close()

    if not clean_live_mode:
        sys.exit(2)


if __name__ == "__main__":
    asyncio.run(main())
