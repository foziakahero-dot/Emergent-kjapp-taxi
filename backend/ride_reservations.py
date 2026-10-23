"""Reserve a ride fare before dispatch, capture once on arrival, reconcile via Stripe."""
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from promo_credits import platform_fee_ore
from fastapi import HTTPException


def value(obj, key, default=None):
    return obj.get(key, default) if hasattr(obj, "get") else getattr(obj, key, default)


def stripe_id(obj):
    return obj if isinstance(obj, str) else value(obj, "id")


class RideReservations:
    def __init__(self, db, stripe, *, mark_paid, receipts, push, dispatch, destination):
        self.db, self.stripe = db, stripe
        self.mark_paid, self.receipts, self.push = mark_paid, receipts, push
        self.dispatch, self.destination = dispatch, destination

    def client(self):
        key = os.environ.get("STRIPE_SECRET_KEY") or self.stripe.api_key
        if not key:
            raise HTTPException(503, "Kortreservasjon er midlertidig utilgjengelig")
        return self.stripe.StripeClient(key, max_network_retries=1, http_client=self.stripe.RequestsClient(timeout=15))

    async def notify(self, trip, title, body):
        for uid, url in ((trip.get("user_id"), f"/receipt/{trip['trip_id']}"),
                         (trip.get("driver_id"), "/driver")):
            if uid:
                try:
                    await self.push(uid, title, body, url, "trip_payment_reserved")
                except Exception:
                    logging.warning("Ride payment notification failed: %s", trip["trip_id"])

    async def record(self, trip):
        return await self.db.payment_transactions.find_one({"trip_id": trip["trip_id"], "kind": "ride_reservation"})

    def validate(self, pi, record):
        metadata = value(pi, "metadata", {}) or {}
        return bool(
            stripe_id(pi) == record.get("stripe_payment_intent_id")
            and value(pi, "currency") == "nok"
            and int(value(pi, "amount", 0)) == record["authorized_amount_ore"]
            and stripe_id(value(pi, "customer")) == record["stripe_customer_id"]
            and metadata.get("trip_id") == record["trip_id"]
            and metadata.get("user_id") == record["user_id"]
            and metadata.get("source") == "snar_ride_reservation"
        )

    async def authorize(self, trip):
        """No trip is searchable until Stripe confirms requires_capture."""
        client = self.client()
        record = await self.record(trip)
        if not record:
            user = await self.db.users.find_one({"_id": ObjectId(trip["user_id"])}) or {}
            pm = await self.db.payment_methods.find_one({
                "user_id": trip["user_id"], "verified": True, "setup_status": "succeeded",
                "stripe_payment_method_id": {"$type": "string"},
            }, sort=[("is_default", -1), ("created_at", -1)])
            if not pm or not user.get("stripe_customer_id"):
                raise HTTPException(402, "Legg til og bekreft et betalingskort før du bestiller")
            amount = int(trip.get("reservation_limit_ore", int(trip["price"]) * 100))
            # A larger hold is permitted only when the rider accepted the disclosed
            # pickup policy. Unused waiting funds are released by partial capture.
            if amount != int(trip["price"]) * 100 and not (
                trip.get("waiting_policy_accepted_at") and trip.get("waiting_policy")
                and amount == (int(trip["price"]) + int(trip["waiting_policy"]["max_fee"])) * 100
            ):
                raise HTTPException(409, "Reservasjonsbeløpet er ikke bekreftet av kunden")
            if amount <= 0:
                raise HTTPException(400, "Ugyldig turpris")
            record = {"trip_id": trip["trip_id"], "user_id": trip["user_id"],
                      "kind": "ride_reservation", "session_id": f"reservation:{trip['trip_id']}",
                      "amount": int(trip["price"]), "currency": "nok", "authorized_amount_ore": amount,
                      "stripe_customer_id": user["stripe_customer_id"],
                      "stripe_payment_method_id": pm["stripe_payment_method_id"],
                      "status": "authorizing", "payment_status": "unpaid", "created_at": datetime.now(timezone.utc)}
            await self.db.payment_transactions.update_one(
                {"trip_id": trip["trip_id"], "kind": "ride_reservation"},
                {"$setOnInsert": record}, upsert=True)
            record = await self.record(trip)
        pi = None
        try:
            if record.get("stripe_payment_intent_id"):
                pi = await asyncio.to_thread(client.v1.payment_intents.retrieve, record["stripe_payment_intent_id"])
            else:
                pi = await asyncio.to_thread(client.v1.payment_intents.create, {
                    "amount": record["authorized_amount_ore"], "currency": "nok",
                    "customer": record["stripe_customer_id"], "payment_method": record["stripe_payment_method_id"],
                    "confirm": True, "off_session": True, "capture_method": "manual",
                    "automatic_payment_methods": {"enabled": True, "allow_redirects": "never"},
                    "description": f"SNAR tur {trip['trip_id']}", "transfer_group": f"snar_{trip['trip_id']}",
                    "metadata": {"trip_id": trip["trip_id"], "user_id": trip["user_id"], "source": "snar_ride_reservation"},
                }, {"idempotency_key": f"snar-reserve-{trip['trip_id']}"})
        except self.stripe.StripeError as exc:
            error = getattr(exc, "error", None)
            pi = value(error, "payment_intent") or getattr(exc, "payment_intent", None)
            if stripe_id(pi):
                pi = await asyncio.to_thread(client.v1.payment_intents.retrieve, stripe_id(pi))
            if pi is None:
                raise HTTPException(402, "Kortreservasjonen ble ikke godkjent. Kontroller kortet eller prøv igjen.") from None
        pi_id = stripe_id(pi)
        await self.db.payment_transactions.update_one(
            {"trip_id": trip["trip_id"], "kind": "ride_reservation"},
            {"$set": {"stripe_payment_intent_id": pi_id, "status": value(pi, "status"), "updated_at": datetime.now(timezone.utc)}})
        await self.db.trips.update_one({"trip_id": trip["trip_id"]}, {"$set": {
            "payment_flow": "reservation", "reservation_payment_intent_id": pi_id,
            "authorized_amount_ore": record["authorized_amount_ore"],
        }})
        record["stripe_payment_intent_id"] = pi_id
        if not self.validate(pi, record):
            raise HTTPException(409, "Reservasjonen samsvarer ikke med turen")
        if value(pi, "status") == "requires_capture":
            await self.activate(trip, pi, record)
            return {"authorized": True, "payment_intent_id": pi_id}
        error = value(pi, "last_payment_error", {}) or {}
        if value(pi, "status") == "requires_action" or value(error, "code") == "authentication_required":
            raise HTTPException(402, {"message": "Godkjenn kortreservasjonen i banken før turen bestilles.",
                                     "code": "reservation_requires_action", "trip_id": trip["trip_id"],
                                     "client_secret": value(pi, "client_secret"), "payment_method_id": record["stripe_payment_method_id"]})
        raise HTTPException(402, "Banken godkjente ikke reservasjonen. Bruk et annet kort eller kontroller tilgjengelige midler.")

    async def activate(self, trip, pi, record):
        if not self.validate(pi, record) or value(pi, "status") != "requires_capture":
            raise HTTPException(402, "Turbeløpet er ikke reservert")
        if int(value(pi, "amount_capturable", 0)) < int(trip["price"]) * 100:
            raise HTTPException(402, "Reservasjonen dekker ikke turprisen")
        activated = await self.db.trips.update_one(
            {"trip_id": trip["trip_id"], "user_id": trip["user_id"], "status": "payment_authorizing"},
            {"$set": {"status": "searching", "payment_status": "reserved", "reservation_status": "authorized",
                      "payment_flow": "reservation", "reservation_payment_intent_id": stripe_id(pi),
                      "authorized_amount_ore": record["authorized_amount_ore"],
                      "authorized_at": datetime.now(timezone.utc).isoformat()}})
        if activated.modified_count:
            fresh = await self.db.trips.find_one({"trip_id": trip["trip_id"]})
            try:
                await self.dispatch(fresh)
            except Exception:
                logging.warning("Reservation authorized; dispatch needs retry: %s", trip["trip_id"])
        else:
            fresh = await self.db.trips.find_one({"trip_id": trip["trip_id"]})
            if fresh and fresh.get("status") in ("cancelled", "cancelled_by_driver"):
                await self.release(fresh)
                raise HTTPException(409, "Turen ble avbrutt mens kortet ble godkjent")

    async def confirm(self, trip_id, user_id):
        trip = await self.db.trips.find_one({"trip_id": trip_id, "user_id": user_id})
        if not trip:
            raise HTTPException(404, "Tur ikke funnet")
        record = await self.record(trip)
        if not record or not record.get("stripe_payment_intent_id"):
            raise HTTPException(409, "Ingen kortreservasjon å bekrefte")
        pi = await asyncio.to_thread(self.client().v1.payment_intents.retrieve, record["stripe_payment_intent_id"])
        await self.activate(trip, pi, record)
        trip = await self.db.trips.find_one({"trip_id": trip_id, "user_id": user_id})
        trip.pop("_id", None)
        return trip

    async def require_reserved(self, trip):
        if trip.get("payment_flow") != "reservation":
            # Existing rides must also obtain a hold before they can start.
            await self.authorize(trip)
            trip = await self.db.trips.find_one({"trip_id": trip["trip_id"]})
        record = await self.record(trip)
        if not record or not record.get("stripe_payment_intent_id"):
            raise HTTPException(402, "Kunden må godkjenne kortreservasjonen før turen starter")
        pi = await asyncio.to_thread(self.client().v1.payment_intents.retrieve, record["stripe_payment_intent_id"])
        if not self.validate(pi, record) or value(pi, "status") != "requires_capture" or int(value(pi, "amount_capturable", 0)) < int(trip["price"]) * 100:
            raise HTTPException(402, "Kortreservasjonen er ikke gyldig. Turen kan ikke startes.")

    async def capture(self, trip):
        trip = await self.db.trips.find_one({"trip_id": trip["trip_id"]}) or trip
        if trip.get("status") not in ("arrived", "completed", "rated"):
            raise HTTPException(409, "Turen må være avsluttet før beløpet trekkes")
        record = await self.record(trip)
        if not record or not record.get("stripe_payment_intent_id"):
            return {"attempted": False, "paid": False, "reason": "no_reservation"}
        client = self.client()
        try:
            pi = await asyncio.to_thread(client.v1.payment_intents.retrieve, record["stripe_payment_intent_id"])
            if not self.validate(pi, record):
                raise HTTPException(409, "Reservasjonen samsvarer ikke med turen")
            amount = int(trip["price"]) * 100
            if amount <= 0 or amount > record["authorized_amount_ore"]:
                raise HTTPException(409, "Turprisen overstiger den godkjente reservasjonen")
            if value(pi, "status") == "requires_capture":
                if int(value(pi, "amount_capturable", 0)) < amount:
                    raise HTTPException(409, "Reservasjonen dekker ikke turbeløpet")
                pi = await asyncio.to_thread(client.v1.payment_intents.capture, stripe_id(pi),
                                            {"amount_to_capture": amount}, {"idempotency_key": f"snar-capture-{trip['trip_id']}-{amount}"})
            if value(pi, "status") != "succeeded" or int(value(pi, "amount_received", 0)) != amount:
                raise HTTPException(409, "Stripe har ikke bekreftet betalingen")
            await self.settle(trip, pi, record)
            return {"attempted": True, "paid": True, "payment_intent_id": stripe_id(pi)}
        except (self.stripe.StripeError, HTTPException) as exc:
            await self.db.trips.update_one({"trip_id": trip["trip_id"], "payment_status": {"$ne": "paid"}},
                {"$set": {"payment_status": "capture_pending", "capture_failure_code": getattr(exc, "code", None) or "capture_unconfirmed",
                          "requires_manual_settlement": True}})
            return {"attempted": True, "paid": False, "reason": "capture_pending"}

    async def settle(self, trip, pi, record):
        amount = int(value(pi, "amount_received", 0))
        if not self.validate(pi, record) or value(pi, "status") != "succeeded" or amount != int(trip["price"]) * 100:
            raise HTTPException(409, "Betalingsbeløpet samsvarer ikke med turen")
        fields = {"status": "completed", "payment_status": "paid", "amount": amount / 100,
                  "stripe_payment_intent_id": stripe_id(pi), "updated_at": datetime.now(timezone.utc)}
        destination = await self.destination(trip)
        if destination:
            fee = platform_fee_ore(amount, int(trip.get("promo_discount") or 0) * 100, destination["commission_rate"])
            try:
                transfer = await asyncio.to_thread(self.client().v1.transfers.create, {
                    "amount": amount - fee, "currency": "nok", "destination": destination["stripe_account_id"],
                    "source_transaction": stripe_id(value(pi, "latest_charge")), "transfer_group": f"snar_{trip['trip_id']}",
                    "metadata": {"trip_id": trip["trip_id"], "fleet_id": destination["fleet_id"]},
                }, {"idempotency_key": f"snar-fleet-transfer-{trip['trip_id']}"})
                fields.update({"stripe_transfer_id": stripe_id(transfer), "fleet_id": destination["fleet_id"],
                               "stripe_account_id": destination["stripe_account_id"], "platform_fee": fee / 100,
                               "fleet_net": (amount - fee) / 100, "commission_rate": destination["commission_rate"],
                               "settlement_model": "stripe_separate_charge_transfer"})
            except self.stripe.StripeError:
                fields["fleet_transfer_pending"] = True
        elif trip.get("fleet_id"):
            fields["fleet_transfer_pending"] = True
        await self.db.payment_transactions.update_one({"trip_id": trip["trip_id"], "kind": "ride_reservation"}, {"$set": fields})
        await self.db.trips.update_one({"trip_id": trip["trip_id"]}, {"$set": {
            "reservation_status": "captured", "price_review_required": False,
            "requires_manual_settlement": bool(fields.get("fleet_transfer_pending")),
            "fleet_transfer_pending": bool(fields.get("fleet_transfer_pending")),
        }})
        await self.mark_paid(trip["trip_id"], trip["user_id"])
        await self.receipts(trip["trip_id"])
        sent = await self.db.trips.update_one({"trip_id": trip["trip_id"], "reservation_paid_notified": {"$ne": True}},
                                            {"$set": {"reservation_paid_notified": True}})
        if sent.modified_count:
            await self.notify(trip, "Turen er betalt", f"{amount / 100:g} kr ble trukket automatisk. Kvitteringen er klar i SNAR.")

    async def release(self, trip):
        record = await self.record(trip)
        if not record:
            return
        try:
            if not record.get("stripe_payment_intent_id"):
                # Recover the same idempotent intent after a create response was lost.
                try:
                    await self.authorize(trip)
                except HTTPException:
                    pass
                record = await self.record(trip)
                if not record.get("stripe_payment_intent_id"):
                    return
            pi = await asyncio.to_thread(self.client().v1.payment_intents.retrieve, record["stripe_payment_intent_id"])
            if not self.validate(pi, record):
                raise HTTPException(409, "Reservasjonen samsvarer ikke med turen")
            if value(pi, "status") != "succeeded" and value(pi, "status") != "canceled":
                pi = await asyncio.to_thread(self.client().v1.payment_intents.cancel, stripe_id(pi), {},
                                            {"idempotency_key": f"snar-release-{trip['trip_id']}"})
            if value(pi, "status") == "canceled":
                await self.db.trips.update_one({"trip_id": trip["trip_id"]}, {"$set": {"reservation_status": "released"}})
                await self.db.payment_transactions.update_one({"trip_id": trip["trip_id"], "kind": "ride_reservation"},
                                                               {"$set": {"status": "canceled", "payment_status": "released"}})
        except (self.stripe.StripeError, HTTPException):
            logging.warning("Reservation release needs retry: %s", trip["trip_id"])

    async def webhook(self, event):
        if event.get("account") or not event.get("type", "").startswith("payment_intent."):
            return False
        obj = event["data"]["object"]
        record = await self.db.payment_transactions.find_one({"kind": "ride_reservation", "stripe_payment_intent_id": stripe_id(obj)})
        if not record:
            return False
        # Retrieve from Stripe; signatures alone do not resolve reordered events.
        pi = await asyncio.to_thread(self.client().v1.payment_intents.retrieve, record["stripe_payment_intent_id"])
        if not self.validate(pi, record):
            return True
        trip = await self.db.trips.find_one({"trip_id": record["trip_id"], "user_id": record["user_id"]})
        if not trip:
            return True
        if trip.get("status") in ("cancelled", "cancelled_by_driver"):
            await self.release(trip)
        elif value(pi, "status") == "requires_capture" and trip.get("status") == "payment_authorizing":
            await self.activate(trip, pi, record)
        elif value(pi, "status") == "succeeded" and trip.get("status") in ("arrived", "completed", "rated"):
            await self.settle(trip, pi, record)
        return True

    async def reconcile_loop(self):
        while True:
            try:
                query = {"payment_flow": "reservation", "$or": [
                    {"status": "arrived", "payment_status": {"$ne": "paid"}},
                    {"status": {"$in": ["cancelled", "cancelled_by_driver"]}, "reservation_status": {"$ne": "released"}},
                    {"status": "payment_authorizing"},
                    {"status": {"$in": ["completed", "rated"]}, "fleet_transfer_pending": True},
                ]}
                async for trip in self.db.trips.find(query).limit(30):
                    try:
                        if trip["status"] in ("cancelled", "cancelled_by_driver"):
                            await self.release(trip)
                        elif trip["status"] == "payment_authorizing":
                            created = datetime.fromisoformat(trip["created_at"].replace("Z", "+00:00"))
                            if datetime.now(timezone.utc) - created > timedelta(minutes=15):
                                await self.db.trips.update_one({"trip_id": trip["trip_id"], "status": "payment_authorizing"},
                                    {"$set": {"status": "cancelled", "cancelled_by": "system", "cancel_reason": "authorization_timeout"}})
                                await self.release(trip)
                            else:
                                await self.authorize(trip)
                        else:
                            await self.capture(trip)
                    except Exception:
                        logging.warning("Ride reservation reconciliation pending: %s", trip["trip_id"])
            except Exception:
                logging.warning("Ride reservation reconciliation unavailable")
            await asyncio.sleep(30)

