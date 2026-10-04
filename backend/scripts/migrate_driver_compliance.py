#!/usr/bin/env python3
"""KJAPP MongoDB compliance migration.

Dry-run by default. Use --apply to suspend drivers that do not have all four
required documents reviewed as valid.
"""
import argparse
import asyncio
import os
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

REQUIRED = {
    "drivers_license": "førerkort",
    "taxi_license": "kjøreseddel",
    "police_certificate": "politiattest",
    "profile_photo": "profilbilde",
}


async def run(apply: bool):
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    await db.uploaded_files.create_index([
        ("owner_user_id", 1), ("scope", 1), ("doc_type", 1), ("review_status", 1)
    ])

    affected = []
    async for user in db.users.find({"role": "driver"}):
        uid = str(user["_id"])
        latest = {}
        async for doc in db.uploaded_files.find({
            "owner_user_id": uid,
            "scope": "driver-docs",
            "is_deleted": {"$ne": True},
            "doc_type": {"$in": list(REQUIRED)},
        }).sort("created_at", -1):
            dtype = doc.get("doc_type")
            if dtype and dtype not in latest:
                latest[dtype] = doc

        problems = []
        for dtype, label in REQUIRED.items():
            doc = latest.get(dtype)
            if not doc:
                problems.append({"doc_type": dtype, "label": label, "reason": "missing"})
            elif doc.get("review_status") != "valid":
                problems.append({
                    "doc_type": dtype,
                    "label": label,
                    "reason": doc.get("review_status") or "pending",
                })

        if problems:
            affected.append({"user_id": uid, "email": user.get("email"), "problems": problems})
            if apply:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {
                        "approved": False,
                        "online": False,
                        "compliance_migration_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )

    print({"apply": apply, "affected_count": len(affected), "affected": affected})
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.apply))
