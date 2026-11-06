"""Tests for beta_campaign module."""
import asyncio
import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId

from beta_campaign import (
    CampaignConfig,
    CampaignStatus,
    CustomerEnrollment,
    RedemptionAttempt,
    ensure_beta_campaign_indexes,
    qualify_customer,
    reserve_campaign_ride,
    complete_campaign_ride,
    cancel_campaign_reservation,
    get_campaign_discount,
    apply_campaign_discount_to_settlement,
    _flag_enabled,
    _check_budget,
    _get_config,
    _save_config,
    _get_kill_switch,
    _set_kill_switch,
    CAMPAIGN_ID,
    MAX_CUSTOMERS,
    DEFAULT_COST_CAP_KR,
    DEFAULT_TOTAL_BUDGET_KR,
    FEATURE_FLAG_ENV,
)


class FakeCollection:
    """Simple in-memory MongoDB-like collection for testing."""
    def __init__(self):
        self.docs = {}
        self.indexes = []

    async def create_index(self, *args, **kwargs):
        self.indexes.append((args, kwargs))

    async def find_one(self, query, projection=None):
        for doc in self.docs.values():
            if self._match(doc, query):
                if projection:
                    return {k: v for k, v in doc.items() if k in projection or projection.get(k, 0) == 1}
                return doc
        return None

    async def find(self, query=None, projection=None, sort=None, skip=0, limit=0):
        query = query or {}
        results = [doc for doc in self.docs.values() if self._match(doc, query)]
        if sort:
            # Simple sort - not full implementation
            pass
        if skip:
            results = results[skip:]
        if limit:
            results = results[:limit]
        if projection:
            results = [{k: v for k, v in doc.items() if k in projection or projection.get(k, 0) == 1} for doc in results]
        for doc in results:
            yield doc

    async def count_documents(self, query):
        return sum(1 for doc in self.docs.values() if self._match(doc, query))

    async def insert_one(self, doc):
        key = doc.get("customer_id") or doc.get("identity_key") or doc.get("attempt_id") or doc.get("campaign_id") or str(ObjectId())
        if key in self.docs:
            from pymongo.errors import DuplicateKeyError
            raise DuplicateKeyError("duplicate key")
        self.docs[key] = doc
        return MagicMock(inserted_id=key)

    async def update_one(self, query, update, upsert=False):
        matched = 0
        for key, doc in self.docs.items():
            if self._match(doc, query):
                if "$set" in update:
                    doc.update(update["$set"])
                if "$setOnInsert" in update:
                    for k, v in update["$setOnInsert"].items():
                        if k not in doc:
                            doc[k] = v
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        doc[k] = doc.get(k, 0) + v
                matched += 1
                break
        if matched == 0 and upsert:
            new_doc = {}
            if "$setOnInsert" in update:
                new_doc.update(update["$setOnInsert"])
            if "$set" in update:
                new_doc.update(update["$set"])
            key = new_doc.get("customer_id") or new_doc.get("identity_key") or new_doc.get("attempt_id") or new_doc.get("campaign_id") or str(ObjectId())
            self.docs[key] = new_doc
            return MagicMock(matched_count=0, modified_count=0, upserted_id=key)
        return MagicMock(matched_count=matched, modified_count=matched)

    def _match(self, doc, query):
        for k, v in query.items():
            if k == "_id":
                continue
            if isinstance(v, dict):
                # Handle operators like $in, $ne, etc.
                for op, op_val in v.items():
                    if op == "$in":
                        if doc.get(k) not in op_val:
                            return False
                    elif op == "$ne":
                        if doc.get(k) == op_val:
                            return False
                    elif op == "$type":
                        # Simplified type check
                        pass
            elif doc.get(k) != v:
                return False
        return True


class FakeDB:
    """Fake database with collections."""
    def __init__(self):
        self.beta_waitlist = FakeCollection()
        self.beta_campaign_config = FakeCollection()
        self.beta_campaign_enrollments = FakeCollection()
        self.beta_campaign_redemptions = FakeCollection()
        self.beta_campaign_audit = FakeCollection()
        self.growth_fund = FakeCollection()
        self.onboarding_email_outbox = FakeCollection()
        self.users = FakeCollection()
        self.trips = FakeCollection()
        self.payment_transactions = FakeCollection()

    def __getitem__(self, key):
        """Support subscript access for collections."""
        if hasattr(self, key):
            return getattr(self, key)
        # Create dynamic collection if not exists
        if not hasattr(self, f"_{key}"):
            setattr(self, f"_{key}", FakeCollection())
        return getattr(self, f"_{key}")


@pytest.fixture
def db():
    return FakeDB()


@pytest.fixture(autouse=True)
def enable_flag():
    """Enable feature flag for tests."""
    os.environ[FEATURE_FLAG_ENV] = "true"
    yield
    os.environ[FEATURE_FLAG_ENV] = "false"


class TestFlagEnabled:
    def test_flag_disabled_by_default(self):
        os.environ[FEATURE_FLAG_ENV] = "false"
        assert _flag_enabled() is False

    def test_flag_enabled(self):
        os.environ[FEATURE_FLAG_ENV] = "true"
        assert _flag_enabled() is True

    def test_flag_case_insensitive(self):
        os.environ[FEATURE_FLAG_ENV] = "TRUE"
        assert _flag_enabled() is True


class TestCampaignConfig:
    def test_default_config(self):
        config = CampaignConfig()
        assert config.max_customers == MAX_CUSTOMERS
        assert config.cost_cap_kr == DEFAULT_COST_CAP_KR
        assert config.total_budget_kr == DEFAULT_TOTAL_BUDGET_KR
        assert config.active is False
        assert config.city_filter == "Oslo"

    def test_config_validation_max_customers(self):
        with pytest.raises(Exception):
            CampaignConfig(max_customers=MAX_CUSTOMERS + 1)
        with pytest.raises(Exception):
            CampaignConfig(max_customers=0)

    def test_config_validation_cost_cap(self):
        with pytest.raises(Exception):
            CampaignConfig(cost_cap_kr=0)
        with pytest.raises(Exception):
            CampaignConfig(cost_cap_kr=1001)

    def test_config_validation_budget(self):
        with pytest.raises(Exception):
            CampaignConfig(total_budget_kr=0)
        with pytest.raises(Exception):
            CampaignConfig(total_budget_kr=1000001)


class TestGetConfig:
    @pytest.mark.asyncio
    async def test_get_config_default(self, db):
        config = await _get_config(db)
        assert config.max_customers == MAX_CUSTOMERS
        assert config.cost_cap_kr == DEFAULT_COST_CAP_KR

    @pytest.mark.asyncio
    async def test_get_config_from_db(self, db):
        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 100,
            "cost_cap_kr": 200,
            "total_budget_kr": 50000,
            "active": True,
        })
        config = await _get_config(db)
        assert config.max_customers == 100
        assert config.cost_cap_kr == 200
        assert config.active is True


class TestSaveConfig:
    @pytest.mark.asyncio
    async def test_save_config(self, db):
        config = CampaignConfig(max_customers=100, cost_cap_kr=200, active=True)
        await _save_config(db, config)

        doc = await db.beta_campaign_config.find_one({"campaign_id": CAMPAIGN_ID})
        assert doc["max_customers"] == 100
        assert doc["cost_cap_kr"] == 200
        assert doc["active"] is True


class TestKillSwitch:
    @pytest.mark.asyncio
    async def test_kill_switch_default_off(self, db):
        assert await _get_kill_switch(db) is False

    @pytest.mark.asyncio
    async def test_set_kill_switch(self, db):
        await _set_kill_switch(db, True)
        assert await _get_kill_switch(db) is True
        await _set_kill_switch(db, False)
        assert await _get_kill_switch(db) is False


class TestQualifyCustomer:
    @pytest.mark.asyncio
    async def test_qualify_customer_success(self, db, enable_flag):
        # Setup waitlist entry
        identity_key = "a" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "email": "test@example.com",
            "phone": "+4712345678",
            "city": "Oslo",
            "role": "passenger",
            "status": "new",
        })

        # Setup customer user
        customer_id = str(ObjectId())
        await db.users.insert_one({
            "_id": ObjectId(customer_id),
            "email": "test@example.com",
            "role": "user",
        })

        enrollment = await qualify_customer(db, customer_id, identity_key)

        assert enrollment.customer_id == customer_id
        assert enrollment.identity_key == identity_key
        assert enrollment.qualified is True
        assert enrollment.ride_redeemed is False

        # Check waitlist updated
        waitlist = await db.beta_waitlist.find_one({"identity_key": identity_key})
        assert waitlist["status"] == "contacted"

    @pytest.mark.asyncio
    async def test_qualify_customer_flag_disabled(self, db):
        os.environ[FEATURE_FLAG_ENV] = "false"
        try:
            with pytest.raises(Exception) as exc:
                await qualify_customer(db, "cust1", "a" * 64)
            assert "feature flag" in str(exc.value).lower() or "503" in str(exc.value)
        finally:
            os.environ[FEATURE_FLAG_ENV] = "true"

    @pytest.mark.asyncio
    async def test_qualify_customer_waitlist_not_found(self, db, enable_flag):
        with pytest.raises(Exception) as exc:
            await qualify_customer(db, "cust1", "b" * 64)
        assert "404" in str(exc.value) or "not found" in str(exc.value).lower()

    @pytest.mark.asyncio
    async def test_qualify_customer_wrong_role(self, db, enable_flag):
        identity_key = "c" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "email": "test@example.com",
            "phone": "+4712345678",
            "city": "Oslo",
            "role": "driver",  # Wrong role
            "status": "new",
        })

        customer_id = str(ObjectId())
        await db.users.insert_one({
            "_id": ObjectId(customer_id),
            "email": "test@example.com",
            "role": "user",
        })

        with pytest.raises(Exception) as exc:
            await qualify_customer(db, customer_id, identity_key)
        assert "400" in str(exc.value) or "passenger" in str(exc.value).lower()

    @pytest.mark.asyncio
    async def test_qualify_customer_max_reached(self, db, enable_flag):
        # Fill up to max
        config = CampaignConfig(max_customers=2)
        await _save_config(db, config)

        for i in range(2):
            identity_key = f"{i:064x}"
            await db.beta_waitlist.insert_one({
                "identity_key": identity_key,
                "email": f"test{i}@example.com",
                "phone": f"+471234567{i}",
                "city": "Oslo",
                "role": "passenger",
                "status": "new",
            })
            customer_id = str(ObjectId())
            await db.users.insert_one({
                "_id": ObjectId(customer_id),
                "email": f"test{i}@example.com",
                "role": "user",
            })
            await qualify_customer(db, customer_id, identity_key)

        # Third should fail
        identity_key = "3" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "email": "test3@example.com",
            "phone": "+4712345673",
            "city": "Oslo",
            "role": "passenger",
            "status": "new",
        })
        customer_id = str(ObjectId())
        await db.users.insert_one({
            "_id": ObjectId(customer_id),
            "email": "test3@example.com",
            "role": "user",
        })

        with pytest.raises(Exception) as exc:
            await qualify_customer(db, customer_id, identity_key)
        assert "409" in str(exc.value) or "full" in str(exc.value).lower()

    @pytest.mark.asyncio
    async def test_qualify_customer_idempotent(self, db, enable_flag):
        identity_key = "d" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "email": "test@example.com",
            "phone": "+4712345678",
            "city": "Oslo",
            "role": "passenger",
            "status": "new",
        })
        customer_id = str(ObjectId())
        await db.users.insert_one({
            "_id": ObjectId(customer_id),
            "email": "test@example.com",
            "role": "user",
        })

        enrollment1 = await qualify_customer(db, customer_id, identity_key)
        enrollment2 = await qualify_customer(db, customer_id, identity_key)

        assert enrollment1.customer_id == enrollment2.customer_id
        assert len(db.beta_campaign_enrollments.docs) == 1


class TestReserveCampaignRide:
    @pytest.mark.asyncio
    async def test_reserve_campaign_ride_success(self, db, enable_flag):
        # Setup qualified customer
        customer_id = "cust1"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": False,
        })

        # Config allows it
        config = CampaignConfig(max_customers=500, cost_cap_kr=300, total_budget_kr=150000)
        await _save_config(db, config)

        allowed, discount_kr, attempt_id = await reserve_campaign_ride(
            db, customer_id, "trip1", 250, 0.15  # price 250kr, 15% commission
        )

        assert allowed is True
        assert discount_kr > 0
        assert discount_kr <= 300  # cost cap
        assert attempt_id != ""

        # Check redemption attempt created
        attempt = await db.beta_campaign_redemptions.find_one({"attempt_id": attempt_id})
        assert attempt is not None
        assert attempt["status"] == "reserved"
        assert attempt["amount_kr"] == discount_kr

    @pytest.mark.asyncio
    async def test_reserve_campaign_ride_not_qualified(self, db, enable_flag):
        customer_id = "cust2"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": False,
            "ride_redeemed": False,
        })

        allowed, discount_kr, attempt_id = await reserve_campaign_ride(
            db, customer_id, "trip1", 250, 0.15
        )

        assert allowed is False
        assert discount_kr == 0

    @pytest.mark.asyncio
    async def test_reserve_campaign_ride_already_redeemed(self, db, enable_flag):
        customer_id = "cust3"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": True,
        })

        allowed, discount_kr, attempt_id = await reserve_campaign_ride(
            db, customer_id, "trip1", 250, 0.15
        )

        assert allowed is False
        assert discount_kr == 0

    @pytest.mark.asyncio
    async def test_reserve_campaign_ride_idempotent(self, db, enable_flag):
        customer_id = "cust4"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": False,
        })

        allowed1, discount1, attempt_id1 = await reserve_campaign_ride(
            db, customer_id, "trip1", 250, 0.15
        )
        allowed2, discount2, attempt_id2 = await reserve_campaign_ride(
            db, customer_id, "trip1", 250, 0.15
        )

        assert allowed1 == allowed2 == True
        assert discount1 == discount2
        assert attempt_id1 == attempt_id2

    @pytest.mark.asyncio
    async def test_reserve_campaign_ride_budget_exceeded(self, db, enable_flag):
        customer_id = "cust5"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": False,
        })

        # Set small cost cap and budget to control discount amount
        config = CampaignConfig(max_customers=500, cost_cap_kr=50, total_budget_kr=60)  # 50kr cap, 60kr budget
        await _save_config(db, config)

        # First reservation
        allowed1, discount1, attempt_id1 = await reserve_campaign_ride(
            db, customer_id, "trip1", 250, 0.15
        )
        assert allowed1 is True
        assert discount1 > 0

        # Second reservation
        customer_id2 = "cust6"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id2,
            "qualified": True,
            "ride_redeemed": False,
        })

        allowed2, discount2, attempt_id2 = await reserve_campaign_ride(
            db, customer_id2, "trip2", 250, 0.15
        )
        assert allowed2 is True

        # Complete first ride - consumes budget
        success1, final_discount1, _ = await complete_campaign_ride(db, customer_id, "trip1", 250, 0.15)
        assert success1 is True
        assert final_discount1 == discount1

        # Complete second ride - should fail due to budget exceeded
        success2, _, _ = await complete_campaign_ride(db, customer_id2, "trip2", 250, 0.15)
        assert success2 is False, f"Expected failure but got success with discount {discount2}, budget was {config.total_budget_kr}kr, first discount was {final_discount1}kr"


class TestCompleteCampaignRide:
    @pytest.mark.asyncio
    async def test_complete_campaign_ride_success(self, db, enable_flag):
        customer_id = "cust7"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": False,
        })

        # First reserve
        allowed, discount_kr, attempt_id = await reserve_campaign_ride(
            db, customer_id, "trip1", 250, 0.15
        )
        assert allowed is True

        # Then complete
        success, final_discount_kr, fee_ore = await complete_campaign_ride(
            db, customer_id, "trip1", 250, 0.15
        )

        assert success is True
        assert final_discount_kr == discount_kr
        assert fee_ore >= 0

        # Check enrollment updated
        enrollment = await db.beta_campaign_enrollments.find_one({"customer_id": customer_id})
        assert enrollment["ride_redeemed"] is True
        assert enrollment["trip_id"] == "trip1"
        assert enrollment["discount_kr"] == discount_kr

        # Check redemption attempt completed
        attempt = await db.beta_campaign_redemptions.find_one({"attempt_id": attempt_id})
        assert attempt["status"] == "completed"

    @pytest.mark.asyncio
    async def test_complete_campaign_ride_no_reservation(self, db, enable_flag):
        customer_id = "cust8"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": False,
        })

        success, discount_kr, fee_ore = await complete_campaign_ride(
            db, customer_id, "trip1", 250, 0.15
        )

        assert success is False
        assert discount_kr == 0

    @pytest.mark.asyncio
    async def test_complete_campaign_ride_price_change(self, db, enable_flag):
        customer_id = "cust9"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": False,
        })

        # Reserve at higher price
        allowed, discount_kr, attempt_id = await reserve_campaign_ride(
            db, customer_id, "trip1", 300, 0.15
        )
        assert allowed is True

        # Complete at lower price - discount should be recalculated
        success, final_discount_kr, fee_ore = await complete_campaign_ride(
            db, customer_id, "trip1", 200, 0.15  # Lower price
        )

        # Discount should be capped at what's valid for the actual price
        assert success is True
        assert final_discount_kr <= discount_kr


class TestCancelCampaignReservation:
    @pytest.mark.asyncio
    async def test_cancel_campaign_reservation(self, db, enable_flag):
        customer_id = "cust10"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": False,
        })

        # Reserve
        allowed, discount_kr, attempt_id = await reserve_campaign_ride(
            db, customer_id, "trip1", 250, 0.15
        )
        assert allowed is True

        # Cancel
        success = await cancel_campaign_reservation(db, customer_id, "trip1")
        assert success is True

        # Check attempt cancelled
        attempt = await db.beta_campaign_redemptions.find_one({"attempt_id": attempt_id})
        assert attempt["status"] == "cancelled"

        # Check enrollment still qualified but no trip_id
        enrollment = await db.beta_campaign_enrollments.find_one({"customer_id": customer_id})
        assert enrollment["ride_redeemed"] is False
        assert enrollment.get("trip_id") is None

    @pytest.mark.asyncio
    async def test_cancel_campaign_reservation_not_found(self, db, enable_flag):
        success = await cancel_campaign_reservation(db, "nonexistent", "trip1")
        assert success is False


class TestGetCampaignDiscount:
    @pytest.mark.asyncio
    async def test_get_campaign_discount_eligible(self, db, enable_flag):
        customer_id = "cust11"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": False,
        })

        discount = await get_campaign_discount(db, customer_id, "trip1", 250, 0.15)
        assert discount > 0
        assert discount <= 300  # cost cap

    @pytest.mark.asyncio
    async def test_get_campaign_discount_not_eligible(self, db, enable_flag):
        customer_id = "cust12"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": False,
            "ride_redeemed": False,
        })

        discount = await get_campaign_discount(db, customer_id, "trip1", 250, 0.15)
        assert discount == 0

    @pytest.mark.asyncio
    async def test_get_campaign_discount_flag_disabled(self, db):
        os.environ[FEATURE_FLAG_ENV] = "false"
        try:
            customer_id = "cust13"
            await db.beta_campaign_enrollments.insert_one({
                "customer_id": customer_id,
                "qualified": True,
                "ride_redeemed": False,
            })

            discount = await get_campaign_discount(db, customer_id, "trip1", 250, 0.15)
            assert discount == 0
        finally:
            os.environ[FEATURE_FLAG_ENV] = "true"


class TestApplyCampaignDiscountToSettlement:
    @pytest.mark.asyncio
    async def test_apply_campaign_discount_to_settlement(self, db, enable_flag):
        customer_id = "cust14"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": False,
        })

        # Reserve first
        allowed, discount_kr, attempt_id = await reserve_campaign_ride(
            db, customer_id, "trip1", 250, 0.15
        )
        assert allowed is True

        # Apply at settlement
        discount_kr, fee_ore = await apply_campaign_discount_to_settlement(
            db, customer_id, "trip1", 250, 0.15
        )

        assert discount_kr > 0
        assert fee_ore >= 0

        # Enrollment should be updated
        enrollment = await db.beta_campaign_enrollments.find_one({"customer_id": customer_id})
        assert enrollment["ride_redeemed"] is True

    @pytest.mark.asyncio
    async def test_apply_campaign_discount_no_reservation(self, db, enable_flag):
        customer_id = "cust15"
        await db.beta_campaign_enrollments.insert_one({
            "customer_id": customer_id,
            "qualified": True,
            "ride_redeemed": False,
        })

        discount_kr, fee_ore = await apply_campaign_discount_to_settlement(
            db, customer_id, "trip1", 250, 0.15
        )

        assert discount_kr == 0
        assert fee_ore == 0


class TestBudgetChecks:
    @pytest.mark.asyncio
    async def test_check_budget_kill_switch(self, db, enable_flag):
        await _set_kill_switch(db, True)
        config = await _get_config(db)
        allowed, reason = await _check_budget(db, config)
        assert allowed is False
        assert "kill switch" in reason.lower()

    @pytest.mark.asyncio
    async def test_check_budget_max_customers(self, db, enable_flag):
        config = CampaignConfig(max_customers=1)
        await _save_config(db, config)

        await db.beta_campaign_enrollments.insert_one({
            "customer_id": "cust1",
            "qualified": True,
            "ride_redeemed": False,
        })

        allowed, reason = await _check_budget(db, config)
        assert allowed is False
        assert "max" in reason.lower() or "reached" in reason.lower()

    @pytest.mark.asyncio
    async def test_check_budget_total_budget(self, db, enable_flag):
        config = CampaignConfig(max_customers=500, cost_cap_kr=300, total_budget_kr=1)
        await _save_config(db, config)

        # Add a completed redemption that spent the budget
        await db.beta_campaign_redemptions.insert_one({
            "attempt_id": "attempt1",
            "customer_id": "cust1",
            "status": "completed",
            "amount_kr": 1,
            "amount_ore": 100,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        allowed, reason = await _check_budget(db, config)
        assert allowed is False
        assert "budget" in reason.lower()


class TestIndexes:
    @pytest.mark.asyncio
    async def test_ensure_indexes(self, db):
        await ensure_beta_campaign_indexes(db)

        # Check all indexes created
        for collection in [
            db.beta_campaign_config,
            db.beta_campaign_enrollments,
            db.beta_campaign_redemptions,
            db.beta_campaign_audit,
        ]:
            assert len(collection.indexes) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])