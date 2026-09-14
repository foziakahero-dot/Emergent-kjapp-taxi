"""KJAPP release hardening routes.

This module is intentionally small and reviewable. It is loaded by backend/server.py after the
legacy/core FastAPI app has been constructed, removes only explicitly listed vulnerable routes,
and installs hardened replacements. Business logic outside those routes remains byte-for-byte
unchanged in server_core.py.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
import uuid

from fastapi import Depends, HTTPException, Request
from fastapi.routing import APIRoute
import stripe

import server_core as core


PASSENGER_CANCELLABLE_STATES = {"searching", "booking", "driver_on_way", "at_pickup"}
FINISHED_TRIP_STATES = {"arrived", "completed", "rated"}
RATABLE_PASSENGER_STATES = {"arrived", "completed"}
PAYMENT_LOCK_TTL = timedelta(minutes=2)


def _remove_route(path: str, method: str) -> None:
    """Remove one exact route from the already-built core app before registering its replacement."""
    method = method.upper()
    kept = []
    removed = 0
    for route in core.app.router.routes:
        if isinstance(route, APIRoute) and route.path == path and method in route.methods:
            removed += 1
            continue
        kept.append(route)
    if removed != 1:
        raise RuntimeError(f"Expected exactly one {method} {path} route, found {removed}")
    core.app.router.routes[:] = kept


def _install_routes() -> None:
    # Passenger trip state integrity
    _remove_route("/api/trips/{trip_id}/complete", "POST")
    _remove_route("/api/trips/{trip_id}/rate", "POST")
    _remove_route("/api/driver/trip/{trip_id}/rate-passenger", "POST")
    _remove_route("/api/trips/{trip_id}/cancel", "POST")

    # Payment integrity / ownership
    _remove_route("/api/payments/checkout", "POST")
    _remove_route("/api/payments/status/{session_id}", "GET")
    _remove_route("/api/stripe/webhook", "POST")

    # Message read-state ownership
    _remove_route("/api/messages/mark-seen/{trip_id}", "POST")

    @core.app.post("/api/trips/{trip_id}/complete")
    async def complete_trip_hardened(trip_id: str, current=Depends(core.get_current_user)):
        trip = await core.db.trips.find_one({"trip_id": trip_id, "user_id": current["id"]})
        if not trip:
            raise HTTPException(status_code=404, detail="Tur ikke funnet")
        if trip.get("status") in {"completed", "rated"}:
            trip["id"] = str(trip["_id"])
            trip.pop("_id", None)
            return trip
        if trip.get("status") != "arrived":
            raise HTTPException(status_code=409, detail="Turen kan først fullføres etter ankomst")
        result = await core.db.trips.update_one(
            {"trip_id": trip_id, "user_id": current["id"], "status": "arrived"},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}},
        )
        if result.modified_count != 1:
            raise HTTPException(status_code=409, detail="Turen endret status. Oppdater og prøv igjen.")
        trip = await core.db.trips.find_one({"trip_id": trip_id, "user_id": current["id"]})
        trip["id"] = str(trip["_id"])
        trip.pop("_id", None)
        return trip

    @core.app.post("/api/trips/{trip_id}/rate")
    async def rate_trip_hardened(
        trip_id: str,
        body: core.RateTripRequest,
        current=Depends(core.get_current_user),
    ):
        if body.rating < 1 or body.rating > 5:
            raise HTTPException(status_code=400, detail="Rating må være mellom 1 og 5")
        trip = await core.db.trips.find_one({"trip_id": trip_id, "user_id": current["id"]})
        if not trip:
            raise HTTPException(status_code=404, detail="Fant ikke turen")
        if trip.get("passenger_rating"):
            raise HTTPException(status_code=409, detail="Du har allerede rangert denne turen")
        if trip.get("status") not in RATABLE_PASSENGER_STATES:
            raise HTTPException(status_code=409, detail="Turen må være fullført før den kan vurderes")
        result = await core.db.trips.update_one(
            {
                "trip_id": trip_id,
                "user_id": current["id"],
                "status": {"$in": list(RATABLE_PASSENGER_STATES)},
                "passenger_rating": {"$exists": False},
            },
            {"$set": {
                "passenger_rating": body.rating,
                "passenger_feedback": body.feedback,
                "rating": body.rating,
                "feedback": body.feedback,
                "status": "rated",
                "rated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if result.modified_count != 1:
            raise HTTPException(status_code=409, detail="Turen er allerede vurdert eller har endret status")
        if trip.get("driver_id"):
            recent = []
            async for row in core.db.trips.find(
                {"driver_id": trip["driver_id"], "passenger_rating": {"$exists": True, "$ne": None}},
                {"passenger_rating": 1},
            ).sort("rated_at", -1).limit(50):
                recent.append(row.get("passenger_rating"))
            if recent:
                avg = round(sum(recent) / len(recent), 2)
                try:
                    await core.db.users.update_one(
                        {"_id": core.ObjectId(trip["driver_id"])},
                        {"$set": {"rating": avg}},
                    )
                except Exception:
                    pass
        return {"ok": True}

    @core.app.post("/api/driver/trip/{trip_id}/rate-passenger")
    async def driver_rate_passenger_hardened(
        trip_id: str,
        body: core.DriverRatePassengerRequest,
        current=Depends(core.require_driver),
    ):
        if body.rating < 1 or body.rating > 5:
            raise HTTPException(status_code=400, detail="Rating må være mellom 1 og 5")
        trip = await core.db.trips.find_one({"trip_id": trip_id, "driver_id": current["id"]})
        if not trip:
            raise HTTPException(status_code=404, detail="Fant ikke turen")
        if trip.get("driver_rating"):
            raise HTTPException(status_code=409, detail="Du har allerede rangert denne kunden")
        if trip.get("status") not in FINISHED_TRIP_STATES:
            raise HTTPException(status_code=409, detail="Turen må være fullført før kunden kan vurderes")
        result = await core.db.trips.update_one(
            {
                "trip_id": trip_id,
                "driver_id": current["id"],
                "status": {"$in": list(FINISHED_TRIP_STATES)},
                "driver_rating": {"$exists": False},
            },
            {"$set": {
                "driver_rating": body.rating,
                "driver_feedback": body.feedback,
                "driver_rated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if result.modified_count != 1:
            raise HTTPException(status_code=409, detail="Turen er allerede vurdert eller har endret status")
        if trip.get("user_id"):
            recent = []
            async for row in core.db.trips.find(
                {"user_id": trip["user_id"], "driver_rating": {"$exists": True, "$ne": None}},
                {"driver_rating": 1},
            ).sort("driver_rated_at", -1).limit(50):
                recent.append(row.get("driver_rating"))
            if recent:
                avg = round(sum(recent) / len(recent), 2)
                try:
                    await core.db.users.update_one(
                        {"_id": core.ObjectId(trip["user_id"])},
                        {"$set": {"rating": avg}},
                    )
                except Exception:
                    pass
        return {"ok": True}

    @core.app.post("/api/trips/{trip_id}/cancel")
    async def cancel_trip_hardened(trip_id: str, current=Depends(core.get_current_user)):
        trip = await core.db.trips.find_one({"trip_id": trip_id, "user_id": current["id"]})
        if not trip:
            raise HTTPException(status_code=404, detail="Tur ikke funnet")
        if trip.get("status") not in PASSENGER_CANCELLABLE_STATES:
            raise HTTPException(status_code=409, detail="Turen kan ikke avbrytes etter at den har startet")
        now = datetime.now(timezone.utc).isoformat()
        result = await core.db.trips.update_one(
            {
                "trip_id": trip_id,
                "user_id": current["id"],
                "status": {"$in": list(PASSENGER_CANCELLABLE_STATES)},
            },
            {
                "$set": {"status": "cancelled", "cancelled_at": now, "updated_at": now},
                "$unset": {"offer_driver_id": "", "offer_expires_at": ""},
            },
        )
        if result.modified_count != 1:
            raise HTTPException(status_code=409, detail="Turen endret status. Oppdater og prøv igjen.")
        notify_driver = trip.get("driver_id") or trip.get("offer_driver_id")
        if notify_driver:
            await core.send_push_to_user(
                notify_driver,
                "Turen er avbrutt",
                "Kunden har avbrutt turen.",
                "/driver",
                tag="kjapp-trip-cancelled",
            )
        return {"ok": True}

    async def _find_open_payment(trip_id: str, user_id: str):
        rec = await core.db.payment_transactions.find_one(
            {
                "trip_id": trip_id,
                "user_id": user_id,
                "payment_status": "pending",
                "status": {"$in": ["initiated", "pending"]},
            },
            sort=[("created_at", -1)],
        )
        if not rec:
            return None
        try:
            session = stripe.checkout.Session.retrieve(rec["session_id"])
        except stripe.error.StripeError:
            return None
        if getattr(session, "payment_status", None) == "paid" or getattr(session, "status", None) == "complete":
            payment_intent = getattr(session, "payment_intent", None)
            await core.db.payment_transactions.update_one(
                {"session_id": rec["session_id"]},
                {"$set": {
                    "status": "completed",
                    "payment_status": "paid",
                    "stripe_payment_intent_id": payment_intent,
                    "updated_at": datetime.now(timezone.utc),
                }},
            )
            await core.db.trips.update_one(
                {"trip_id": trip_id, "user_id": user_id},
                {"$set": {
                    "payment_status": "paid",
                    "status": "completed",
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                    "stripe_payment_intent": payment_intent,
                }},
            )
            return {"paid": True, "session": session}
        if getattr(session, "status", None) == "open" and getattr(session, "url", None):
            return {"paid": False, "session": session}
        if getattr(session, "status", None) == "expired":
            await core.db.payment_transactions.update_one(
                {"session_id": rec["session_id"]},
                {"$set": {"status": "expired", "payment_status": "expired", "updated_at": datetime.now(timezone.utc)}},
            )
        return None

    @core.app.post("/api/payments/checkout")
    async def create_trip_checkout_hardened(
        body: core.TripCheckoutRequest,
        current=Depends(core.get_current_user),
    ):
        trip = await core.db.trips.find_one({"trip_id": body.trip_id, "user_id": current["id"]})
        if not trip:
            raise HTTPException(status_code=404, detail="Tur ikke funnet")
        if trip.get("status") not in FINISHED_TRIP_STATES:
            raise HTTPException(status_code=409, detail="Turen er ikke ferdig ennå")
        if trip.get("payment_status") == "paid":
            raise HTTPException(status_code=409, detail="Turen er allerede betalt")
        amount_nok = int(trip.get("price") or 0)
        if amount_nok <= 0:
            raise HTTPException(status_code=400, detail="Ugyldig beløp")
        if not stripe.api_key:
            raise HTTPException(status_code=500, detail="Stripe er ikke konfigurert")

        # Fast path: reuse the latest still-open Checkout session for this trip.
        existing = await _find_open_payment(body.trip_id, current["id"])
        if existing:
            if existing.get("paid"):
                raise HTTPException(status_code=409, detail="Turen er allerede betalt")
            session = existing["session"]
            return {"checkout_url": session.url, "session_id": session.id, "reused": True}

        # Atomic, expiring per-trip lock prevents concurrent requests from creating parallel sessions.
        lock_token = uuid.uuid4().hex
        now = datetime.now(timezone.utc)
        stale_before = (now - PAYMENT_LOCK_TTL).isoformat()
        lock = await core.db.trips.update_one(
            {
                "trip_id": body.trip_id,
                "user_id": current["id"],
                "payment_status": {"$ne": "paid"},
                "$or": [
                    {"payment_checkout_lock": {"$exists": False}},
                    {"payment_checkout_lock_at": {"$lt": stale_before}},
                ],
            },
            {"$set": {"payment_checkout_lock": lock_token, "payment_checkout_lock_at": now.isoformat()}},
        )
        if lock.modified_count != 1:
            existing = await _find_open_payment(body.trip_id, current["id"])
            if existing and not existing.get("paid"):
                session = existing["session"]
                return {"checkout_url": session.url, "session_id": session.id, "reused": True}
            raise HTTPException(status_code=409, detail="Betaling opprettes allerede. Prøv igjen om et øyeblikk.")

        try:
            # Recheck after acquiring the lock in case another request completed just before the lock.
            fresh = await core.db.trips.find_one({"trip_id": body.trip_id, "user_id": current["id"]})
            if not fresh or fresh.get("payment_status") == "paid":
                raise HTTPException(status_code=409, detail="Turen er allerede betalt")
            existing = await _find_open_payment(body.trip_id, current["id"])
            if existing:
                if existing.get("paid"):
                    raise HTTPException(status_code=409, detail="Turen er allerede betalt")
                session = existing["session"]
                return {"checkout_url": session.url, "session_id": session.id, "reused": True}

            session = stripe.checkout.Session.create(
                mode="payment",
                line_items=[{
                    "price_data": {
                        "currency": "nok",
                        "unit_amount": amount_nok * 100,
                        "product_data": {
                            "name": f"KJAPP tur — {trip.get('pickup_address', '')[:40]} → {trip.get('dropoff_address', '')[:40]}",
                        },
                    },
                    "quantity": 1,
                }],
                success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{body.origin_url}/payment/cancel?trip_id={body.trip_id}",
                metadata={"trip_id": body.trip_id, "user_id": current["id"]},
                idempotency_key=f"kjapp-trip-{body.trip_id}-{lock_token}",
            )
            await core.db.payment_transactions.insert_one({
                "session_id": session.id,
                "trip_id": body.trip_id,
                "user_id": current["id"],
                "amount": amount_nok,
                "currency": "nok",
                "status": "initiated",
                "payment_status": "pending",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            })
            return {"checkout_url": session.url, "session_id": session.id, "reused": False}
        finally:
            await core.db.trips.update_one(
                {"trip_id": body.trip_id, "user_id": current["id"], "payment_checkout_lock": lock_token},
                {"$unset": {"payment_checkout_lock": "", "payment_checkout_lock_at": ""}},
            )

    @core.app.get("/api/payments/status/{session_id}")
    async def get_payment_status_hardened(session_id: str, current=Depends(core.get_current_user)):
        record = await core.db.payment_transactions.find_one({"session_id": session_id, "user_id": current["id"]})
        if not record:
            # Deliberately 404 for both nonexistent and somebody else's session.
            raise HTTPException(status_code=404, detail="Betaling ikke funnet")
        if record.get("payment_status") != "paid":
            try:
                session = stripe.checkout.Session.retrieve(session_id)
                if session.payment_status == "paid" or session.status == "complete":
                    payment_intent = session.payment_intent
                    await core.db.payment_transactions.update_one(
                        {"session_id": session_id, "user_id": current["id"], "payment_status": {"$ne": "paid"}},
                        {"$set": {
                            "status": "completed",
                            "payment_status": "paid",
                            "stripe_payment_intent_id": payment_intent,
                            "updated_at": datetime.now(timezone.utc),
                        }},
                    )
                    if record.get("trip_id"):
                        await core.db.trips.update_one(
                            {"trip_id": record["trip_id"], "user_id": current["id"]},
                            {"$set": {
                                "payment_status": "paid",
                                "status": "completed",
                                "paid_at": datetime.now(timezone.utc).isoformat(),
                                "stripe_payment_intent": payment_intent,
                            }},
                        )
                    record = await core.db.payment_transactions.find_one({"session_id": session_id, "user_id": current["id"]})
            except stripe.error.StripeError:
                pass
        return {
            "session_id": record["session_id"],
            "status": record.get("status"),
            "payment_status": record.get("payment_status"),
            "trip_id": record.get("trip_id"),
        }

    @core.app.post("/api/stripe/webhook")
    async def stripe_webhook_hardened(request: Request):
        payload = await request.body()
        sig = request.headers.get("stripe-signature", "")
        if not core.STRIPE_WEBHOOK_SECRET:
            raise HTTPException(status_code=503, detail="Stripe webhook er ikke konfigurert")
        try:
            event = stripe.Webhook.construct_event(payload, sig, core.STRIPE_WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
        except Exception:
            raise HTTPException(status_code=400, detail="Webhook error")
        obj = event["data"]["object"]
        event_type = event["type"]
        if event_type == "checkout.session.completed":
            payment_intent = obj.get("payment_intent")
            record = await core.db.payment_transactions.find_one_and_update(
                {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
                {"$set": {
                    "status": "completed",
                    "payment_status": obj.get("payment_status", "paid"),
                    "stripe_payment_intent_id": payment_intent,
                    "updated_at": datetime.now(timezone.utc),
                }},
            )
            if record and record.get("trip_id"):
                await core.db.trips.update_one(
                    {"trip_id": record["trip_id"], "user_id": record.get("user_id")},
                    {"$set": {
                        "payment_status": "paid",
                        "status": "completed",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                        "stripe_payment_intent": payment_intent,
                    }},
                )
        elif event_type == "checkout.session.expired":
            await core.db.payment_transactions.update_one(
                {"session_id": obj["id"]},
                {"$set": {
                    "status": "expired",
                    "payment_status": "expired",
                    "updated_at": datetime.now(timezone.utc),
                }},
            )
        return {"status": "ok"}

    @core.app.post("/api/messages/mark-seen/{trip_id}")
    async def mark_messages_seen_hardened(trip_id: str, current=Depends(core.get_current_user)):
        await core._load_trip_or_403(trip_id, current)
        role = current.get("role", "user")
        my_role = "driver" if role == "driver" else "passenger"
        seen_key = f"{my_role}_last_seen_msg_at"
        await core.db.trips.update_one(
            {"trip_id": trip_id},
            {"$set": {seen_key: datetime.now(timezone.utc).isoformat()}},
        )
        return {"ok": True}


_install_routes()
app = core.app
