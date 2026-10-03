"""Native identity, fleet self-service and PaymentSheet endpoints.

Payment activation is explicit; identity and settlement are always server-authoritative.
"""
import asyncio
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from fastapi import Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from typing import Literal, Optional
import jwt
from stripe_fleet import ensure_fleet_account
from admin_control_center import _stripe_snapshot, stripe_destination_for_trip


class NativeIdentity(BaseModel):
    identity_token: str = Field(min_length=10, max_length=20000)
    client: Literal["customer", "driver"] = "customer"
    device_id: Optional[str] = Field(default=None, max_length=128)


class NativePayment(BaseModel):
    trip_id: str = Field(min_length=1, max_length=128)


def install_mobile_commerce(api, db, *, stripe, get_current_user, require_customer,
        require_fleet_owner, rate_limit, verify_google, apple_keys, hash_password,
        create_access_token, create_twofa_token, set_auth_cookie, user_public,
        apply_driver_risk, require_active_fleet, real_trip_filter, mark_paid, send_receipts):

    async def identity_session(provider, claims, body, response):
        sub = claims.get("sub")
        if not sub:
            raise HTTPException(401, "Ugyldig innlogging")
        email = str(claims.get("email") or "").strip().lower()
        verified = str(claims.get("email_verified", "")).lower() in ("true", "1")
        field = provider + "_sub"
        role = "driver" if body.client == "driver" else "user"
        user = await db.users.find_one({field: sub})
        if not user and verified and email:
            candidate = await db.users.find_one({"email": email})
            if candidate:
                # Never overwrite an existing link. For third-party Google email,
                # ownership must first be proved by the existing KJAPP login.
                if candidate.get(field) and candidate[field] != sub:
                    raise HTTPException(409, "Kontoen er koblet til en annen identitet")
                if provider == "google" and not (email.endswith("@gmail.com") or claims.get("hd")):
                    raise HTTPException(409, "Logg inn med KJAPP-passordet for denne e-postadressen")
                user = candidate
        if user and (user.get("disabled") or user.get("role", "user") != role):
            raise HTTPException(401, "Denne kontoen kan ikke brukes i appen")
        if role == "driver":
            if not user or user.get("approved") is not True:
                raise HTTPException(403, "Sjåførkontoen må være invitert og godkjent av KJAPP")
            await require_active_fleet(user.get("fleet_id"))
        elif not user:
            if not email or not verified:
                raise HTTPException(401, "En verifisert e-postadresse er nødvendig")
            result = await db.users.insert_one({
                "email": email, "password_hash": hash_password(secrets.token_urlsafe(32)),
                "fullName": claims.get("name") or email.split("@")[0], "phone": "",
                "role": "user", field: sub, provider + "_linked": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            user = await db.users.find_one({"_id": result.inserted_id})
        uid = str(user["_id"])
        # Do not persist a new social link before a required second factor.
        if user.get("totp_enabled"):
            raise HTTPException(409, "Kontoen krever tofaktor. Bruk KJAPP-innlogging.")
        await db.users.update_one({"_id": user["_id"]}, {"$set": {field: sub, provider + "_linked": True}})
        user = await db.users.find_one({"_id": user["_id"]})
        user = await apply_driver_risk(user, body.device_id, body.client, on_login=True)
        token = create_access_token(uid, user["email"])
        set_auth_cookie(response, token)
        return {"token": token, "user": user_public(user)}

    @api.get("/auth/native/config")
    async def identity_config(client: Literal["customer", "driver"] = "customer"):
        google_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        return {"google_enabled": bool(google_id), "google_web_client_id": google_id,
            "google_ios_client_id": os.getenv("GOOGLE_DRIVER_IOS_CLIENT_ID" if client == "driver" else "GOOGLE_IOS_CLIENT_ID", "").strip()}

    @api.post("/auth/google/native")
    async def google_native(body: NativeIdentity, request: Request, response: Response):
        await rate_limit(request, "google-native", 30, 900)
        client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        if not client_id:
            raise HTTPException(503, "Google-innlogging er ikke konfigurert")
        try:
            claims = await verify_google(body.identity_token, client_id)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(401, "Ugyldig Google-token")
        return await identity_session("google", claims, body, response)

    @api.post("/auth/google/link")
    async def link_google(body: NativeIdentity, request: Request, current=Depends(require_customer)):
        await rate_limit(request, "google-link", 20, 900)
        if body.client != "customer":
            raise HTTPException(403, "Kun kundekonto kan kobles her")
        client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        if not client_id:
            raise HTTPException(503, "Google-innlogging er ikke konfigurert")
        try:
            claims = await verify_google(body.identity_token, client_id)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(401, "Ugyldig Google-token")
        sub = claims.get("sub")
        verified = str(claims.get("email_verified", "")).lower() in ("true", "1")
        email = str(claims.get("email") or "").strip().lower()
        if not sub or not verified or email != str(current.get("email") or "").strip().lower():
            raise HTTPException(409, "Google-kontoen må ha samme verifiserte e-postadresse")
        existing = await db.users.find_one({"google_sub": sub})
        if existing and str(existing["_id"]) != current["id"]:
            raise HTTPException(409, "Google-kontoen er allerede koblet til en annen bruker")
        result = await db.users.update_one({"_id": ObjectId(current["id"]),
            "$or": [{"google_sub": {"$exists": False}}, {"google_sub": None}, {"google_sub": sub}]},
            {"$set": {"google_sub": sub, "google_linked": True}})
        if result.matched_count != 1:
            raise HTTPException(409, "Kontoen er koblet til en annen Google-identitet")
        return {"linked": True}

    @api.post("/auth/apple/native")
    async def apple_native(body: NativeIdentity, request: Request, response: Response):
        await rate_limit(request, "apple-native", 30, 900)
        audience = (os.getenv("APPLE_DRIVER_BUNDLE_ID", "no.nexorahub.kjapp.driver") if body.client == "driver"
            else os.getenv("APPLE_BUNDLE_ID", "no.nexorahub.kjapp.customer"))
        try:
            header = jwt.get_unverified_header(body.identity_token)
            keys = await apple_keys()
            key = next(k for k in keys if k.get("kid") == header.get("kid"))
            from jwt.algorithms import RSAAlgorithm
            claims = jwt.decode(body.identity_token, RSAAlgorithm.from_jwk(json.dumps(key)),
                algorithms=["RS256"], audience=audience, issuer="https://appleid.apple.com",
                options={"require": ["exp", "sub", "aud", "iss"]})
        except Exception:
            raise HTTPException(401, "Ugyldig Apple-token")
        return await identity_session("apple", claims, body, response)

    async def own_fleet(current):
        # This self-service endpoint never accepts a caller-supplied fleet id.
        if current.get("role") != "fleet_owner":
            raise HTTPException(403, "Bruk administrasjonspanelet")
        fleet = await db.fleets.find_one({"_id": ObjectId(current["fleet_id"]),
            "owner_user_id": current["id"]})
        if not fleet:
            raise HTTPException(404, "Fant ikke egen flåte")
        return fleet

    @api.post("/fleet/stripe/onboarding")
    async def fleet_onboarding(current=Depends(require_fleet_owner)):
        fleet = await own_fleet(current)
        account_id = await ensure_fleet_account(db, stripe, fleet, current.get("email"))
        public = os.getenv("FLEET_PUBLIC_URL", "https://fleet.kjappapp.no").rstrip("/")
        try:
            link = await asyncio.to_thread(stripe.AccountLink.create, account=account_id,
                refresh_url=f"{public}/okonomi?stripe=refresh",
                return_url=f"{public}/okonomi?stripe=return", type="account_onboarding")
        except Exception:
            raise HTTPException(502, "Stripe-lenken kunne ikke opprettes")
        return {"onboarding_url": link.url}

    @api.get("/fleet/stripe/status")
    async def fleet_status(current=Depends(require_fleet_owner)):
        fleet = await own_fleet(current)
        if not fleet.get("stripe_account_id"):
            return {"connected": False, "ready": False, "currently_due": [], "status": "not_connected"}
        if not stripe.api_key:
            raise HTTPException(503, "Stripe er ikke konfigurert")
        try:
            account = await asyncio.to_thread(stripe.Account.retrieve, fleet["stripe_account_id"])
        except Exception:
            raise HTTPException(502, "Stripe-status er midlertidig utilgjengelig")
        snap = _stripe_snapshot(account)
        await db.fleets.update_one({"_id": fleet["_id"]}, {"$set": {
            "stripe_payouts_enabled": snap["payouts_enabled"],
            "stripe_details_submitted": snap["details_submitted"],
            "stripe_charges_enabled": snap["charges_enabled"],
            "stripe_connect_status": "ready" if snap["ready"] else "restricted",
            "stripe_status_checked_at": datetime.now(timezone.utc).isoformat(),
        }})
        return {"connected": True, **snap, "payout_schedule": fleet.get("stripe_payout_schedule", "stripe_default")}

    def payment_config():
        key = os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip()
        mode_matches = key.startswith("pk_test_") and str(stripe.api_key).startswith(("sk_test_", "rk_test_"))
        enabled = os.getenv("NATIVE_PAYMENTS_ENABLED", "false").lower() == "true" and mode_matches
        return {"enabled": bool(enabled), "publishable_key": key if enabled else "",
            "test_mode": key.startswith("pk_test_"),
            "apple_merchant_id": os.getenv("APPLE_PAY_MERCHANT_ID", "").strip(),
            "google_pay_enabled": enabled and os.getenv("GOOGLE_PAY_ENABLED", "false").lower() == "true"}

    @api.get("/payments/native/config")
    async def native_config():
        return payment_config()

    async def reconcile_native(pi, record):
        if (pi.get("amount") != record["amount_ore"] or pi.get("currency") != "nok"
                or (pi.get("metadata") or {}).get("trip_id") != record["trip_id"]
                or (pi.get("metadata") or {}).get("user_id") != record["user_id"]):
            raise HTTPException(409, "Betalingen stemmer ikke med turen")
        if pi.get("status") != "succeeded":
            return False
        await db.payment_transactions.update_one({"_id": record["_id"]}, {"$set": {
            "payment_status": "paid", "status": "completed", "updated_at": datetime.now(timezone.utc)}})
        # Repeatable reconciliation repairs a webhook interrupted after the transaction write.
        await mark_paid(record["trip_id"], record["user_id"], datetime.now(timezone.utc).isoformat())
        await send_receipts(record["trip_id"])
        return True

    @api.post("/payments/native/intent")
    async def native_intent(body: NativePayment, request: Request, current=Depends(require_customer)):
        await rate_limit(request, "native-payment", 20, 900)
        if not payment_config()["enabled"]:
            raise HTTPException(503, "Mobilbetaling er ikke aktivert")
        trip = await db.trips.find_one(real_trip_filter({"trip_id": body.trip_id, "user_id": current["id"]}))
        if not trip or trip.get("status") not in ("arrived", "completed"):
            raise HTTPException(409, "Turen er ikke klar for betaling")
        if trip.get("payment_status") == "paid":
            raise HTTPException(409, "Turen er allerede betalt")
        amount_ore = int(trip.get("price") or 0) * 100
        if amount_ore <= 0:
            raise HTTPException(400, "Ugyldig turbeløp")
        lock = secrets.token_urlsafe(16)
        now = datetime.now(timezone.utc)
        locked = await db.trips.update_one(real_trip_filter({"trip_id": body.trip_id,
            "user_id": current["id"], "payment_status": {"$ne": "paid"},
            "$or": [{"payment_checkout_lock": {"$exists": False}}, {"payment_checkout_lock": None},
                {"payment_checkout_locked_at": {"$lt": now - timedelta(minutes=2)}}]}),
            {"$set": {"payment_checkout_lock": lock, "payment_checkout_locked_at": now}})
        if locked.modified_count != 1:
            raise HTTPException(409, "En betaling behandles allerede")
        try:
            records = await db.payment_transactions.find({"trip_id": body.trip_id}).to_list(100)
            if any(r.get("payment_status") == "paid" for r in records):
                raise HTTPException(409, "Turen er allerede betalt")
            native = next((r for r in records if r.get("kind") == "native_payment"), None)
            if native and native.get("stripe_payment_intent_id"):
                pi = await asyncio.to_thread(stripe.PaymentIntent.retrieve, native["stripe_payment_intent_id"])
                if await reconcile_native(pi, native):
                    raise HTTPException(409, "Turen er allerede betalt")
                if pi.get("status") == "canceled" or pi.get("amount") != amount_ore:
                    raise HTTPException(409, "Betalingen må avklares med KJAPP")
                return {"client_secret": pi.client_secret, "payment_intent_id": pi.id}
            if any(r.get("kind") != "native_payment" and r.get("status") in ("initiated", "awaiting_payment") for r in records):
                raise HTTPException(409, "En annen betaling for turen er allerede startet")
            destination = ({"fleet_id": native["fleet_id"], "stripe_account_id": native["stripe_account_id"],
                "commission_rate": native["commission_rate"]} if native else await stripe_destination_for_trip(db, stripe, trip))
            if native and native["amount_ore"] != amount_ore:
                raise HTTPException(409, "Turbeløpet har endret seg. Kontakt KJAPP.")
            if not destination:
                raise HTTPException(409, "Løyvehaverens Stripe-oppgjør er ikke klart")
            fee = int(round(amount_ore * destination["commission_rate"]))
            # Reserve the payment method before contacting Stripe. If the database
            # write after PI creation fails, Checkout still cannot charge the fare.
            await db.payment_transactions.update_one({"trip_id": body.trip_id, "kind": "native_payment"},
                {"$setOnInsert": {"kind": "native_payment", "trip_id": body.trip_id, "user_id": current["id"],
                    "amount_ore": amount_ore, "amount": amount_ore / 100, "currency": "nok",
                    "fleet_id": destination["fleet_id"], "stripe_account_id": destination["stripe_account_id"],
                    "commission_rate": destination["commission_rate"], "platform_fee": fee / 100,
                    "fleet_net": (amount_ore - fee) / 100, "settlement_model": "stripe_destination_charge",
                    "status": "initiated", "payment_status": "pending", "created_at": now}}, upsert=True)
            pi = await asyncio.to_thread(stripe.PaymentIntent.create,
                amount=amount_ore, currency="nok", payment_method_types=["card"],
                application_fee_amount=fee, transfer_data={"destination": destination["stripe_account_id"]},
                metadata={"trip_id": body.trip_id, "user_id": current["id"], "source": "kjapp_native"},
                idempotency_key=f"kjapp-native-v1-{body.trip_id}")
            await db.payment_transactions.update_one({"trip_id": body.trip_id, "kind": "native_payment"},
                {"$set": {"stripe_payment_intent_id": pi.id}})
            return {"client_secret": pi.client_secret, "payment_intent_id": pi.id}
        finally:
            await db.trips.update_one({"trip_id": body.trip_id, "payment_checkout_lock": lock},
                {"$unset": {"payment_checkout_lock": "", "payment_checkout_locked_at": ""}})

    @api.get("/payments/native/intent/{intent_id}")
    async def native_status(intent_id: str, current=Depends(require_customer)):
        record = await db.payment_transactions.find_one({"kind": "native_payment",
            "stripe_payment_intent_id": intent_id, "user_id": current["id"]})
        if not record:
            raise HTTPException(404, "Fant ikke betalingen")
        pi = await asyncio.to_thread(stripe.PaymentIntent.retrieve, intent_id)
        paid = await reconcile_native(pi, record)
        return {"payment_status": "paid" if paid else pi.get("status")}

    async def handle_native_webhook(event):
        if event.get("account") or event.get("type") != "payment_intent.succeeded":
            return False
        pi = event["data"]["object"]
        record = await db.payment_transactions.find_one({"kind": "native_payment", "stripe_payment_intent_id": pi["id"]})
        if not record:
            return False
        await reconcile_native(pi, record)
        return True

    return handle_native_webhook

