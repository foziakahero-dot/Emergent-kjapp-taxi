"""
SNAR Beta Campaign Engine — Founding 500

Financially-backed campaign model for subsidized first rides.
- Max 500 qualified customers
- One subsidized first ride per customer
- Atomic reservation at booking, completion on settled trip
- Correct driver/fleet settlement (SNAR sponsors the discount)
- Admin controls with kill switch and audit logging
- Growth Fund tracking for campaign subsidy spend
"""
import hashlib
import logging
import math
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from promo_credits import platform_fee_ore, discount_for_trip, max_discount_for_trip


CAMPAIGN_ID = "founding-500-oslo"
CAMPAIGN_NAME = "Founding 500 Oslo Beta"
CAMPAIGN_STATUS_KEY = "campaign:founding-500-oslo:status"

# Feature flag environment variable
FEATURE_FLAG_ENV = "SNAR_BETA_CAMPAIGN_ENABLED"
DEFAULT_COST_CAP_KR = 300  # Max SNAR subsidy per ride (kr)
DEFAULT_TOTAL_BUDGET_KR = 150000  # Total campaign budget (kr)
MAX_CUSTOMERS = 500

# Growth Fund collection
GROWTH_FUND_COLLECTION = "growth_fund"


def _flag_enabled() -> bool:
    """Check if beta campaign feature flag is enabled."""
    return os.environ.get(FEATURE_FLAG_ENV, "false").lower() == "true"


class CampaignConfig(BaseModel):
    """Campaign configuration (admin-editable within bounds)."""
    campaign_id: str = Field(default=CAMPAIGN_ID)
    max_customers: int = Field(default=MAX_CUSTOMERS, ge=1, le=MAX_CUSTOMERS)
    cost_cap_kr: int = Field(default=DEFAULT_COST_CAP_KR, ge=1, le=1000)
    total_budget_kr: int = Field(default=DEFAULT_TOTAL_BUDGET_KR, ge=1, le=1000000)
    active: bool = False
    kill_switch: bool = False
    start_date: Optional[str] = None  # ISO date
    end_date: Optional[str] = None  # ISO date
    city_filter: Optional[str] = "Oslo"


class CampaignStatus(BaseModel):
    """Current campaign runtime status."""
    campaign_id: str
    name: str
    active: bool
    feature_flag: bool
    config: CampaignConfig
    enrolled_count: int
    redeemed_count: int
    total_spent_kr: int
    remaining_budget_kr: int
    remaining_slots: int
    kill_switch: bool
    updated_at: str
    # Growth Fund metrics
    growth_fund_total_spent_kr: int = 0
    growth_fund_ride_count: int = 0
    growth_fund_avg_subsidy_kr: float = 0.0


class CustomerEnrollment(BaseModel):
    """Customer enrolled in the beta campaign."""
    customer_id: str
    identity_key: str  # Links to beta_waitlist entry
    email: str
    phone: str
    city: str
    enrolled_at: str
    qualified: bool
    ride_redeemed: bool
    ride_redeemed_at: Optional[str] = None
    trip_id: Optional[str] = None
    discount_kr: Optional[int] = None


class EnrollmentRequest(BaseModel):
    """Admin request to enroll a waitlisted customer."""
    identity_key: str = Field(pattern=r"^[a-f0-9]{64}$")


class RedemptionAttempt(BaseModel):
    """Record of a redemption attempt (for audit/idempotency)."""
    attempt_id: str
    customer_id: str
    trip_id: Optional[str] = None
    status: Literal["reserved", "completed", "cancelled", "failed"]
    amount_kr: Optional[int] = None
    amount_ore: Optional[int] = None
    created_at: str
    completed_at: Optional[str] = None
    idempotency_key: Optional[str] = None


async def ensure_beta_campaign_indexes(db) -> None:
    """Create database indexes for beta campaign collections."""
    await db.beta_campaign_config.create_index("campaign_id", unique=True)
    await db.beta_campaign_enrollments.create_index("customer_id", unique=True)
    await db.beta_campaign_enrollments.create_index("identity_key")
    await db.beta_campaign_enrollments.create_index([("qualified", 1), ("ride_redeemed", 1)])
    await db.beta_campaign_redemptions.create_index("customer_id")
    await db.beta_campaign_redemptions.create_index("trip_id")
    await db.beta_campaign_redemptions.create_index("idempotency_key", unique=True, sparse=True)
    await db.beta_campaign_audit.create_index([("at", -1)])
    await db.beta_campaign_audit.create_index("entity_id")


async def _get_config(db) -> CampaignConfig:
    """Get current campaign configuration."""
    doc = await db.beta_campaign_config.find_one({"campaign_id": CAMPAIGN_ID})
    if doc:
        return CampaignConfig(**{k: v for k, v in doc.items() if k != "_id"})
    return CampaignConfig()


async def _save_config(db, config: CampaignConfig) -> None:
    """Save campaign configuration."""
    await db.beta_campaign_config.update_one(
        {"campaign_id": CAMPAIGN_ID},
        {"$set": config.model_dump()},
        upsert=True,
    )
    # Also update the kill_switch in the main config doc
    if hasattr(config, 'kill_switch'):
        await db.beta_campaign_config.update_one(
            {"campaign_id": CAMPAIGN_ID},
            {"$set": {"kill_switch": config.kill_switch}},
            upsert=True,
        )


async def _get_kill_switch(db) -> bool:
    """Check if campaign kill switch is active."""
    doc = await db.beta_campaign_config.find_one({"campaign_id": CAMPAIGN_ID})
    return bool(doc and doc.get("kill_switch", False))


async def _set_kill_switch(db, value: bool) -> None:
    """Set campaign kill switch."""
    await db.beta_campaign_config.update_one(
        {"campaign_id": CAMPAIGN_ID},
        {"$set": {"campaign_id": CAMPAIGN_ID, "kill_switch": value}},
        upsert=True,
    )


async def _audit(db, admin_id: str, action: str, entity_type: str, entity_id: str,
                 before: Optional[dict] = None, after: Optional[dict] = None,
                 reason: Optional[str] = None) -> None:
    """Write audit log entry."""
    await db.beta_campaign_audit.insert_one({
        "admin_id": admin_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "before": before,
        "after": after,
        "reason": reason,
        "at": datetime.now(timezone.utc).isoformat(),
    })


async def _get_enrolled_count(db) -> int:
    """Get count of qualified enrolled customers."""
    return await db.beta_campaign_enrollments.count_documents({"qualified": True})


async def _get_redeemed_count(db) -> int:
    """Get count of redeemed rides."""
    return await db.beta_campaign_redemptions.count_documents({"status": "completed"})


async def _get_total_spent(db) -> int:
    """Get total spent in øre."""
    total = 0
    async for doc in db.beta_campaign_redemptions.find(
        {"status": "completed"}, {"amount_ore": 1}
    ):
        total += int(doc.get("amount_ore", 0))
    return total


async def _get_growth_fund_balance(db) -> int:
    """Get current Growth Fund balance in øre (total SNAR subsidy spent)."""
    doc = await db[GROWTH_FUND_COLLECTION].find_one({"fund_id": "founding-500-oslo"})
    if doc:
        return int(doc.get("total_spent_ore", 0))
    return 0


async def _increment_growth_fund(db, amount_ore: int, trip_id: str, customer_id: str) -> None:
    """Increment Growth Fund balance with new subsidy spend."""
    now = datetime.now(timezone.utc)
    await db[GROWTH_FUND_COLLECTION].update_one(
        {"fund_id": "founding-500-oslo"},
        {
            "$inc": {"total_spent_ore": amount_ore, "ride_count": 1},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"fund_id": "founding-500-oslo", "created_at": now.isoformat()},
            "$push": {
                "spend_log": {
                    "trip_id": trip_id,
                    "customer_id": customer_id,
                    "amount_ore": amount_ore,
                    "at": now.isoformat(),
                }
            },
        },
        upsert=True,
    )


async def _get_growth_fund_summary(db) -> dict:
    """Get Growth Fund summary for admin dashboard."""
    doc = await db[GROWTH_FUND_COLLECTION].find_one({"fund_id": "founding-500-oslo"})
    if not doc:
        return {
            "total_spent_kr": 0,
            "ride_count": 0,
            "average_subsidy_kr": 0,
            "spend_log": [],
        }
    total_spent = int(doc.get("total_spent_ore", 0))
    ride_count = int(doc.get("ride_count", 0))
    return {
        "total_spent_kr": total_spent // 100,
        "ride_count": ride_count,
        "average_subsidy_kr": round(total_spent / 100 / max(1, ride_count), 2),
        "spend_log": doc.get("spend_log", [])[-50:],  # Last 50 entries
    }


async def _check_budget(db, config: CampaignConfig, additional_ore: int = 0) -> tuple[bool, str]:
    """Check if campaign budget allows additional spend. Returns (allowed, reason)."""
    if not _flag_enabled():
        return False, "Campaign feature flag disabled"

    if await _get_kill_switch(db):
        return False, "Campaign kill switch active"

    current_spent = await _get_total_spent(db)
    projected_spent = current_spent + additional_ore

    if projected_spent >= config.total_budget_kr * 100:
        return False, f"Total budget exceeded (spent: {current_spent/100:.0f}kr, limit: {config.total_budget_kr}kr)"

    enrolled = await _get_enrolled_count(db)
    if enrolled >= config.max_customers:
        return False, f"Max customers ({config.max_customers}) reached"

    return True, "OK"


def _generate_idempotency_key(customer_id: str, trip_id: Optional[str] = None) -> str:
    """Generate idempotency key for redemption attempt."""
    base = f"{customer_id}:{trip_id or 'booking'}:{datetime.now(timezone.utc).isoformat()}"
    return hashlib.sha256(base.encode()).hexdigest()[:32]


async def _create_redemption_attempt(
    db,
    customer_id: str,
    trip_id: Optional[str] = None,
    status: Literal["reserved", "completed", "cancelled", "failed"] = "reserved",
    amount_kr: Optional[int] = None,
    idempotency_key: Optional[str] = None,
) -> RedemptionAttempt:
    """Create a redemption attempt record."""
    now = datetime.now(timezone.utc)
    amount_ore = amount_kr * 100 if amount_kr is not None else None
    attempt = RedemptionAttempt(
        attempt_id=hashlib.sha256(f"{customer_id}:{now.isoformat()}".encode()).hexdigest()[:24],
        customer_id=customer_id,
        trip_id=trip_id,
        status=status,
        amount_kr=amount_kr,
        amount_ore=amount_ore,
        created_at=now.isoformat(),
        completed_at=now.isoformat() if status in ("completed", "cancelled", "failed") else None,
        idempotency_key=idempotency_key,
    )
    await db.beta_campaign_redemptions.insert_one(attempt.model_dump())
    return attempt


async def _update_redemption_attempt(
    db,
    attempt_id: str,
    status: Literal["reserved", "completed", "cancelled", "failed"],
    trip_id: Optional[str] = None,
    amount_kr: Optional[int] = None,
) -> None:
    """Update redemption attempt status."""
    now = datetime.now(timezone.utc)
    update = {"status": status, "completed_at": now.isoformat()}
    if trip_id:
        update["trip_id"] = trip_id
    if amount_kr is not None:
        update["amount_kr"] = amount_kr
        update["amount_ore"] = amount_kr * 100
    await db.beta_campaign_redemptions.update_one(
        {"attempt_id": attempt_id},
        {"$set": update},
    )


async def qualify_customer(db, customer_id: str, identity_key: str) -> CustomerEnrollment:
    """
    Qualify a waitlisted customer for the beta campaign.
    Called by admin after verifying waitlist entry.
    """
    if not _flag_enabled():
        raise HTTPException(503, "Beta campaign not enabled")

    # Find waitlist entry
    waitlist_entry = await db.beta_waitlist.find_one({"identity_key": identity_key})
    if not waitlist_entry:
        raise HTTPException(404, "Waitlist entry not found")

    if waitlist_entry.get("role") != "passenger":
        raise HTTPException(400, "Only passenger waitlist entries can be enrolled")

    if waitlist_entry.get("status") not in ("new", "contacted"):
        raise HTTPException(400, "Waitlist entry must be new or contacted")

    # Check if already enrolled
    existing = await db.beta_campaign_enrollments.find_one({"customer_id": customer_id})
    if existing:
        return CustomerEnrollment(**{k: v for k, v in existing.items() if k != "_id"})

    config = await _get_config(db)
    enrolled = await _get_enrolled_count(db)

    if enrolled >= config.max_customers:
        raise HTTPException(409, f"Campaign full (max {config.max_customers} customers)")

    # Create enrollment
    now = datetime.now(timezone.utc)
    enrollment = CustomerEnrollment(
        customer_id=customer_id,
        identity_key=identity_key,
        email=waitlist_entry.get("email", ""),
        phone=waitlist_entry.get("phone", ""),
        city=waitlist_entry.get("city", ""),
        enrolled_at=now.isoformat(),
        qualified=True,
        ride_redeemed=False,
    )

    try:
        await db.beta_campaign_enrollments.insert_one(enrollment.model_dump())
    except DuplicateKeyError:
        # Race condition - fetch existing
        existing = await db.beta_campaign_enrollments.find_one({"customer_id": customer_id})
        return CustomerEnrollment(**{k: v for k, v in existing.items() if k != "_id"})

    # Update waitlist status
    await db.beta_waitlist.update_one(
        {"identity_key": identity_key},
        {"$set": {"status": "contacted", "campaign_enrolled_at": now.isoformat()}},
    )

    return enrollment


async def reserve_campaign_ride(db, customer_id: str, trip_id: str, estimated_price_kr: int,
                                 commission_rate: float) -> tuple[bool, int, str]:
    """
    Reserve a campaign ride for a customer at booking time.
    Returns (allowed, discount_kr, attempt_id).
    """
    if not _flag_enabled():
        return False, 0, ""

    if await _get_kill_switch(db):
        return False, 0, ""

    enrollment = await db.beta_campaign_enrollments.find_one({"customer_id": customer_id})
    if not enrollment:
        return False, 0, ""

    if not enrollment.get("qualified", False):
        return False, 0, ""

    if enrollment.get("ride_redeemed", False):
        return False, 0, ""

    config = await _get_config(db)
    allowed, reason = await _check_budget(db, config, config.cost_cap_kr * 100)
    if not allowed:
        return False, 0, ""

    # Calculate max discount for this trip (SNAR absorbs cost)
    max_discount = max_discount_for_trip(estimated_price_kr * 100, commission_rate)
    discount_kr = min(config.cost_cap_kr, max(1, max_discount // 100))

    if discount_kr <= 0:
        return False, 0, ""

    # Check idempotency - has this customer already reserved for this trip?
    existing = await db.beta_campaign_redemptions.find_one({
        "customer_id": customer_id,
        "trip_id": trip_id,
        "status": {"$in": ["reserved", "completed"]},
    })
    if existing:
        return True, existing.get("amount_kr", discount_kr), existing["attempt_id"]

    # Create reservation
    idempotency_key = _generate_idempotency_key(customer_id, trip_id)
    attempt = await _create_redemption_attempt(
        db, customer_id, trip_id, "reserved", discount_kr, idempotency_key
    )

    return True, discount_kr, attempt.attempt_id


async def complete_campaign_ride(db, customer_id: str, trip_id: str, actual_price_kr: int,
                                  commission_rate: float) -> tuple[bool, int, int]:
    """
    Complete a campaign ride after trip settlement.
    Returns (success, discount_kr, platform_fee_ore).
    """
    if not _flag_enabled():
        return False, 0, 0

    enrollment = await db.beta_campaign_enrollments.find_one({"customer_id": customer_id})
    if not enrollment:
        return False, 0, 0

    # Find the reserved attempt
    attempt = await db.beta_campaign_redemptions.find_one({
        "customer_id": customer_id,
        "trip_id": trip_id,
        "status": "reserved",
    })
    if not attempt:
        return False, 0, 0

    reserved_discount_kr = attempt.get("amount_kr", 0)

    # Recalculate discount based on actual price (capped at reserved amount)
    max_discount = max_discount_for_trip(actual_price_kr * 100, commission_rate)
    discount_kr = min(reserved_discount_kr, max(1, max_discount // 100))

    if discount_kr <= 0:
        await _update_redemption_attempt(db, attempt["attempt_id"], "failed")
        return False, 0, 0

    config = await _get_config(db)
    allowed, reason = await _check_budget(db, config, discount_kr * 100)
    if not allowed:
        await _update_redemption_attempt(db, attempt["attempt_id"], "failed")
        return False, 0, 0

    # Calculate platform fee after discount (SNAR absorbs the discount)
    charged_ore = max(1, (actual_price_kr - discount_kr) * 100)  # Min 1kr customer charge
    discount_ore = discount_kr * 100
    fee_ore = platform_fee_ore(charged_ore, discount_ore, commission_rate)

    # Update enrollment
    now = datetime.now(timezone.utc)
    await db.beta_campaign_enrollments.update_one(
        {"customer_id": customer_id},
        {"$set": {
            "ride_redeemed": True,
            "ride_redeemed_at": now.isoformat(),
            "trip_id": trip_id,
            "discount_kr": discount_kr,
        }},
    )

    # Update redemption attempt
    await _update_redemption_attempt(
        db, attempt["attempt_id"], "completed", trip_id, discount_kr
    )

    # Increment Growth Fund (SNAR's subsidy spend)
    await _increment_growth_fund(db, discount_ore, trip_id, customer_id)

    return True, discount_kr, fee_ore


async def cancel_campaign_reservation(db, customer_id: str, trip_id: str) -> bool:
    """
    Cancel a campaign reservation (e.g., trip cancelled before completion).
    Returns the campaign right to the customer.
    """
    if not _flag_enabled():
        return False

    result = await db.beta_campaign_redemptions.update_one(
        {"customer_id": customer_id, "trip_id": trip_id, "status": "reserved"},
        {"$set": {"status": "cancelled", "completed_at": datetime.now(timezone.utc).isoformat()}},
    )

    if result.modified_count:
        # Customer keeps their campaign eligibility
        await db.beta_campaign_enrollments.update_one(
            {"customer_id": customer_id},
            {"$set": {"trip_id": None}},
        )
        return True

    return False


def install_beta_campaign(api, db, require_admin, audit) -> None:
    """Install beta campaign endpoints."""

    @api.post("/admin/beta-campaign/enroll", status_code=201)
    async def enroll_customer(body: EnrollmentRequest, current=Depends(require_admin)):
        """Enroll a waitlisted customer into the beta campaign."""
        if not _flag_enabled():
            raise HTTPException(503, "Beta campaign feature flag disabled")

        # Verify waitlist entry exists
        waitlist_entry = await db.beta_waitlist.find_one({"identity_key": body.identity_key})
        if not waitlist_entry:
            raise HTTPException(404, "Waitlist entry not found")

        # Find or create customer user
        customer = await db.users.find_one({"email": waitlist_entry["email"], "role": "user"})
        if not customer:
            raise HTTPException(404, "Customer user not found for this waitlist entry")

        enrollment = await qualify_customer(db, str(customer["_id"]), body.identity_key)

        await _audit(db, current["id"], "campaign.enroll", "customer", str(customer["_id"]),
                     None, enrollment.model_dump(), "Admin enrolled customer in beta campaign")

        return {"ok": True, "enrollment": enrollment.model_dump()}

    @api.get("/admin/beta-campaign/status")
    async def get_campaign_status(current=Depends(require_admin)):
        """Get current campaign status and metrics."""
        config = await _get_config(db)
        enrolled = await _get_enrolled_count(db)
        redeemed = await _get_redeemed_count(db)
        total_spent_ore = await _get_total_spent(db)

        # Growth Fund metrics
        gf = await _get_growth_fund_summary(db)

        return CampaignStatus(
            campaign_id=CAMPAIGN_ID,
            name=CAMPAIGN_NAME,
            active=config.active and _flag_enabled() and not await _get_kill_switch(db),
            feature_flag=_flag_enabled(),
            config=config,
            enrolled_count=enrolled,
            redeemed_count=redeemed,
            total_spent_kr=total_spent_ore // 100,
            remaining_budget_kr=max(0, config.total_budget_kr - total_spent_ore // 100),
            remaining_slots=max(0, config.max_customers - enrolled),
            kill_switch=await _get_kill_switch(db),
            updated_at=datetime.now(timezone.utc).isoformat(),
            growth_fund_total_spent_kr=gf["total_spent_kr"],
            growth_fund_ride_count=gf["ride_count"],
            growth_fund_avg_subsidy_kr=gf["average_subsidy_kr"],
        )

    @api.get("/admin/beta-campaign/participants")
    async def list_participants(
        qualified_only: bool = Query(default=False),
        redeemed_only: bool = Query(default=False),
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        current=Depends(require_admin),
    ):
        """List campaign participants."""
        query = {}
        if qualified_only:
            query["qualified"] = True
        if redeemed_only:
            query["ride_redeemed"] = True

        total = await db.beta_campaign_enrollments.count_documents(query)
        entries = []
        async for doc in db.beta_campaign_enrollments.find(query, {"_id": 0}).sort("enrolled_at", -1).skip(offset).limit(limit):
            entries.append(CustomerEnrollment(**doc))

        return {"items": [e.model_dump() for e in entries], "total": total, "limit": limit, "offset": offset}

    @api.get("/admin/beta-campaign/redemptions")
    async def list_redemptions(
        status: Optional[str] = Query(default=None),
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        current=Depends(require_admin),
    ):
        """List redemption attempts."""
        query = {}
        if status:
            query["status"] = status

        total = await db.beta_campaign_redemptions.count_documents(query)
        entries = []
        async for doc in db.beta_campaign_redemptions.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit):
            entries.append(RedemptionAttempt(**doc))

        return {"items": [e.model_dump() for e in entries], "total": total, "limit": limit, "offset": offset}

    @api.patch("/admin/beta-campaign/config")
    async def update_config(config: CampaignConfig, current=Depends(require_admin)):
        """Update campaign configuration."""
        old = await _get_config(db)
        await _save_config(db, config)
        await _audit(db, current["id"], "campaign.config_update", "campaign", CAMPAIGN_ID,
                     old.model_dump(), config.model_dump(), "Admin updated campaign config")
        return {"ok": True, "config": config.model_dump()}

    @api.post("/admin/beta-campaign/kill-switch")
    async def set_kill_switch(enabled: bool, current=Depends(require_admin)):
        """Emergency kill switch for the campaign."""
        await _set_kill_switch(db, enabled)
        await _audit(db, current["id"], "campaign.kill_switch", "campaign", CAMPAIGN_ID,
                     {"kill_switch": not enabled}, {"kill_switch": enabled},
                     "Admin toggled campaign kill switch")
        return {"ok": True, "kill_switch": enabled}

    @api.post("/admin/beta-campaign/activate")
    async def activate_campaign(current=Depends(require_admin)):
        """Activate the campaign (requires feature flag)."""
        if not _flag_enabled():
            raise HTTPException(503, "Feature flag not enabled. Set SNAR_BETA_CAMPAIGN_ENABLED=true")
        config = await _get_config(db)
        if config.active:
            return {"ok": True, "message": "Already active"}
        config.active = True
        await _save_config(db, config)
        await _audit(db, current["id"], "campaign.activate", "campaign", CAMPAIGN_ID,
                     {"active": False}, {"active": True}, "Admin activated campaign")
        return {"ok": True, "config": config.model_dump()}

    @api.post("/admin/beta-campaign/deactivate")
    async def deactivate_campaign(current=Depends(require_admin)):
        """Deactivate the campaign."""
        config = await _get_config(db)
        config.active = False
        await _save_config(db, config)
        await _audit(db, current["id"], "campaign.deactivate", "campaign", CAMPAIGN_ID,
                     {"active": True}, {"active": False}, "Admin deactivated campaign")
        return {"ok": True, "config": config.model_dump()}

    # Internal endpoints for ride_reservations integration
    @api.post("/internal/beta-campaign/reserve")
    async def internal_reserve(customer_id: str, trip_id: str, estimated_price_kr: int, commission_rate: float):
        """Internal endpoint: reserve campaign ride at booking."""
        allowed, discount_kr, attempt_id = await reserve_campaign_ride(
            db, customer_id, trip_id, estimated_price_kr, commission_rate
        )
        return {"allowed": allowed, "discount_kr": discount_kr, "attempt_id": attempt_id}

    @api.post("/internal/beta-campaign/complete")
    async def internal_complete(customer_id: str, trip_id: str, actual_price_kr: int, commission_rate: float):
        """Internal endpoint: complete campaign ride after settlement."""
        success, discount_kr, fee_ore = await complete_campaign_ride(
            db, customer_id, trip_id, actual_price_kr, commission_rate
        )
        return {"success": success, "discount_kr": discount_kr, "platform_fee_ore": fee_ore}

    @api.post("/internal/beta-campaign/cancel")
    async def internal_cancel(customer_id: str, trip_id: str):
        """Internal endpoint: cancel campaign reservation."""
        success = await cancel_campaign_reservation(db, customer_id, trip_id)
        return {"success": success}


# Helper functions for ride_reservations integration
async def get_campaign_discount(db, customer_id: str, trip_id: str, price_kr: int, commission_rate: float) -> int:
    """
    Get campaign discount for a trip (used during booking authorization).
    Returns discount in kr (0 if not eligible).
    """
    if not _flag_enabled():
        return 0

    enrollment = await db.beta_campaign_enrollments.find_one({"customer_id": customer_id})
    if not enrollment or not enrollment.get("qualified") or enrollment.get("ride_redeemed"):
        return 0

    config = await _get_config(db)
    allowed, _ = await _check_budget(db, config)
    if not allowed:
        return 0

    max_discount = max_discount_for_trip(price_kr * 100, commission_rate)
    return min(config.cost_cap_kr, max(1, max_discount // 100))


async def apply_campaign_discount_to_settlement(db, customer_id: str, trip_id: str, price_kr: int, commission_rate: float) -> tuple[int, int]:
    """
    Apply campaign discount to trip settlement.
    Returns (discount_kr, platform_fee_ore).
    """
    if not _flag_enabled():
        return 0, 0

    success, discount_kr, fee_ore = await complete_campaign_ride(db, customer_id, trip_id, price_kr, commission_rate)
    if success:
        return discount_kr, fee_ore
    return 0, 0