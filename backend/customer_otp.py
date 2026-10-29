"""Provider-verified Customer login and explicit, verified phone registration.

No automatic linking by an unverified phone/email and no production test codes.
Registration details are supplied explicitly and become an account only after
provider approval. Legacy clients retain their existing-account-only behavior.
"""
import asyncio
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool
from pymongo.errors import DuplicateKeyError


def norwegian_phone(raw):
    value = str(raw or "").strip()
    if not re.fullmatch(r"[+\d\s().-]+", value):
        return None
    digits = re.sub(r"\D", "", value)
    if digits.startswith("0047"):
        digits = digits[4:]
    elif len(digits) == 10 and digits.startswith("47"):
        digits = digits[2:]
    return "+47" + digits if re.fullmatch(r"[2-9]\d{7}", digits) else None


def sms_config():
    qa = os.getenv("APP_ENV", "").strip().lower() == "qa"
    prefix = "QA_" if qa else ""
    if os.getenv(prefix + "CUSTOMER_OTP_ENABLED", "false").lower() != "true":
        return None
    values = tuple(os.getenv(prefix + key, "").strip() for key in (
        "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"))
    return values if all(values) else None


class PhoneSignup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fullName: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    accepted_terms: StrictBool = False
    legal_version: str = Field(max_length=32)


class OtpStart(BaseModel):
    phone: str = Field(min_length=8, max_length=32)
    signup: PhoneSignup | None = None


class OtpVerify(OtpStart):
    challenge_id: str = Field(min_length=20, max_length=128)
    code: str = Field(pattern=r"^\d{4,10}$")


async def provider_call(config, action, data):
    sid, token, service = config
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"https://verify.twilio.com/v2/Services/{service}/{action}",
                data=data, auth=(sid, token))
        if response.status_code == 404:
            return {}
        if response.status_code >= 400:
            raise HTTPException(502, "SMS-tjenesten er utilgjengelig. Prøv igjen eller bruk annen innlogging.")
        return response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "Kunne ikke kontakte SMS-tjenesten. Prøv igjen.") from None


def install_customer_otp(api, db, *, rate_limit, secret, create_access_token,
                         create_twofa_token, set_auth_cookie, user_public,
                         hash_password=None, current_legal_version="2026-09", on_customer_created=None):
    def digest(phone):
        return hmac.new(secret.encode(), phone.encode(), hashlib.sha256).hexdigest()

    def signup_enabled():
        prefix = "QA_" if os.getenv("APP_ENV", "").strip().lower() == "qa" else ""
        return hash_password is not None and os.getenv(prefix + "CUSTOMER_OTP_SIGNUP_ENABLED", "false").lower() == "true"

    async def accounts(phone):
        sep = r"[\s().-]*"
        pattern = r"^(?:(?:\+|00)?47" + sep + r")?" + sep.join(phone[3:]) + "$"
        # A duplicated legacy phone must never select an arbitrary account.
        return await db.users.find({"role": "user", "$or": [
            {"phone_e164": None, "phone": {"$regex": pattern}}, {"phone_e164": phone}]}).to_list(2)

    async def account(phone):
        rows = await accounts(phone)
        return rows[0] if len(rows) == 1 and not rows[0].get("disabled") else None

    async def phone_limit(phone, scope, limit):
        now = datetime.now(timezone.utc)
        bucket = int(now.timestamp()) // 900
        key = f"customer-otp:{scope}:{digest(phone)}:{bucket}"
        await db.rate_limit_buckets.update_one({"_id": key}, {
            "$inc": {"count": 1}, "$setOnInsert": {"expires_at": now + timedelta(minutes=30)}}, upsert=True)
        row = await db.rate_limit_buckets.find_one({"_id": key})
        if row["count"] > limit:
            raise HTTPException(429, "For mange SMS-forsøk. Prøv igjen senere.", headers={"Retry-After": "900"})

    @api.get("/auth/customer/otp/config")
    async def config():
        enabled = sms_config() is not None
        registration = enabled and signup_enabled()
        return {"enabled": enabled, "country_code": "+47", "existing_accounts_only": not registration,
                "signup_enabled": registration, "legal_version": current_legal_version}

    @api.post("/auth/customer/otp/start")
    async def start(body: OtpStart, request: Request):
        await rate_limit(request, "customer-otp-start", 10, 900)
        settings = sms_config()
        if not settings:
            raise HTTPException(503, "SMS-innlogging er ikke tilgjengelig ennå. Velg en annen innlogging.")
        phone = norwegian_phone(body.phone)
        if not phone:
            raise HTTPException(400, "Skriv inn et gyldig norsk mobilnummer.")
        signup = None
        if body.signup:
            if not signup_enabled():
                raise HTTPException(503, "Telefonregistrering er ikke tilgjengelig ennå.")
            signup = body.signup.model_dump()
            signup["email"] = signup["email"].strip().lower()
            signup["fullName"] = " ".join(signup["fullName"].split())
            if (len(signup["fullName"]) < 2 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", signup["email"])
                    or signup["accepted_terms"] is not True or signup["legal_version"] != current_legal_version):
                raise HTTPException(400, "Fyll inn navn og gyldig e-post, og godta gjeldende vilkår og personvern.")
        await phone_limit(phone, "start", 5)
        rows = await accounts(phone)
        user = rows[0] if len(rows) == 1 and not rows[0].get("disabled") else None
        create_customer = signup is not None and not rows
        if create_customer and await db.users.find_one({"email": signup["email"]}):
            raise HTTPException(409, "E-post er allerede registrert. Logg inn på den eksisterende kontoen.")
        challenge = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        verification = await provider_call(settings, "Verifications", {
            "To": phone, "Channel": "sms", "Locale": "nb"}) if user or create_customer else {}
        if (user or create_customer) and (verification.get("status") != "pending" or not verification.get("sid")):
            raise HTTPException(502, "SMS-tjenesten bekreftet ikke sendingen. Prøv igjen.")
        await db.customer_otp_challenges.insert_one({
            "_id": challenge, "phone_hash": digest(phone), "user_id": user["_id"] if user else None,
            "verification_sid": verification.get("sid"), "expires_at": now + timedelta(minutes=5),
            "signup": signup if create_customer else None,
            "signup_terms_accepted_at": now.isoformat() if create_customer else None,
            "attempts": 0, "consumed": False})
        return {"challenge_id": challenge, "expires_in": 300,
                "message": "Skriv inn koden fra SMS for å fortsette." if signup else "Hvis nummeret er knyttet til en kundekonto, mottar du en SMS."}

    @api.post("/auth/customer/otp/verify")
    async def verify(body: OtpVerify, request: Request, response: Response):
        await rate_limit(request, "customer-otp-verify", 30, 900)
        settings = sms_config()
        if not settings:
            raise HTTPException(503, "SMS-innlogging er ikke tilgjengelig ennå.")
        phone = norwegian_phone(body.phone)
        if not phone:
            raise HTTPException(401, "Feil eller utløpt kode.")
        await phone_limit(phone, "verify", 10)
        now = datetime.now(timezone.utc)
        query = {"_id": body.challenge_id, "phone_hash": digest(phone),
                 "consumed": False, "expires_at": {"$gt": now}, "attempts": {"$lt": 5}}
        result = await db.customer_otp_challenges.update_one(query, {"$inc": {"attempts": 1}})
        challenge = await db.customer_otp_challenges.find_one({"_id": body.challenge_id}) if result.modified_count else None
        if not challenge or not challenge.get("verification_sid"):
            raise HTTPException(401, "Feil eller utløpt kode.")
        checked = await provider_call(settings, "VerificationCheck", {
            "VerificationSid": challenge["verification_sid"], "Code": body.code})
        if checked.get("status") != "approved" or checked.get("sid") != challenge["verification_sid"]:
            raise HTTPException(401, "Feil eller utløpt kode.")
        # Atomically consume before issuing anything; concurrent/replayed requests cannot mint a session.
        consumed = await db.customer_otp_challenges.update_one({
            "_id": body.challenge_id, "consumed": False, "expires_at": {"$gt": datetime.now(timezone.utc)}},
            {"$set": {"consumed": True}})
        user = await account(phone)
        if consumed.modified_count != 1:
            raise HTTPException(401, "Feil eller utløpt kode.")
        signup = challenge.get("signup")
        if signup:
            if (not signup_enabled() or signup.get("legal_version") != current_legal_version
                    or signup.get("accepted_terms") is not True):
                raise HTTPException(409, "Registreringen må startes på nytt med gjeldende vilkår.")
            # A newly claimed or duplicated phone never silently becomes a login.
            if await accounts(phone) or await db.users.find_one({"email": signup["email"]}):
                raise HTTPException(409, "Kontoopplysningene er allerede registrert. Bruk innlogging.")
            now_iso = datetime.now(timezone.utc).isoformat()
            try:
                result = await db.users.insert_one({
                    "email": signup["email"], "fullName": signup["fullName"],
                    "email_verified": False,
                    "phone": phone, "phone_e164": phone, "phone_verified_at": now_iso,
                    "password_hash": await asyncio.to_thread(hash_password, secrets.token_urlsafe(32)),
                    "role": "user", "created_at": now_iso,
                    "accepted_terms_at": challenge["signup_terms_accepted_at"],
                    "legal_version": current_legal_version, "welcome_email_pending": True,
                })
            except DuplicateKeyError:
                raise HTTPException(409, "Kontoopplysningene er allerede registrert. Bruk innlogging.") from None
            user = await db.users.find_one({"_id": result.inserted_id})
            if on_customer_created:
                await on_customer_created(user)
        else:
            if not user or user["_id"] != challenge["user_id"]:
                raise HTTPException(401, "Feil eller utløpt kode.")
            try:
                verified = await db.users.update_one({
                    "_id": user["_id"], "role": "user", "disabled": {"$ne": True},
                    "phone": user.get("phone"), "phone_e164": user.get("phone_e164"),
                }, {"$set": {"phone_e164": phone, "phone_verified_at": datetime.now(timezone.utc).isoformat()}})
            except DuplicateKeyError:
                raise HTTPException(401, "Mobilnummeret må avklares før innlogging.") from None
            if verified.matched_count != 1:
                raise HTTPException(401, "Kontoen er endret. Start innloggingen på nytt.")
        if user.get("totp_enabled"):
            return {"twofa_required": True, "twofa_token": create_twofa_token(str(user["_id"]))}
        token = create_access_token(str(user["_id"]), user.get("email") or "")
        set_auth_cookie(response, token)
        return {"token": token, "user": user_public(user)}
