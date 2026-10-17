"""Native identity, fleet self-service and PaymentSheet endpoints.

Payment activation is explicit; identity and settlement are always server-authoritative.
"""
import asyncio
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError
from fastapi import Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from typing import Literal, Optional
import jwt
import httpx
from urllib.parse import urlparse
from stripe_fleet import ensure_fleet_account
from admin_control_center import _stripe_snapshot, stripe_destination_for_trip
from qa_safety import is_safe_qa_web_origin


class NativeIdentity(BaseModel):
    identity_token: str = Field(min_length=10, max_length=20000)
    client: Literal["customer", "driver"] = "customer"
    device_id: Optional[str] = Field(default=None, max_length=128)


class GoogleWebCode(BaseModel):
    code: str = Field(min_length=1, max_length=4096)
    code_verifier: str = Field(min_length=43, max_length=128, pattern=r"^[A-Za-z0-9._~-]+$")
    redirect_uri: str = Field(min_length=1, max_length=2048)
    client: Literal["customer", "driver"] = "customer"
    device_id: Optional[str] = Field(default=None, max_length=128)


class NativeSetupRequest(BaseModel):
    wallet: Optional[Literal["google_pay", "apple_pay"]] = None
    future_use_accepted: bool = False


class NativePayment(BaseModel):
    trip_id: str = Field(min_length=1, max_length=128)



def native_identity_config(client="customer"):
    """QA never inherits shared/production OAuth settings."""
    qa = os.getenv("APP_ENV", "").strip().lower() == "qa"
    prefix = "QA_" if qa else ""
    google = os.getenv(prefix + "GOOGLE_CLIENT_ID", "").strip()
    apple = os.getenv(prefix + ("APPLE_DRIVER_BUNDLE_ID" if client == "driver" else "APPLE_BUNDLE_ID"),
        "" if qa else ("no.nexorahub.kjapp.driver" if client == "driver" else "no.nexorahub.kjapp.customer")).strip()
    google_enabled = bool(google) and (not qa or os.getenv("QA_GOOGLE_AUTH_ENABLED") == "true")
    apple_enabled = bool(apple) and (not qa or os.getenv("QA_APPLE_AUTH_ENABLED") == "true")
    return {"google_enabled": google_enabled,
        "google_web_client_id": google if google_enabled else "",
        "google_ios_client_id": os.getenv(prefix + ("GOOGLE_DRIVER_IOS_CLIENT_ID" if client == "driver" else "GOOGLE_IOS_CLIENT_ID"), "").strip() if google_enabled else "",
        "apple_enabled": apple_enabled, "apple_bundle_id": apple if apple_enabled else ""}

def install_mobile_commerce(api, db, *, stripe, get_current_user, require_customer,
        require_fleet_owner, rate_limit, verify_google, apple_keys, hash_password,
        create_access_token, create_twofa_token, set_auth_cookie, user_public,
        apply_driver_risk, require_active_fleet, real_trip_filter, mark_paid, send_receipts,
        on_customer_created=None):

    async def identity_session(provider, claims, body, response):
        brand = "SNAR" if body.client == "customer" else "KJAPP"
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
                # An authenticated account-link action must prove ownership of
                # both identities, including Gmail/Workspace and Apple accounts.
                raise HTTPException(409, f"Logg inn på den eksisterende {brand}-kontoen og koble identiteten under Konto.")
        if user and (user.get("disabled") or user.get("role", "user") != role):
            raise HTTPException(403, "Denne kontoen kan ikke brukes i appen")
        if role == "driver":
            if not user or user.get("approved") is not True:
                raise HTTPException(403, "Sjåførkontoen må være invitert og godkjent av KJAPP")
            await require_active_fleet(user.get("fleet_id"))
        elif not user:
            if not email or not verified:
                raise HTTPException(401, "En verifisert e-postadresse er nødvendig")
            try:
                result = await db.users.insert_one({
                    "email": email, "password_hash": await asyncio.to_thread(hash_password, secrets.token_urlsafe(32)),
                    "fullName": claims.get("name") or email.split("@")[0], "phone": "",
                    "role": "user", field: sub, provider + "_linked": True,
                    "picture": claims.get("picture") if provider == "google" else None,
                    "welcome_email_pending": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                user = await db.users.find_one({"_id": result.inserted_id})
            except DuplicateKeyError:
                # Concurrent retries may have created this identity already.
                user = await db.users.find_one({field: sub})
                if not user or user.get("disabled") or user.get("role", "user") != role:
                    raise HTTPException(409, "Kontoen finnes allerede. Logg inn eller koble kontoen.")

        uid = str(user["_id"])
        if on_customer_created and role == "user" and user.get("welcome_email_pending"):
            await on_customer_created(user)
        # Do not persist a new social link before a required second factor.
        if user.get("totp_enabled"):
            raise HTTPException(409, f"Kontoen krever tofaktor. Bruk {brand}-innlogging.")
        updates = {field: sub, provider + "_linked": True}
        picture = claims.get("picture")
        if provider == "google" and isinstance(picture, str) and picture.startswith("https://") and len(picture) <= 2048:
            updates["picture"] = picture
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user = await db.users.find_one({"_id": user["_id"]})
        user = await apply_driver_risk(user, body.device_id, body.client, on_login=True)
        token = create_access_token(uid, user["email"])
        set_auth_cookie(response, token)
        return {"token": token, "user": user_public(user)}

    @api.get("/auth/native/config")
    async def identity_config(client: Literal["customer", "driver"] = "customer"):
        return native_identity_config(client)

    @api.post("/auth/google/native")
    async def google_native(body: NativeIdentity, request: Request, response: Response):
        config = native_identity_config(body.client)
        if not config["google_enabled"]:
            raise HTTPException(503, "Google-innlogging er ikke konfigurert for dette miljøet.")
        await rate_limit(request, "google-native", 30, 900)
        client_id = config["google_web_client_id"]
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
    async def link_google(body: NativeIdentity, request: Request, current=Depends(get_current_user)):
        expected_role = "driver" if body.client == "driver" else "user"
        if current.get("role", "user") != expected_role:
            raise HTTPException(403, "Denne kontoen kan ikke kobles i appen")
        if expected_role == "driver":
            if current.get("approved") is not True:
                raise HTTPException(403, "Sjåførkontoen må være godkjent")
            await require_active_fleet(current.get("fleet_id"))
        config = native_identity_config(body.client)
        if not config["google_enabled"]:
            raise HTTPException(503, "Google-innlogging er ikke konfigurert for dette miljøet.")
        await rate_limit(request, "google-link", 20, 900)
        client_id = config["google_web_client_id"]
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
        try:
            result = await db.users.update_one({"_id": ObjectId(current["id"]),
                "$or": [{"google_sub": {"$exists": False}}, {"google_sub": None}, {"google_sub": sub}]},
                {"$set": {"google_sub": sub, "google_linked": True}})
        except DuplicateKeyError:
            raise HTTPException(409, "Google-kontoen er allerede koblet til en annen bruker")
        if result.matched_count != 1:
            raise HTTPException(409, "Kontoen er koblet til en annen Google-identitet")
        return {"linked": True}

    @api.get("/auth/google/web/config")
    async def google_web_config(client: Literal["customer", "driver"] = "customer"):
        config = native_identity_config(client)
        prefix = "QA_" if os.getenv("APP_ENV", "").strip().lower() == "qa" else ""
        enabled = config["google_enabled"] and bool(os.getenv(prefix + "GOOGLE_CLIENT_SECRET", "").strip())
        return {"enabled": enabled, "client_id": config["google_web_client_id"] if enabled else ""}

    async def exchange_google_code(body):
        config = await google_web_config(body.client)
        if not config["enabled"]:
            raise HTTPException(503, "Google web-innlogging er ikke konfigurert for dette miljøet.")
        prefix = "QA_" if os.getenv("APP_ENV", "").strip().lower() == "qa" else ""
        allowed = {uri.strip() for uri in os.getenv(prefix + "GOOGLE_REDIRECT_URIS", "").split(",") if uri.strip()}
        parsed = urlparse(body.redirect_uri)
        local = parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")
        if body.redirect_uri not in allowed or (parsed.scheme != "https" and not local):
            raise HTTPException(400, "Google redirect URI er ikke godkjent på serveren.")
        try:
            async with httpx.AsyncClient(timeout=12.0) as http:
                result = await http.post("https://oauth2.googleapis.com/token", data={
                    "code": body.code, "code_verifier": body.code_verifier,
                    "redirect_uri": body.redirect_uri, "client_id": config["client_id"],
                    "client_secret": os.environ[prefix + "GOOGLE_CLIENT_SECRET"].strip(),
                    "grant_type": "authorization_code"})
            if result.status_code != 200:
                raise HTTPException(401, "Google avviste innloggingen. Prøv igjen.")
            identity = result.json().get("id_token")
            if not isinstance(identity, str) or not identity:
                raise HTTPException(401, "Google returnerte ikke et ID-token.")
            return identity
        except httpx.HTTPError:
            raise HTTPException(503, "Google er midlertidig utilgjengelig. Prøv igjen.")

    @api.post("/auth/google/web/code")
    async def google_web_code(body: GoogleWebCode, request: Request, response: Response):
        await rate_limit(request, "google-web-code", 30, 900)
        identity = await exchange_google_code(body)
        return await google_native(NativeIdentity(identity_token=identity, client=body.client, device_id=body.device_id), request, response)

    @api.post("/auth/google/web/link")
    async def google_web_link(body: GoogleWebCode, request: Request, current=Depends(get_current_user)):
        await rate_limit(request, "google-web-link", 20, 900)
        identity = await exchange_google_code(body)
        return await link_google(NativeIdentity(identity_token=identity, client=body.client), request, current)

    async def verify_apple(body):
        config = native_identity_config(body.client)
        if not config["apple_enabled"]:
            raise HTTPException(503, "Apple-innlogging er ikke konfigurert for dette miljøet.")
        audience = config["apple_bundle_id"]
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
        return claims

    @api.post("/auth/apple/native")
    async def apple_native(body: NativeIdentity, request: Request, response: Response):
        await rate_limit(request, "apple-native", 30, 900)
        claims = await verify_apple(body)
        return await identity_session("apple", claims, body, response)

    @api.post("/auth/apple/link")
    async def link_apple(body: NativeIdentity, request: Request, current=Depends(require_customer)):
        if body.client != "customer":
            raise HTTPException(403, "Kun kundekonto kan kobles her")
        await rate_limit(request, "apple-link", 20, 900)
        claims = await verify_apple(body)
        sub = claims.get("sub")
        if not sub or str(claims.get("email_verified", "")).lower() not in ("true", "1"):
            raise HTTPException(401, "En verifisert Apple-identitet er nødvendig")
        # The authenticated SNAR session plus fresh Apple authorization proves
        # both accounts. A private relay email need not match the account email.
        existing = await db.users.find_one({"apple_sub": sub})
        if existing and str(existing["_id"]) != current["id"]:
            raise HTTPException(409, "Apple-kontoen er allerede koblet til en annen bruker")
        try:
            result = await db.users.update_one({"_id": ObjectId(current["id"]),
                "$or": [{"apple_sub": {"$exists": False}}, {"apple_sub": None}, {"apple_sub": sub}]},
                {"$set": {"apple_sub": sub, "apple_linked": True}})
        except DuplicateKeyError:
            raise HTTPException(409, "Apple-kontoen er allerede koblet til en annen bruker")
        if result.matched_count != 1:
            raise HTTPException(409, "Kontoen er koblet til en annen Apple-identitet")
        return {"linked": True}

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
        public = os.getenv(
            "FLEET_PUBLIC_URL",
            "" if os.getenv("APP_ENV", "").strip().lower() == "qa" else "https://fleet.snarapp.no",
        ).rstrip("/")
        if os.getenv("APP_ENV", "").strip().lower() == "qa" and not is_safe_qa_web_origin(public):
            raise HTTPException(503, "QA Fleet web origin is not configured.")
        account_id = await ensure_fleet_account(db, stripe, fleet, current.get("email"))
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
            "google_pay_enabled": enabled and os.getenv("QA_GOOGLE_PAY_ENABLED" if os.getenv("APP_ENV", "").lower() == "qa" else "GOOGLE_PAY_ENABLED", "false").lower() == "true"}

    @api.get("/payments/native/config")
    async def native_config():
        return payment_config()

    @api.post("/payment-methods/{pm_id}/default")
    async def set_default_card(pm_id: str, current=Depends(require_customer)):
        try:
            oid = ObjectId(pm_id)
        except InvalidId:
            raise HTTPException(400, "Ugyldig betalingsmåte") from None
        method = await db.payment_methods.find_one({"_id": oid, "user_id": current["id"],
            "verified": True, "setup_status": "succeeded", "stripe_payment_method_id": {"$type": "string"}})
        if not method:
            raise HTTPException(404, "Fant ikke verifisert betalingsmåte")
        # A single-document pointer prevents two concurrent selections from
        # creating multiple default cards. Existing trip reservations stay fixed.
        await db.users.update_one({"_id": ObjectId(current["id"])}, {"$set": {"default_payment_method_id": pm_id}})
        return {"default_payment_method_id": pm_id}

    def native_client():
        # Recovery of an already-created SetupIntent must keep working if the
        # UI flag is later disabled. Never accept a live key in this QA flow.
        if not str(stripe.api_key).startswith(("sk_test_", "rk_test_")):
            raise HTTPException(503, "Native Stripe testbetaling er ikke aktivert")
        return stripe.StripeClient(stripe.api_key, max_network_retries=1)

    async def _stripe_customer_for_user(current):
        user = await db.users.find_one({"_id": ObjectId(current["id"])})
        if not user:
            raise HTTPException(404, "Bruker ikke funnet")
        customer_id = (user or {}).get("stripe_customer_id")
        if not customer_id:
            customer = await asyncio.to_thread(
                native_client().v1.customers.create,
                {"email": user.get("email"), "name": user.get("fullName") or user.get("email"),
                 "metadata": {"user_id": current["id"]}},
                {"idempotency_key": f"snar-customer-v1-{current['id']}"},
            )
            customer_id = customer.id
            await db.users.update_one(
                {"_id": ObjectId(current["id"])},
                {"$set": {"stripe_customer_id": customer_id}},
            )
        return customer_id

    @api.post("/payments/native/setup-intent")
    async def native_setup_intent(request: Request, body: NativeSetupRequest = NativeSetupRequest(), current=Depends(require_customer)):
        await rate_limit(request, "native-card-setup", 20, 900)
        config = payment_config()
        if not config["enabled"] or not config["test_mode"]:
            raise HTTPException(503, "Native Stripe testbetaling er ikke aktivert")
        if body.wallet == "google_pay" and not config["google_pay_enabled"]:
            raise HTTPException(503, "Google Pay er ikke aktivert i dette testmiljøet")
        if body.wallet and not body.future_use_accepted:
            raise HTTPException(422, "Godkjenn lagring og belastning for turene du bestiller")
        customer_id = await _stripe_customer_for_user(current)
        metadata = {"user_id": current["id"], "source": "kjapp_native_setup"}
        if body.wallet:
            metadata.update(wallet=body.wallet, future_use_accepted_at=datetime.now(timezone.utc).isoformat(),
                            future_use_scope="customer_booked_snar_rides")
        setup = await asyncio.to_thread(native_client().v1.setup_intents.create, {
            "customer": customer_id, "automatic_payment_methods": {"enabled": True, "allow_redirects": "never"},
            "usage": "off_session", "metadata": metadata,
        })
        return {"client_secret": setup.client_secret, "setup_intent_id": setup.id}

    @api.get("/payments/native/setup-intent/{setup_intent_id}")
    async def native_setup_status(setup_intent_id: str, current=Depends(require_customer)):
        user = await db.users.find_one({"_id": ObjectId(current["id"])}) or {}
        customer_id = user.get("stripe_customer_id")
        if not customer_id:
            raise HTTPException(404, "Fant ikke kortverifiseringen")
        try:
            setup = await asyncio.to_thread(native_client().v1.setup_intents.retrieve, setup_intent_id)
        except Exception:
            raise HTTPException(404, "Fant ikke kortverifiseringen")
        if (setup.get("metadata") or {}).get("user_id") != current["id"] or str(setup.get("customer") or "") != customer_id:
            raise HTTPException(404, "Fant ikke kortverifiseringen")
        if setup.get("status") != "succeeded" or not setup.get("payment_method"):
            return {"ready": False, "status": setup.get("status")}

        pm = await asyncio.to_thread(native_client().v1.payment_methods.retrieve, setup["payment_method"])
        if pm.get("type") != "card" or str(pm.get("customer") or "") != customer_id:
            raise HTTPException(409, "Kortet er ikke bekreftet for denne kunden")
        card = pm.get("card") or {}
        metadata = setup.get("metadata") or {}
        expected_wallet = metadata.get("wallet")
        if expected_wallet and (card.get("wallet") or {}).get("type") != expected_wallet:
            raise HTTPException(409, "Betalingsmåten ble ikke bekreftet med den valgte lommeboken")
        consent = {"future_use_accepted_at": metadata.get("future_use_accepted_at"),
                   "future_use_scope": metadata.get("future_use_scope")}
        pm_id = pm.get("id")
        existing = await db.payment_methods.find_one({
            "user_id": current["id"],
            "stripe_payment_method_id": pm_id,
        })
        if existing:
            await db.payment_methods.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "setup_status": "succeeded",
                    "verified": True,
                    "stripe_setup_intent_id": setup_intent_id,
                    "wallet": (card.get("wallet") or {}).get("type"), **consent,
                }},
            )
            existing["id"] = str(existing["_id"])
            existing.pop("_id", None)
            existing.update({"setup_status": "succeeded", "verified": True, "stripe_setup_intent_id": setup_intent_id,
                "wallet": (card.get("wallet") or {}).get("type"), **consent})
            return {"ready": True, "verified": True, "card": existing}

        has_any = await db.payment_methods.count_documents({"user_id": current["id"]}) > 0
        doc = {
            "user_id": current["id"],
            "type": card.get("brand") or "card",
            "label": str(card.get("brand") or "Kort").capitalize(),
            "last4": card.get("last4") or "",
            "exp_month": card.get("exp_month"),
            "exp_year": card.get("exp_year"),
            "stripe_payment_method_id": pm_id,
            "stripe_customer_id": customer_id,
            "stripe_setup_intent_id": setup_intent_id,
            "setup_status": "succeeded",
            "verified": True,
            "wallet": (card.get("wallet") or {}).get("type"), **consent,
            "is_default": not has_any,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        query = {"user_id": current["id"], "stripe_payment_method_id": pm_id}
        try:
            await db.payment_methods.update_one(query, {"$setOnInsert": doc}, upsert=True)
        except DuplicateKeyError:
            pass
        doc = await db.payment_methods.find_one(query)
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        return {"ready": True, "verified": True, "card": doc}

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
        if trip.get("payment_flow") == "reservation":
            raise HTTPException(409, "Turen betales automatisk fra kortreservasjonen. Ingen ny betaling skal startes.")
        if trip.get("price_review_required"):
            raise HTTPException(409, "Turen ble avsluttet tidlig. SNAR må kontrollere turprisen før betaling.")
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
                amount=amount_ore, currency="nok", automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
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
        if not event.get("account") and event.get("type") == "setup_intent.succeeded":
            setup = event["data"]["object"]
            metadata = setup.get("metadata") or {}
            if metadata.get("source") != "kjapp_native_setup":
                return False
            try:
                user = await db.users.find_one({"_id": ObjectId(metadata.get("user_id"))})
            except (InvalidId, TypeError):
                return False
            if not user:
                return False
            await native_setup_status(setup["id"], {"id": str(user["_id"]), "role": user.get("role")})
            return True
        if event.get("account") or event.get("type") != "payment_intent.succeeded":
            return False
        pi = event["data"]["object"]
        record = await db.payment_transactions.find_one({"kind": "native_payment", "stripe_payment_intent_id": pi["id"]})
        if not record:
            return False
        await reconcile_native(pi, record)
        return True

    return handle_native_webhook
