"""
SNAR Founding 500 — Registration, Verification & Invitation Flow

This module handles the complete customer-facing registration flow for the
Founding 500 Oslo Beta campaign:
- Phone number verification via Twilio OTP
- Campaign place allocation (max 500)
- Automatic email invitations with device-specific links (APK/TestFlight)
- Admin controls for approval and monitoring
"""
import hashlib
import hmac
import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import httpx
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, StrictBool
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

# Reuse existing configurations
from customer_otp import norwegian_phone, sms_config, provider_call
from onboarding_emails import queue_confirmation, deliver_one
from email_delivery import email_configured

CAMPAIGN_ID = "founding-500-oslo"
CAMPAIGN_NAME = "Founding 500 Oslo Beta"

# Campaign constants
MAX_CAMPAIGN_CUSTOMERS = 500
MAX_SUBSIDY_KR = 180  # NOK 180 max subsidy per ride
TOTAL_CAMPAIGN_BUDGET_KR = 90000  # NOK 90,000 total budget

# Invitation statuses
INVITATION_STATUS_PENDING = "pending"
INVITATION_STATUS_QUEUED = "queued"
INVITATION_STATUS_SENT = "sent"
INVITATION_STATUS_FAILED = "failed"
INVITATION_STATUS_ACCEPTED = "accepted"

# Device-specific invitation types
DEVICE_IOS = "ios"
DEVICE_ANDROID = "android"

# Collections
COLLECTION_CAMPAIGN_REGISTRATIONS = "founding500_registrations"
COLLECTION_CAMPAIGN_INVITATIONS = "founding500_invitations"
COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS = "founding500_phone_verifications"
COLLECTION_CAMPAIGN_AUDIT = "founding500_audit"

# Rate limiting
RATE_LIMIT_VERIFY_START = 5  # per 15 min per phone
RATE_LIMIT_VERIFY_CHECK = 10  # per 15 min per phone
RATE_LIMIT_INVITE_RESEND = 3  # per hour per registration


class Founding500Registration(BaseModel):
    """Customer registration for Founding 500 campaign."""
    registration_id: str
    identity_key: str  # Links to beta_waitlist entry
    name: str
    phone: str  # E.164 format
    phone_hash: str  # HMAC for privacy
    email: str
    city: str
    district: Optional[str] = None
    device: Literal["ios", "android"]
    status: Literal["pending_verification", "verified", "allocated", "invited", "completed", "rejected", "waitlisted"]
    created_at: str
    verified_at: Optional[str] = None
    allocated_at: Optional[str] = None
    invitation_id: Optional[str] = None
    invitation_status: Optional[str] = None
    customer_id: Optional[str] = None  # Linked after app signup


class PhoneVerificationStart(BaseModel):
    phone: str = Field(min_length=8, max_length=32)
    registration_id: str


class PhoneVerificationVerify(BaseModel):
    phone: str = Field(min_length=8, max_length=32)
    registration_id: str
    challenge_id: str = Field(min_length=20, max_length=128)
    code: str = Field(pattern=r"^\d{4,10}$")


class AdminApprovalRequest(BaseModel):
    registration_id: str
    action: Literal["approve", "reject", "waitlist"]
    reason: Optional[str] = None


class InvitationResendRequest(BaseModel):
    registration_id: str


class CampaignStatusResponse(BaseModel):
    """Current campaign status for admin dashboard."""
    campaign_id: str
    name: str
    active: bool
    total_registrations: int
    verified_count: int
    allocated_count: int
    invited_count: int
    completed_count: int
    waitlisted_count: int
    remaining_places: int
    budget_total_kr: int
    budget_reserved_kr: int
    budget_consumed_kr: int
    kill_switch: bool
    updated_at: str


def _get_secret() -> str:
    """Get HMAC secret for phone hashing."""
    return os.getenv("FOUNDING500_HMAC_SECRET", "dev-secret-change-in-production")


def _phone_hash(phone: str) -> str:
    """Create HMAC hash of phone number for privacy."""
    return hmac.new(_get_secret().encode(), phone.encode(), hashlib.sha256).hexdigest()[:32]


def _registration_id(phone_hash: str, identity_key: str) -> str:
    """Generate deterministic registration ID."""
    return hashlib.sha256(f"{phone_hash}:{identity_key}".encode()).hexdigest()[:24]


def _challenge_id() -> str:
    """Generate secure challenge ID."""
    return secrets.token_urlsafe(32)


def _invitation_id() -> str:
    """Generate invitation ID."""
    return secrets.token_urlsafe(24)


async def ensure_founding500_indexes(db) -> None:
    """Create database indexes for Founding 500 collections."""
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].create_index("registration_id", unique=True)
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].create_index("identity_key", unique=True)
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].create_index("phone_hash")
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].create_index("status")
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].create_index([("device", 1), ("status", 1)])
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].create_index("created_at")

    await db[COLLECTION_CAMPAIGN_INVITATIONS].create_index("invitation_id", unique=True)
    await db[COLLECTION_CAMPAIGN_INVITATIONS].create_index("registration_id")
    await db[COLLECTION_CAMPAIGN_INVITATIONS].create_index("status")
    await db[COLLECTION_CAMPAIGN_INVITATIONS].create_index("created_at")

    await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].create_index("challenge_id", unique=True)
    await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].create_index("registration_id")
    await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].create_index("phone_hash")
    await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].create_index("expires_at", expireAfterSeconds=0)

    await db[COLLECTION_CAMPAIGN_AUDIT].create_index([("at", -1)])
    await db[COLLECTION_CAMPAIGN_AUDIT].create_index("entity_id")


async def _audit(db, admin_id: str, action: str, entity_type: str, entity_id: str,
                 before: Optional[dict] = None, after: Optional[dict] = None,
                 reason: Optional[str] = None) -> None:
    """Write audit log entry."""
    await db[COLLECTION_CAMPAIGN_AUDIT].insert_one({
        "admin_id": admin_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "before": before,
        "after": after,
        "reason": reason,
        "at": datetime.now(timezone.utc).isoformat(),
    })


async def _get_campaign_config(db) -> dict:
    """Get campaign configuration from beta_campaign config."""
    doc = await db.beta_campaign_config.find_one({"campaign_id": CAMPAIGN_ID})
    if doc:
        return {
            "max_customers": doc.get("max_customers", MAX_CAMPAIGN_CUSTOMERS),
            "cost_cap_kr": doc.get("cost_cap_kr", MAX_SUBSIDY_KR),
            "total_budget_kr": doc.get("total_budget_kr", TOTAL_CAMPAIGN_BUDGET_KR),
            "active": doc.get("active", False),
            "kill_switch": doc.get("kill_switch", False),
        }
    return {
        "max_customers": MAX_CAMPAIGN_CUSTOMERS,
        "cost_cap_kr": MAX_SUBSIDY_KR,
        "total_budget_kr": TOTAL_CAMPAIGN_BUDGET_KR,
        "active": False,
        "kill_switch": False,
    }


async def _get_allocated_count(db) -> int:
    """Get count of allocated (approved) registrations."""
    return await db[COLLECTION_CAMPAIGN_REGISTRATIONS].count_documents({"status": "allocated"})


async def _get_verified_count(db) -> int:
    """Get count of verified registrations."""
    return await db[COLLECTION_CAMPAIGN_REGISTRATIONS].count_documents({"status": "verified"})


async def _get_invited_count(db) -> int:
    """Get count of invited registrations."""
    return await db[COLLECTION_CAMPAIGN_INVITATIONS].count_documents({"status": INVITATION_STATUS_SENT})


async def _check_rate_limit(db, phone_hash: str, scope: str, limit: int, window_seconds: int = 900) -> None:
    """Check and consume rate limit bucket."""
    now = datetime.now(timezone.utc)
    bucket = int(now.timestamp()) // window_seconds
    key = f"founding500:{scope}:{phone_hash}:{bucket}"
    await db.rate_limit_buckets.update_one(
        {"_id": key},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {"expires_at": now + timedelta(minutes=30)},
        },
        upsert=True,
    )
    row = await db.rate_limit_buckets.find_one({"_id": key})
    if row["count"] > limit:
        raise HTTPException(429, "For mange forespørsler. Prøv igjen senere.", headers={"Retry-After": str(window_seconds)})


async def create_registration_from_waitlist(db, identity_key: str) -> Founding500Registration:
    """
    Create a Founding 500 registration from an approved waitlist entry.
    This is called by admin after reviewing waitlist entry.
    """
    # Find waitlist entry
    waitlist_entry = await db.beta_waitlist.find_one({"identity_key": identity_key})
    if not waitlist_entry:
        raise HTTPException(404, "Ventelisteoppføring ikke funnet")

    if waitlist_entry.get("role") != "passenger":
        raise HTTPException(400, "Bare kunde-påmeldinger kan bli registrert for Founding 500")

    # Check if already registered
    existing = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"identity_key": identity_key})
    if existing:
        return Founding500Registration(**{k: v for k, v in existing.items() if k != "_id"})

    # Check campaign config
    config = await _get_campaign_config(db)
    if config["kill_switch"]:
        raise HTTPException(503, "Kampanjen er midlertidig deaktivert")

    allocated = await _get_allocated_count(db)
    if allocated >= config["max_customers"]:
        raise HTTPException(409, f"Kampanjen er full (maks {config['max_customers']} kunder)")

    # Validate required fields
    device = waitlist_entry.get("device")
    if not device or device not in (DEVICE_IOS, DEVICE_ANDROID):
        raise HTTPException(400, "Enhetstype (iOS/Android) må være registrert for Founding 500")

    phone = waitlist_entry.get("phone")
    if not phone:
        raise HTTPException(400, "Telefonnummer mangler på ventelisteoppføring")

    email = waitlist_entry.get("email", "")
    name = waitlist_entry.get("name", "")
    city = waitlist_entry.get("city", "Oslo")
    district = waitlist_entry.get("district")

    # Normalize and hash phone
    normalized_phone = norwegian_phone(phone)
    if not normalized_phone:
        raise HTTPException(400, "Ugyldig telefonnummer format")
    phone_hash = _phone_hash(normalized_phone)

    # Check for duplicate phone (prevent same person with different emails)
    duplicate = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one(
        {"phone_hash": phone_hash, "status": {"$in": ["verified", "allocated", "invited", "completed"]}}
    )
    if duplicate:
        raise HTTPException(409, "Dette telefonnummeret er allerede registrert for Founding 500")

    # Create registration
    now = datetime.now(timezone.utc)
    registration_id = _registration_id(phone_hash, identity_key)

    registration = Founding500Registration(
        registration_id=registration_id,
        identity_key=identity_key,
        name=name,
        phone=normalized_phone,
        phone_hash=phone_hash,
        email=email.lower().strip() if email else "",
        city=city,
        district=district,
        device=device,
        status="pending_verification",
        created_at=now.isoformat(),
    )

    try:
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].insert_one(registration.model_dump())
    except DuplicateKeyError:
        existing = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration_id})
        return Founding500Registration(**{k: v for k, v in existing.items() if k != "_id"})

    # Update waitlist status
    await db.beta_waitlist.update_one(
        {"identity_key": identity_key},
        {"$set": {"founding500_registered_at": now.isoformat(), "founding500_status": "pending_verification"}},
    )

    return registration


async def start_phone_verification(db, phone: str, registration_id: str) -> dict:
    """Start phone verification for a Founding 500 registration."""
    settings = sms_config()
    if not settings:
        raise HTTPException(503, "SMS-verifisering er ikke tilgjengelig akkurat nå")

    normalized_phone = norwegian_phone(phone)
    if not normalized_phone:
        raise HTTPException(400, "Skriv inn et gyldig norsk mobilnummer")

    # Find registration
    registration = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration_id})
    if not registration:
        raise HTTPException(404, "Registrering ikke funnet")

    if registration["status"] not in ("pending_verification", "verified"):
        raise HTTPException(400, "Registrering kan ikke verifiseres i nåværende status")

    if registration["phone"] != normalized_phone:
        raise HTTPException(400, "Telefonnummer matcher ikke registreringen")

    phone_hash = _phone_hash(normalized_phone)
    if registration["phone_hash"] != phone_hash:
        raise HTTPException(400, "Telefonnummer hash mismatch")

    # Rate limiting
    await _check_rate_limit(db, phone_hash, "verify_start", RATE_LIMIT_VERIFY_START)

    # Create challenge
    challenge_id = _challenge_id()
    now = datetime.now(timezone.utc)

    # Send OTP via Twilio
    verification = await provider_call(settings, "Verifications", {
        "To": normalized_phone, "Channel": "sms", "Locale": "nb"
    })

    if verification.get("status") != "pending" or not verification.get("sid"):
        raise HTTPException(502, "SMS-tjenesten bekreftet ikke sendingen. Prøv igjen.")

    # Store challenge
    await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].insert_one({
        "_id": challenge_id,
        "registration_id": registration_id,
        "phone_hash": phone_hash,
        "verification_sid": verification["sid"],
        "expires_at": now + timedelta(minutes=5),
        "attempts": 0,
        "consumed": False,
        "created_at": now.isoformat(),
    })

    # Update registration
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
        {"registration_id": registration_id},
        {"$set": {"phone_verification_challenge": challenge_id, "phone_verification_expires": (now + timedelta(minutes=5)).isoformat()}},
    )

    return {"challenge_id": challenge_id, "expires_in": 300, "message": "Kode sendt via SMS. Skriv inn koden for å verifisere telefonnummeret."}


async def verify_phone(db, phone: str, registration_id: str, challenge_id: str, code: str) -> dict:
    """Verify phone OTP for Founding 500 registration."""
    settings = sms_config()
    if not settings:
        raise HTTPException(503, "SMS-verifisering er ikke tilgjengelig akkurat nå")

    normalized_phone = norwegian_phone(phone)
    if not normalized_phone:
        raise HTTPException(401, "Feil eller utløpt kode")

    # Rate limiting
    phone_hash = _phone_hash(normalized_phone)
    await _check_rate_limit(db, phone_hash, "verify_check", RATE_LIMIT_VERIFY_CHECK)

    now = datetime.now(timezone.utc)

    # Find and validate challenge
    challenge = await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].find_one({
        "_id": challenge_id,
        "registration_id": registration_id,
        "phone_hash": phone_hash,
        "consumed": False,
        "expires_at": {"$gt": now},
        "attempts": {"$lt": 5},
    })

    if not challenge:
        raise HTTPException(401, "Feil eller utløpt kode")

    # Increment attempts
    await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].update_one(
        {"_id": challenge_id},
        {"$inc": {"attempts": 1}},
    )

    # Verify with Twilio
    checked = await provider_call(settings, "VerificationCheck", {
        "VerificationSid": challenge["verification_sid"],
        "Code": code
    })

    if checked.get("status") != "approved" or checked.get("sid") != challenge["verification_sid"]:
        raise HTTPException(401, "Feil eller utløpt kode")

    # Atomically consume challenge
    consumed = await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].update_one({
        "_id": challenge_id,
        "consumed": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    }, {"$set": {"consumed": True, "verified_at": datetime.now(timezone.utc).isoformat()}})

    if consumed.modified_count != 1:
        raise HTTPException(401, "Feil eller utløpt kode")

    # Update registration status to verified
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
        {"registration_id": registration_id},
        {"$set": {"status": "verified", "verified_at": datetime.now(timezone.utc).isoformat(), "phone_verified_at": datetime.now(timezone.utc).isoformat()}},
    )

    # Update waitlist
    registration = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration_id})
    if registration:
        await db.beta_waitlist.update_one(
            {"identity_key": registration["identity_key"]},
            {"$set": {"founding500_status": "verified", "phone_verified_at": datetime.now(timezone.utc).isoformat()}},
        )

    return {"ok": True, "status": "verified", "message": "Telefonnummeret er verifisert. Du står i kø for en plass i Founding 500."}


async def allocate_campaign_place(db, registration_id: str, admin_id: str) -> dict:
    """Allocate a campaign place to a verified registration (admin action)."""
    config = await _get_campaign_config(db)
    if config["kill_switch"]:
        raise HTTPException(503, "Kampanjen er midlertidig deaktivert")

    allocated = await _get_allocated_count(db)
    if allocated >= config["max_customers"]:
        raise HTTPException(409, f"Kampanjen er full (maks {config['max_customers']} kunder)")

    registration = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration_id})
    if not registration:
        raise HTTPException(404, "Registrering ikke funnet")

    if registration["status"] != "verified":
        raise HTTPException(400, "Kun verifiserte registreringer kan få tilordnet plass")

    # Check for duplicate phone among allocated
    duplicate = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({
        "phone_hash": registration["phone_hash"],
        "status": {"$in": ["allocated", "invited", "completed"]},
        "registration_id": {"$ne": registration_id},
    })
    if duplicate:
        raise HTTPException(409, "Dette telefonnummeret har allerede en tildelt plass")

    now = datetime.now(timezone.utc)
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
        {"registration_id": registration_id},
        {"$set": {"status": "allocated", "allocated_at": now.isoformat()}},
    )

    # Update waitlist
    await db.beta_waitlist.update_one(
        {"identity_key": registration["identity_key"]},
        {"$set": {"founding500_status": "allocated", "allocated_at": now.isoformat()}},
    )

    await _audit(db, admin_id, "campaign.allocate", "registration", registration_id,
                 {"status": "verified"}, {"status": "allocated"}, "Admin allocated campaign place")

    return {"ok": True, "status": "allocated", "message": "Plass i Founding 500 er tildelt. Invitasjon sendes automatisk."}


async def send_invitation(db, registration_id: str) -> dict:
    """Send invitation email with device-specific link."""
    registration = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration_id})
    if not registration:
        raise HTTPException(404, "Registrering ikke funnet")

    if registration["status"] not in ("allocated", "invited"):
        raise HTTPException(400, "Registrering må være tildelt plass før invitasjon kan sendes")

    if not registration.get("email"):
        raise HTTPException(400, "E-postadresse mangler for invitasjon")

    # Check for existing invitation
    existing_invitation = await db[COLLECTION_CAMPAIGN_INVITATIONS].find_one({
        "registration_id": registration_id,
        "status": {"$in": [INVITATION_STATUS_PENDING, INVITATION_STATUS_QUEUED, INVITATION_STATUS_SENT]},
    })

    if existing_invitation:
        # Re-queue if failed or pending
        if existing_invitation["status"] in (INVITATION_STATUS_FAILED, INVITATION_STATUS_PENDING):
            await db[COLLECTION_CAMPAIGN_INVITATIONS].update_one(
                {"invitation_id": existing_invitation["invitation_id"]},
                {"$set": {"status": INVITATION_STATUS_QUEUED, "next_attempt_at": datetime.now(timezone.utc).isoformat()}},
            )
            return {"ok": True, "invitation_id": existing_invitation["invitation_id"], "status": "queued"}
        return {"ok": True, "invitation_id": existing_invitation["invitation_id"], "status": existing_invitation["status"]}

    # Create invitation
    invitation_id = _invitation_id()
    now = datetime.now(timezone.utc)

    # Get device-specific link
    device = registration["device"]
    if device == DEVICE_ANDROID:
        apk_link = os.getenv("FOUNDING500_ANDROID_APK_URL", "https://expo.dev/accounts/foziakahero/projects/kjapp/builds")
        invite_note = f"Last ned SNAR-kundeappen for Android: {apk_link}"
    elif device == DEVICE_IOS:
        testflight_link = os.getenv("FOUNDING500_IOS_TESTFLIGHT_URL", "https://testflight.apple.com/join/")
        invite_note = f"Bli med i TestFlight for iOS: {testflight_link}"
    else:
        invite_note = "Du vil motta installasjonsinstruksjoner kort."

    invitation = {
        "_id": invitation_id,
        "registration_id": registration_id,
        "device": device,
        "email": registration["email"],
        "name": registration["name"],
        "status": INVITATION_STATUS_QUEUED,
        "invite_note": invite_note,
        "apk_link": os.getenv("FOUNDING500_ANDROID_APK_URL") if device == DEVICE_ANDROID else None,
        "testflight_link": os.getenv("FOUNDING500_IOS_TESTFLIGHT_URL") if device == DEVICE_IOS else None,
        "attempts": 0,
        "created_at": now.isoformat(),
        "next_attempt_at": now.isoformat(),
        "email_attempts": 0,
        "email_next_attempt_at": now.isoformat(),
    }

    await db[COLLECTION_CAMPAIGN_INVITATIONS].insert_one(invitation)

    # Queue email confirmation
    kind = "founding500_invitation"
    subject = "Velkommen til SNAR Founding 500!"
    message = (
        f"Hei {registration['name']}.\n\n"
        f"Gratulerer! Du har fått en plass i SNAR Founding 500 – vår eksklusive Oslo-beta.\n\n"
        f"Som en av de første 500 kundene får du én velkomsttur med opptil 180 kr i rabatt.\n\n"
        f"{invite_note}\n\n"
        f"Denne invitasjonen er personlig og knyttet til ditt verifiserte telefonnummer.\n\n"
        f"Med vennlig hilsen,\nSNAR-teamet"
    )

    # Use existing email outbox
    await db.onboarding_email_outbox.update_one(
        {"_id": f"{kind}:{invitation_id}"},
        {"$setOnInsert": {
            "recipient": registration["email"],
            "subject": subject,
            "html": f'<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px"><h1>SNAR</h1><p>{message.replace(chr(10), "<br>")}</p></div>',
            "kind": kind,
            "entity_id": invitation_id,
            "status": "pending",
            "attempts": 0,
            "provider": "transactional",
            "created_at": now,
            "next_attempt_at": now,
        }},
        upsert=True,
    )

    # Update registration
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
        {"registration_id": registration_id},
        {"$set": {"status": "invited", "invitation_id": invitation_id, "invitation_status": INVITATION_STATUS_QUEUED}},
    )

    # Update waitlist
    await db.beta_waitlist.update_one(
        {"identity_key": registration["identity_key"]},
        {"$set": {"founding500_status": "invited", "invitation_id": invitation_id}},
    )

    return {"ok": True, "invitation_id": invitation_id, "status": "queued"}


async def process_invitation_queue(db) -> int:
    """Process pending invitations (send emails). Returns count processed."""
    processed = 0
    now = datetime.now(timezone.utc)

    # Find invitations ready to send
    invitations = await db[COLLECTION_CAMPAIGN_INVITATIONS].find({
        "status": {"$in": [INVITATION_STATUS_QUEUED, INVITATION_STATUS_FAILED]},
        "email_attempts": {"$lt": 8},
        "$or": [
            {"email_next_attempt_at": {"$lte": now.isoformat()}},
            {"email_next_attempt_at": {"$exists": False}},
        ],
    }).limit(20).to_list(20)

    for invite in invitations:
        # Lease
        lease_result = await db[COLLECTION_CAMPAIGN_INVITATIONS].find_one_and_update(
            {"_id": invite["_id"], "email_attempts": invite["email_attempts"]},
            {"$set": {"email_lease_until": (now + timedelta(minutes=2)).isoformat()}, "$inc": {"email_attempts": 1}},
            return_document=ReturnDocument.AFTER,
        )
        if not lease_result:
            continue

        # Send email via existing infrastructure
        kind = "founding500_invitation"
        job = await db.onboarding_email_outbox.find_one({"_id": f"{kind}:{invite['_id']}"})
        if job and job.get("status") in ("pending", "queued"):
            # Use existing deliver_one
            sent = await deliver_one(db, None, provider="transactional")
            if sent:
                await db[COLLECTION_CAMPAIGN_INVITATIONS].update_one(
                    {"_id": invite["_id"]},
                    {"$set": {"status": INVITATION_STATUS_SENT, "sent_at": datetime.now(timezone.utc).isoformat()}},
                )
                # Update registration
                await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
                    {"registration_id": invite["registration_id"]},
                    {"$set": {"invitation_status": INVITATION_STATUS_SENT}},
                )
                processed += 1
            else:
                # Schedule retry
                next_attempt = now + timedelta(minutes=min(60, 2 ** lease_result["email_attempts"]))
                await db[COLLECTION_CAMPAIGN_INVITATIONS].update_one(
                    {"_id": invite["_id"]},
                    {"$set": {"status": INVITATION_STATUS_FAILED, "email_next_attempt_at": next_attempt.isoformat()}},
                )

    return processed


async def get_campaign_status(db) -> CampaignStatusResponse:
    """Get current campaign status for admin dashboard."""
    config = await _get_campaign_config(db)

    total = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].count_documents({})
    verified = await _get_verified_count(db)
    allocated = await _get_allocated_count(db)
    invited = await _get_invited_count(db)
    completed = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].count_documents({"status": "completed"})
    waitlisted = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].count_documents({"status": "waitlisted"})

    # Budget calculations
    # Reserved = allocated * max_subsidy (180kr)
    budget_reserved = allocated * config["cost_cap_kr"]
    # Consumed would come from beta_campaign redemptions
    consumed_doc = await db.beta_campaign_redemptions.aggregate([
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_ore"}}},
    ]).to_list(1)
    budget_consumed_kr = (consumed_doc[0]["total"] // 100) if consumed_doc else 0

    return CampaignStatusResponse(
        campaign_id=CAMPAIGN_ID,
        name=CAMPAIGN_NAME,
        active=config["active"] and not config["kill_switch"],
        total_registrations=total,
        verified_count=verified,
        allocated_count=allocated,
        invited_count=invited,
        completed_count=completed,
        waitlisted_count=waitlisted,
        remaining_places=max(0, config["max_customers"] - allocated),
        budget_total_kr=config["total_budget_kr"],
        budget_reserved_kr=budget_reserved,
        budget_consumed_kr=budget_consumed_kr,
        kill_switch=config["kill_switch"],
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


async def list_registrations(
    db,
    status: Optional[str] = None,
    device: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """List campaign registrations with filters."""
    query = {}
    if status:
        query["status"] = status
    if device:
        query["device"] = device

    total = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].count_documents(query)
    entries = []
    async for doc in db[COLLECTION_CAMPAIGN_REGISTRATIONS].find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit):
        entries.append(Founding500Registration(**doc))

    return {"items": [e.model_dump() for e in entries], "total": total, "limit": limit, "offset": offset}


async def admin_update_registration(db, registration_id: str, action: str, admin_id: str, reason: Optional[str] = None) -> dict:
    """Admin action on registration (approve/reject/waitlist)."""
    registration = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration_id})
    if not registration:
        raise HTTPException(404, "Registrering ikke funnet")

    old_status = registration["status"]
    now = datetime.now(timezone.utc)

    if action == "approve":
        if old_status != "verified":
            raise HTTPException(400, "Kun verifiserte registreringer kan godkjennes")
        return await allocate_campaign_place(db, registration_id, admin_id)

    elif action == "reject":
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
            {"registration_id": registration_id},
            {"$set": {"status": "rejected", "rejected_at": now.isoformat(), "rejection_reason": reason}},
        )
        await db.beta_waitlist.update_one(
            {"identity_key": registration["identity_key"]},
            {"$set": {"founding500_status": "rejected"}},
        )
        await _audit(db, admin_id, "campaign.reject", "registration", registration_id,
                     {"status": old_status}, {"status": "rejected"}, reason)
        return {"ok": True, "status": "rejected"}

    elif action == "waitlist":
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
            {"registration_id": registration_id},
            {"$set": {"status": "waitlisted", "waitlisted_at": now.isoformat()}},
        )
        await db.beta_waitlist.update_one(
            {"identity_key": registration["identity_key"]},
            {"$set": {"founding500_status": "waitlisted"}},
        )
        await _audit(db, admin_id, "campaign.waitlist", "registration", registration_id,
                     {"status": old_status}, {"status": "waitlisted"}, reason)
        return {"ok": True, "status": "waitlisted"}

    raise HTTPException(400, "Ugyldig handling")


async def resend_invitation(db, registration_id: str, admin_id: str) -> dict:
    """Resend invitation (admin action)."""
    registration = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration_id})
    if not registration:
        raise HTTPException(404, "Registrering ikke funnet")

    if registration["status"] not in ("allocated", "invited"):
        raise HTTPException(400, "Registrering må være tildelt plass")

    # Rate limit check
    phone_hash = registration["phone_hash"]
    await _check_rate_limit(db, phone_hash, "invite_resend", RATE_LIMIT_INVITE_RESEND, 3600)

    # Reset invitation status to queued
    await db[COLLECTION_CAMPAIGN_INVITATIONS].update_one(
        {"registration_id": registration_id},
        {"$set": {"status": INVITATION_STATUS_QUEUED, "email_next_attempt_at": datetime.now(timezone.utc).isoformat()}},
    )

    await _audit(db, admin_id, "campaign.resend_invitation", "registration", registration_id,
                 {"invitation_status": registration.get("invitation_status")}, {"invitation_status": INVITATION_STATUS_QUEUED},
                 "Admin resent invitation")

    return await send_invitation(db, registration_id)


async def link_customer_account(db, registration_id: str, customer_id: str) -> dict:
    """Link a customer account to a registration (called after app signup)."""
    registration = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration_id})
    if not registration:
        raise HTTPException(404, "Registrering ikke funnet")

    if registration["status"] not in ("invited", "allocated", "verified"):
        raise HTTPException(400, "Registrering er ikke i en tilstand som tillater kontoknytning")

    # Check if customer already has a campaign enrollment
    existing_enrollment = await db.beta_campaign_enrollments.find_one({"customer_id": customer_id})
    if existing_enrollment and existing_enrollment.get("qualified"):
        raise HTTPException(409, "Denne kunden har allerede en kampanje-tilgang")

    # Check if this registration is already linked to another customer
    if registration.get("customer_id") and registration["customer_id"] != customer_id:
        raise HTTPException(409, "Registreringen er allerede knyttet til en annen kunde")

    now = datetime.now(timezone.utc)
    await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
        {"registration_id": registration_id},
        {"$set": {"customer_id": customer_id, "linked_at": now.isoformat()}},
    )

    # Also create beta_campaign enrollment
    from beta_campaign import qualify_customer
    enrollment = await qualify_customer(db, customer_id, registration["identity_key"])

    return {"ok": True, "enrollment": enrollment.model_dump() if hasattr(enrollment, 'model_dump') else enrollment}


def install_founding500(api, db, require_admin, audit) -> None:
    """Install Founding 500 endpoints."""

    @api.post("/founding500/phone/start", status_code=201)
    async def start_verification(body: PhoneVerificationStart):
        """Start phone verification for Founding 500 registration."""
        return await start_phone_verification(db, body.phone, body.registration_id)

    @api.post("/founding500/phone/verify")
    async def verify_phone_endpoint(body: PhoneVerificationVerify):
        """Verify phone OTP for Founding 500 registration."""
        return await verify_phone(db, body.phone, body.registration_id, body.challenge_id, body.code)

    @api.get("/founding500/registration/{registration_id}")
    async def get_registration(registration_id: str):
        """Get registration status (public, for customer app)."""
        reg = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration_id}, {"_id": 0})
        if not reg:
            raise HTTPException(404, "Registrering ikke funnet")
        # Only expose safe fields
        return {
            "registration_id": reg["registration_id"],
            "status": reg["status"],
            "device": reg["device"],
            "invitation_status": reg.get("invitation_status"),
            "allocated_at": reg.get("allocated_at"),
        }

    # Admin endpoints
    @api.get("/admin/founding500/status")
    async def admin_campaign_status(current=Depends(require_admin)):
        """Get campaign status for admin dashboard."""
        return await get_campaign_status(db)

    @api.get("/admin/founding500/registrations")
    async def admin_list_registrations(
        status: Optional[str] = Query(default=None),
        device: Optional[str] = Query(default=None),
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        current=Depends(require_admin),
    ):
        """List campaign registrations."""
        return await list_registrations(db, status, device, limit, offset)

    @api.post("/admin/founding500/registrations/{registration_id}/action")
    async def admin_registration_action(
        registration_id: str,
        body: AdminApprovalRequest,
        current=Depends(require_admin),
    ):
        """Admin action on registration (approve/reject/waitlist)."""
        result = await admin_update_registration(db, registration_id, body.action, current["id"], body.reason)
        return result

    @api.post("/admin/founding500/registrations/{registration_id}/resend-invitation")
    async def admin_resend_invitation(registration_id: str, current=Depends(require_admin)):
        """Resend invitation for a registration."""
        return await resend_invitation(db, registration_id, current["id"])

    @api.post("/internal/founding500/link-customer")
    async def internal_link_customer(registration_id: str, customer_id: str):
        """Internal endpoint: link customer account after app signup."""
        return await link_customer_account(db, registration_id, customer_id)

    @api.post("/internal/founding500/process-invitations")
    async def internal_process_invitations():
        """Internal endpoint: process invitation queue (called by worker)."""
        count = await process_invitation_queue(db)
        return {"processed": count}