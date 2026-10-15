from email_delivery import email_configured
import hashlib
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


WAITLIST_ROLES = ("passenger", "driver", "fleet_owner")
WAITLIST_GLOBAL_LIMIT_PER_MINUTE = 120
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_PHONE_RE = re.compile(r"^[+\d ()-]{8,30}$")


class MarketingWaitlistRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=8, max_length=30)
    email: Optional[str] = Field(default="", max_length=254)
    city: str = Field(min_length=2, max_length=100)
    role: Literal["passenger", "driver", "fleet_owner"]
    # Honeypot. Real UI leaves this blank.
    website: Optional[str] = Field(default="", max_length=200)


def normalize_phone(value: str) -> str:
    value = (value or "").strip()
    if not _PHONE_RE.fullmatch(value):
        raise ValueError("invalid phone")
    has_plus = value.startswith("+")
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) < 8 or len(digits) > 20:
        raise ValueError("invalid phone")
    return ("+" if has_plus else "") + digits


def normalize_email(value: Optional[str]) -> str:
    email = (value or "").strip().lower()
    if email and not _EMAIL_RE.fullmatch(email):
        raise ValueError("invalid email")
    return email


def waitlist_identity(*, role: str, phone: str, email: str, city: str) -> str:
    normalized = "|".join([
        role.strip().lower(),
        phone,
        email,
        city.strip().casefold(),
    ])
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


async def ensure_marketing_waitlist_indexes(db) -> None:
    await db.beta_waitlist.create_index("identity_key", unique=True)
    await db.beta_waitlist.create_index([("status", 1), ("created_at", -1)])
    await db.waitlist_rate_limits.create_index("expires_at", expireAfterSeconds=0)


async def _consume_global_rate_limit(db, now: datetime) -> None:
    bucket = now.strftime("%Y%m%d%H%M")
    record = await db.waitlist_rate_limits.find_one_and_update(
        {"_id": f"marketing_waitlist:{bucket}"},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {
                "created_at": now,
                "expires_at": now + timedelta(minutes=10),
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if int((record or {}).get("count", 0)) > WAITLIST_GLOBAL_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail="For mange forespørsler akkurat nå. Prøv igjen om litt.")


def install_marketing_waitlist(api, db, confirmation=None, require_admin=None, audit=None) -> None:
    @api.post("/marketing/waitlist", status_code=201)
    async def create_marketing_waitlist_entry(body: MarketingWaitlistRequest):
        now = datetime.now(timezone.utc)

        # Bots commonly fill hidden website fields. Return the same generic success
        # shape without storing PII, so the honeypot does not reveal itself.
        if (body.website or "").strip():
            return {"ok": True, "status": "registered"}

        await _consume_global_rate_limit(db, now)

        try:
            phone = normalize_phone(body.phone)
            email = normalize_email(body.email)
        except ValueError:
            raise HTTPException(status_code=400, detail="Kontroller feltene og prøv igjen.")

        name = body.name.strip()
        city = body.city.strip()
        if len(name) < 2 or len(city) < 2:
            raise HTTPException(status_code=400, detail="Kontroller feltene og prøv igjen.")

        identity_key = waitlist_identity(
            role=body.role,
            phone=phone,
            email=email,
            city=city,
        )

        document = {
            "identity_key": identity_key,
            "name": name,
            "phone": phone,
            "email": email,
            "city": city,
            "role": body.role,
            "source": "snarapp.no",
            "status": "new",
            "consent_context": "beta_interest",
            "created_at": now,
        }

        try:
            await db.beta_waitlist.update_one(
                {"identity_key": identity_key},
                {
                    "$setOnInsert": document,
                    "$set": {"last_seen_at": now},
                    "$inc": {"submission_count": 1},
                },
                upsert=True,
            )
        except DuplicateKeyError:
            # A concurrent identical request may race on the unique index. Treat it
            # exactly like an idempotent retry and never create a second record.
            await db.beta_waitlist.update_one(
                {"identity_key": identity_key},
                {
                    "$set": {"last_seen_at": now},
                    "$inc": {"submission_count": 1},
                },
            )

        # Do not reveal whether this contact already existed.
        result = {"ok": True, "status": "registered"}
        if confirmation:
            result["confirmation_email_status"] = await confirmation(identity_key, email, name)
        return result

    if require_admin is None:
        return

    @api.get("/admin/beta-waitlist")
    async def list_beta_interest(
        role: Optional[Literal["passenger", "driver", "fleet_owner"]] = None,
        status: Optional[Literal["new", "contacted", "archived"]] = None,
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        current=Depends(require_admin),
    ):
        query = {}
        if role:
            query["role"] = role
        if status:
            query["status"] = status
        total = await db.beta_waitlist.count_documents(query)
        entries = []
        async for record in db.beta_waitlist.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit):
            record["id"] = record["identity_key"]
            entries.append(record)
        deliveries = {}
        ids = [f"beta:{record['id']}" for record in entries]
        async for job in db.onboarding_email_outbox.find({"_id": {"$in": ids}}, {"status": 1}):
            deliveries[str(job["_id"]).removeprefix("beta:")] = job.get("status", "pending")
        for record in entries:
            record["confirmation_email_status"] = deliveries.get(record["id"], "not_requested")
        return {"items": entries, "total": total, "limit": limit, "offset": offset,
                "email_configured": email_configured()}

    class InterestStatusRequest(BaseModel):
        status: Literal["new", "contacted", "archived"]

    @api.patch("/admin/beta-waitlist/{identity}")
    async def update_beta_interest(identity: str, body: InterestStatusRequest, current=Depends(require_admin)):
        if not re.fullmatch(r"[a-f0-9]{64}", identity):
            raise HTTPException(404, "Påmelding ikke funnet")
        previous = await db.beta_waitlist.find_one({"identity_key": identity}, {"status": 1})
        if not previous:
            raise HTTPException(404, "Påmelding ikke funnet")
        await db.beta_waitlist.update_one({"identity_key": identity}, {"$set": {
            "status": body.status, "reviewed_at": datetime.now(timezone.utc), "reviewed_by": current["id"],
        }})
        if audit:
            await audit(current, "beta_interest.status", "beta_interest", identity,
                        {"status": previous.get("status")}, {"status": body.status})
        return {"ok": True, "status": body.status}


