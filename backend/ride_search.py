"""Persisted, bounded driver search; retries reuse the same trip and reservation."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pymongo import ReturnDocument


SEARCH_ATTEMPTS = 2
SEARCH_TIMEOUT_SECONDS = 60
SEARCH_INTERVAL_SECONDS = 30


def timestamp(value, fallback):
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
    except (ValueError, TypeError):
        return fallback


def search_fields(trip, now):
    interval = SEARCH_INTERVAL_SECONDS
    started = timestamp(trip.get("authorized_at") or trip.get("created_at"), now)
    return {"search_started_at": started.isoformat(), "search_attempt": 1,
            "search_max_attempts": SEARCH_ATTEMPTS, "search_interval_seconds": interval,
            "search_next_attempt_at": (started + timedelta(seconds=interval)).isoformat(),
            "search_deadline_at": (started + timedelta(seconds=interval * SEARCH_ATTEMPTS)).isoformat(),
            "search_state": "searching"}


class RideSearch:
    def __init__(self, db, *, real_filter, offer, release, notify):
        self.db, self.real_filter = db, real_filter
        self.offer, self.release, self.notify = offer, release, notify

    async def cancel(self, trip_id, user_id, now=None):
        now = now or datetime.now(timezone.utc)
        cancelled = await self.db.trips.find_one_and_update(
            {**self.unassigned(trip_id), "user_id": user_id},
            {"$set": {"status": "cancelled", "cancelled_by": "customer", "cancel_reason": "customer_cancelled_search",
                      "search_state": "cancelled", "cancelled_at": now.isoformat(),
                      "offer_driver_id": None, "offer_expires_at": None}},
            return_document=ReturnDocument.AFTER)
        if cancelled:
            await self.release(cancelled)
            return True
        existing = await self.db.trips.find_one({"trip_id": trip_id, "user_id": user_id})
        return bool(existing and existing.get("status") == "cancelled" and existing.get("cancel_reason") == "customer_cancelled_search")

    def unassigned(self, trip_id):
        return self.real_filter({"trip_id": trip_id, "driver_id": None,
                                 "status": {"$in": ["searching", "booking"]}})

    async def ensure_started(self, trip, now=None):
        now = now or datetime.now(timezone.utc)
        if trip.get("search_started_at"):
            return trip
        updated = await self.db.trips.find_one_and_update(
            {**self.unassigned(trip["trip_id"]), "search_started_at": None},
            {"$set": search_fields(trip, now)}, return_document=ReturnDocument.AFTER)
        return updated or await self.db.trips.find_one({"trip_id": trip["trip_id"]})

    async def tick(self, trip, now=None):
        now = now or datetime.now(timezone.utc)
        trip = await self.ensure_started(trip, now)
        if not trip or trip.get("driver_id") or trip.get("status") not in ("searching", "booking"):
            return
        started = timestamp(trip.get("search_started_at"), now)
        deadline = min(timestamp(trip.get("search_deadline_at"), now), started + timedelta(seconds=SEARCH_TIMEOUT_SECONDS))
        if now >= deadline:
            cancelled = await self.db.trips.find_one_and_update(
                {**self.unassigned(trip["trip_id"]), "search_deadline_at": trip["search_deadline_at"]},
                {"$set": {"status": "cancelled", "cancelled_at": now.isoformat(),
                          "cancelled_by": "system", "cancel_reason": "no_driver_available",
                          "search_state": "exhausted", "search_attempt": SEARCH_ATTEMPTS,
                          "offer_driver_id": None, "offer_expires_at": None}},
                return_document=ReturnDocument.AFTER)
            if cancelled:
                # Release, never capture, the existing card hold after search ends.
                await self.release(cancelled)
                await self.notify(cancelled["user_id"], "Ingen ledig bil akkurat nå",
                                  "Ingen sjåfører tilgjengelig akkurat, prøv igjen senere", "/app")
            return
        next_at = timestamp(trip.get("search_next_attempt_at"), deadline)
        round_due = trip.get("search_attempt", 1) < SEARCH_ATTEMPTS and now >= next_at
        if round_due:
            started = timestamp(trip["search_started_at"], now)
            interval = trip["search_interval_seconds"]
            attempt = min(SEARCH_ATTEMPTS, int((now - started).total_seconds() // interval) + 1)
            updated = await self.db.trips.find_one_and_update(
                {**self.unassigned(trip["trip_id"]), "search_attempt": trip["search_attempt"],
                 "search_next_attempt_at": trip["search_next_attempt_at"]},
                {"$set": {"search_attempt": attempt,
                          "search_next_attempt_at": (started + timedelta(seconds=interval * attempt)).isoformat()}},
                return_document=ReturnDocument.AFTER)
            if not updated:
                return
            trip = updated
        offer_due = (trip.get("dispatch_mode") == "sequential" and trip.get("offer_expires_at")
                     and now >= timestamp(trip["offer_expires_at"], now))
        active_offer = (trip.get("dispatch_mode") == "sequential" and trip.get("offer_expires_at")
                        and now < timestamp(trip["offer_expires_at"], now))
        # Searches without an active offer query supply again, including newly online drivers.
        # Existing, unanswered sequential offers retain their original response window.
        if offer_due or (round_due and not active_offer) or not trip.get("offer_driver_id"):
            await self.offer(trip)
