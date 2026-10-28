"""Provider-verified phone login for existing, unambiguous Customer accounts.

No automatic linking by an unverified phone/email and no production test codes.
New customers retain the existing registration and verified social flows.
"""
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, Field


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


class OtpStart(BaseModel):
    phone: str = Field(min_length=8, max_length=32)


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
                         create_twofa_token, set_auth_cookie, user_public):
    def digest(phone):
        return hmac.new(secret.encode(), phone.encode(), hashlib.sha256).hexdigest()

    async def account(phone):
        sep = r"[\s().-]*"
        pattern = r"^(?:(?:\+|00)?47" + sep + r")?" + sep.join(phone[3:]) + "$"
        # A duplicated legacy phone must never select an arbitrary account.
        rows = await db.users.find({"role": "user", "phone": {"$regex": pattern}}).to_list(2)
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
        return {"enabled": sms_config() is not None, "country_code": "+47", "existing_accounts_only": True}

    @api.post("/auth/customer/otp/start")
    async def start(body: OtpStart, request: Request):
        await rate_limit(request, "customer-otp-start", 10, 900)
        settings = sms_config()
        if not settings:
            raise HTTPException(503, "SMS-innlogging er ikke tilgjengelig ennå. Velg en annen innlogging.")
        phone = norwegian_phone(body.phone)
        if not phone:
            raise HTTPException(400, "Skriv inn et gyldig norsk mobilnummer.")
        await phone_limit(phone, "start", 5)
        user = await account(phone)
        challenge = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        verification = await provider_call(settings, "Verifications", {
            "To": phone, "Channel": "sms", "Locale": "nb"}) if user else {}
        if user and (verification.get("status") != "pending" or not verification.get("sid")):
            raise HTTPException(502, "SMS-tjenesten bekreftet ikke sendingen. Prøv igjen.")
        await db.customer_otp_challenges.insert_one({
            "_id": challenge, "phone_hash": digest(phone), "user_id": user["_id"] if user else None,
            "verification_sid": verification.get("sid"), "expires_at": now + timedelta(minutes=5),
            "attempts": 0, "consumed": False})
        return {"challenge_id": challenge, "expires_in": 300,
                "message": "Hvis nummeret er knyttet til en kundekonto, mottar du en SMS."}

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
        if consumed.modified_count != 1 or not user or user["_id"] != challenge["user_id"]:
            raise HTTPException(401, "Feil eller utløpt kode.")
        if user.get("totp_enabled"):
            return {"twofa_required": True, "twofa_token": create_twofa_token(str(user["_id"]))}
        token = create_access_token(str(user["_id"]), user.get("email") or "")
        set_auth_cookie(response, token)
        return {"token": token, "user": user_public(user)}
