import asyncio, os, sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")


async def main():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    print("trips total", await db.trips.count_documents({}))
    print("demo trips", await db.trips.count_documents({"demo": True}))
    print("TEST_ pickup trips", await db.trips.count_documents({"pickup_address": {"$regex": "^TEST"}}))
    print("pending trips", await db.trips.count_documents({"status": {"$in": ["searching", "booking"]}}))
    async for t in db.trips.find({"status": {"$in": ["searching", "booking"]}}).limit(10):
        print("  -", t.get("status"), "|", t.get("pickup_address"), "->", t.get("dropoff_address"), "|", t.get("price"), "| demo=", t.get("demo"))
    print("demo users", await db.users.count_documents({"demo": True}))
    async for u in db.users.find({"demo": True}, {"email": 1, "role": 1}):
        print("   demo user", u.get("email"), u.get("role"))
    print("users total", await db.users.count_documents({}))
    async for u in db.users.find({"email": {"$regex": "TEST|test_"}}, {"email": 1, "role": 1}).limit(10):
        print("   test user", u.get("email"), u.get("role"))
    print("fleets", await db.fleets.count_documents({}))


asyncio.run(main())
