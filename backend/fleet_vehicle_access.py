"""Persistent fleet permissions and an atomic, exclusive vehicle claim per online shift."""
from bson import ObjectId
from fastapi import HTTPException
from datetime import datetime, timedelta, timezone


ACTIVE_STATUSES = ["driver_on_way", "at_pickup", "in_trip", "arrived"]


def access_query(driver):
    query = {"fleet_id": driver.get("fleet_id"), "active": {"$ne": False}}
    mode = driver.get("vehicle_access_mode", "assigned")
    driver_id = driver.get("id") or str(driver.get("_id"))
    if mode == "selected":
        query["_id"] = {"$in": [ObjectId(v) for v in driver.get("allowed_vehicle_ids", []) if ObjectId.is_valid(v)]}
    elif mode != "all":
        query["assigned_driver_id"] = driver_id
    return query


async def release_vehicle(db, driver_id):
    await db.fleet_vehicles.update_many({"active_driver_id": driver_id},
                                      {"$unset": {"active_driver_id": "", "active_driver_claimed_at": ""}})


async def claim_vehicle(db, driver, vehicle):
    driver_id = driver.get("id") or str(driver["_id"])
    vid = str(vehicle["_id"])
    # Protect shifts started before deployment, which do not yet have a claim.
    other = await db.users.find_one({"role":"driver", "fleet_id":driver["fleet_id"],
        "vehicle_id":vid, "online":True, "_id":{"$ne":ObjectId(driver_id)}})
    if other:
        raise HTTPException(409, "Bilen er allerede i bruk av en annen sjåfør. Velg en annen bil.")
    holder = vehicle.get("active_driver_id")
    if holder and holder != driver_id:
        claimed_at = vehicle.get("active_driver_claimed_at")
        if isinstance(claimed_at, datetime):
            if claimed_at.tzinfo is None:
                claimed_at = claimed_at.replace(tzinfo=timezone.utc)
            if claimed_at > datetime.now(timezone.utc) - timedelta(minutes=2):
                raise HTTPException(409, "En annen sjåfør er i ferd med å ta bilen i bruk.")
        account = await db.users.find_one({"_id":ObjectId(holder)})
        active = await db.trips.find_one({"driver_id":holder,"status":{"$in":ACTIVE_STATUSES}})
        if (account or {}).get("online") or active:
            raise HTTPException(409, "Bilen er allerede i bruk av en annen sjåfør.")
        await db.fleet_vehicles.update_one({"_id":vehicle["_id"],"active_driver_id":holder},
                                         {"$unset":{"active_driver_id":"", "active_driver_claimed_at":""}})
    query = access_query(driver)
    if "_id" in query:
        query["$and"] = [{"_id":query.pop("_id")}]
    query.update({"_id":vehicle["_id"], "$or":[{"active_driver_id":{"$exists":False}},
                    {"active_driver_id":None}, {"active_driver_id":driver_id}]})
    result = await db.fleet_vehicles.update_one(query, {"$set":{"active_driver_id":driver_id,
        "active_driver_claimed_at": datetime.now(timezone.utc)}})
    if result.matched_count != 1:
        raise HTTPException(409, "Bilen ble tatt av en annen sjåfør eller tilgangen ble endret. Velg bil på nytt.")
