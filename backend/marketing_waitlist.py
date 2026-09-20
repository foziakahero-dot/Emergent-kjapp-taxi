import hashlib
import re
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional

from fastapi import HTTPException
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


def install_marketing_waitlist(api, db) -> None:
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
            "source": "kjappapp.no",
            "status": "new",
            "consent_context": "beta_interest",
            "created_at": now,
            "last_seen_at": now,
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
        return {"ok": True, "status": "registered"}
