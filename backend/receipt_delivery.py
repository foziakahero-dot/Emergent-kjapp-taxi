"""Bounded delivery retries from the durable, paid receipt ledger.

Only newly created receipts are queued. Existing receipts are not bulk emailed.
The canonical sender retains its independent recipient locks and sent markers.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from pymongo import ReturnDocument


async def deliver_pending_receipt(db, send_receipts, configured):
    if not configured():
        return False
    now = datetime.now(timezone.utc)
    job = await db.receipt_ledger.find_one_and_update({
        "payment_status": "paid", "email_delivery_pending": True,
        "email_delivery_attempts": {"$lt": 8},
        "$and": [
            {"$or": [{"email_delivery_next_at": {"$exists": False}}, {"email_delivery_next_at": {"$lte": now}}]},
            {"$or": [{"email_delivery_lease_until": {"$exists": False}}, {"email_delivery_lease_until": {"$lte": now}}]},
        ],
    }, {"$set": {"email_delivery_lease_until": now + timedelta(minutes=5)},
        "$inc": {"email_delivery_attempts": 1}}, return_document=ReturnDocument.AFTER)
    if not job:
        return False
    try:
        await send_receipts(job["trip_id"])
    except Exception:
        # Do not put provider errors, tokens, recipient addresses or HTML in logs.
        logging.warning("Receipt delivery will retry")
    await db.receipt_ledger.update_one({"_id": job["_id"], "email_delivery_attempts": job["email_delivery_attempts"]}, {
        "$set": {"email_delivery_next_at": now + timedelta(minutes=min(60, 2 ** job["email_delivery_attempts"]))},
        "$unset": {"email_delivery_lease_until": ""},
    })
    return True


async def receipt_delivery_loop(db, send_receipts, configured):
    while True:
        try:
            for _ in range(20):
                if not await deliver_pending_receipt(db, send_receipts, configured):
                    break
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.warning("Receipt delivery worker temporarily unavailable")
        await asyncio.sleep(60)
