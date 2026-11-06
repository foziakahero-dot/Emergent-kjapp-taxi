"""Tests for founding_500 module."""
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId

from founding_500 import (
    CAMPAIGN_ID,
    MAX_CAMPAIGN_CUSTOMERS,
    MAX_SUBSIDY_KR,
    TOTAL_CAMPAIGN_BUDGET_KR,
    DEVICE_IOS,
    DEVICE_ANDROID,
    INVITATION_STATUS_QUEUED,
    INVITATION_STATUS_SENT,
    INVITATION_STATUS_FAILED,
    _phone_hash,
    _registration_id,
    _challenge_id,
    _invitation_id,
    ensure_founding500_indexes,
    create_registration_from_waitlist,
    start_phone_verification,
    verify_phone,
    allocate_campaign_place,
    send_invitation,
    get_campaign_status,
    list_registrations,
    admin_update_registration,
    resend_invitation,
    link_customer_account,
    _get_campaign_config,
    _get_allocated_count,
    COLLECTION_CAMPAIGN_REGISTRATIONS,
    COLLECTION_CAMPAIGN_INVITATIONS,
    COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS,
    COLLECTION_CAMPAIGN_AUDIT,
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
        key = doc.get("registration_id") or doc.get("invitation_id") or doc.get("challenge_id") or doc.get("identity_key") or str(ObjectId())
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
                if "$unset" in update:
                    for k in update["$unset"]:
                        doc.pop(k, None)
                matched += 1
                break
        if matched == 0 and upsert:
            new_doc = {}
            if "$setOnInsert" in update:
                new_doc.update(update["$setOnInsert"])
            if "$set" in update:
                new_doc.update(update["$set"])
            key = new_doc.get("registration_id") or new_doc.get("invitation_id") or new_doc.get("challenge_id") or new_doc.get("identity_key") or new_doc.get("_id") or str(ObjectId())
            self.docs[key] = new_doc
            return MagicMock(matched_count=0, modified_count=0, upserted_id=key)
        return MagicMock(matched_count=matched, modified_count=matched)

    async def find_one_and_update(self, query, update, upsert=False, return_document=None):
        for key, doc in self.docs.items():
            if self._match(doc, query):
                if "$set" in update:
                    doc.update(update["$set"])
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        doc[k] = doc.get(k, 0) + v
                if "$unset" in update:
                    for k in update["$unset"]:
                        doc.pop(k, None)
                matched = 1
                break
        if return_document == ReturnDocument.AFTER:
            return doc
        return MagicMock(matched_count=matched if 'matched' in locals() else 0, modified_count=matched if 'matched' in locals() else 0)

    async def aggregate(self, pipeline):
        # Simple aggregation for budget calculation
        if len(pipeline) == 2 and pipeline[0].get("$match", {}).get("status") == "completed":
            total = 0
            for doc in self.docs.values():
                if doc.get("status") == "completed":
                    total += doc.get("amount_ore", 0)
            return [{"total": total}]
        return []

    def _match(self, doc, query):
        for k, v in query.items():
            if k == "_id":
                continue
            if isinstance(v, dict):
                for op, op_val in v.items():
                    if op == "$in":
                        if doc.get(k) not in op_val:
                            return False
                    elif op == "$ne":
                        if doc.get(k) == op_val:
                            return False
                    elif op == "$gt":
                        if doc.get(k, 0) <= op_val:
                            return False
                    elif op == "$lte":
                        if doc.get(k, "") > op_val:
                            return False
                    elif op == "$exists":
                        if op_val and k not in doc:
                            return False
                        if not op_val and k in doc:
                            return False
            elif doc.get(k) != v:
                return False
        return True


class FakeDB:
    """Fake database with collections."""
    def __init__(self):
        self[COLLECTION_CAMPAIGN_REGISTRATIONS] = FakeCollection()
        self[COLLECTION_CAMPAIGN_INVITATIONS] = FakeCollection()
        self[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS] = FakeCollection()
        self[COLLECTION_CAMPAIGN_AUDIT] = FakeCollection()
        self.beta_waitlist = FakeCollection()
        self.beta_campaign_config = FakeCollection()
        self.beta_campaign_enrollments = FakeCollection()
        self.beta_campaign_redemptions = FakeCollection()
        self.onboarding_email_outbox = FakeCollection()
        self.users = FakeCollection()
        self.rate_limit_buckets = FakeCollection()
        self.driver_invites = FakeCollection()

    def __getitem__(self, key):
        return getattr(self, key)

    def __setitem__(self, key, value):
        setattr(self, key, value)


@pytest.fixture
def db():
    return FakeDB()


@pytest.fixture(autouse=True)
def setup_env():
    """Setup environment variables for tests."""
    os.environ["FOUNDING500_HMAC_SECRET"] = "test-secret"
    os.environ["FOUNDING500_ANDROID_APK_URL"] = "https://example.com/app.apk"
    os.environ["FOUNDING500_IOS_TESTFLIGHT_URL"] = "https://testflight.apple.com/join/test"
    yield
    # Cleanup


class TestUtilities:
    def test_phone_hash(self):
        phone = "+4791234567"
        hash1 = _phone_hash(phone)
        hash2 = _phone_hash(phone)
        assert hash1 == hash2
        assert len(hash1) == 32
        # Different phones give different hashes
        assert _phone_hash("+4712345679") != hash1

    def test_registration_id(self):
        phone_hash = "a" * 32
        identity_key = "b" * 64
        reg_id = _registration_id(phone_hash, identity_key)
        assert len(reg_id) == 24
        # Deterministic
        assert _registration_id(phone_hash, identity_key) == reg_id

    def test_challenge_id(self):
        cid1 = _challenge_id()
        cid2 = _challenge_id()
        assert len(cid1) >= 32
        assert cid1 != cid2

    def test_invitation_id(self):
        iid1 = _invitation_id()
        iid2 = _invitation_id()
        assert len(iid1) >= 24
        assert iid1 != iid2


class TestIndexes:
    @pytest.mark.asyncio
    async def test_ensure_indexes(self, db):
        await ensure_founding500_indexes(db)
        for collection in [
            db[COLLECTION_CAMPAIGN_REGISTRATIONS],
            db[COLLECTION_CAMPAIGN_INVITATIONS],
            db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS],
            db[COLLECTION_CAMPAIGN_AUDIT],
        ]:
            assert len(collection.indexes) > 0


class TestCreateRegistration:
    @pytest.mark.asyncio
    async def test_create_registration_success(self, db):
        # Setup waitlist entry
        identity_key = "a" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "district": "Grünerløkka",
            "status": "new",
        })

        # Setup campaign config
        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)

        assert registration.registration_id != ""
        assert registration.identity_key == identity_key
        assert registration.name == "Test User"
        assert registration.phone == "+4791234567"
        assert registration.email == "test@example.com"
        assert registration.device == "android"
        assert registration.district == "Grünerløkka"
        assert registration.status == "pending_verification"
        assert registration.phone_hash == _phone_hash("+4791234567")

    @pytest.mark.asyncio
    async def test_create_registration_missing_device(self, db):
        identity_key = "b" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "status": "new",
            # device missing
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        with pytest.raises(Exception) as exc:
            await create_registration_from_waitlist(db, identity_key)
        assert "Enhetstype" in str(exc.value) or "400" in str(exc.value)

    @pytest.mark.asyncio
    async def test_create_registration_wrong_role(self, db):
        identity_key = "c" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "driver",  # Wrong role
            "device": "android",
            "status": "new",
        })

        with pytest.raises(Exception) as exc:
            await create_registration_from_waitlist(db, identity_key)
        assert "Bare kunde" in str(exc.value) or "400" in str(exc.value)

    @pytest.mark.asyncio
    async def test_create_registration_duplicate_phone(self, db):
        identity_key1 = "d" * 64
        identity_key2 = "e" * 64

        await db.beta_waitlist.insert_one({
            "identity_key": identity_key1,
            "name": "Test User 1",
            "phone": "+4791234567",
            "email": "test1@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await db.beta_waitlist.insert_one({
            "identity_key": identity_key2,
            "name": "Test User 2",
            "phone": "+4791234567",  # Same phone
            "email": "test2@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "ios",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        # First registration succeeds
        await create_registration_from_waitlist(db, identity_key1)

        # Second should fail
        with pytest.raises(Exception) as exc:
            await create_registration_from_waitlist(db, identity_key2)
        assert "allerede registrert" in str(exc.value) or "409" in str(exc.value)

    @pytest.mark.asyncio
    async def test_create_registration_max_reached(self, db):
        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 1,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        # Fill up the campaign
        identity_key1 = "f" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key1,
            "name": "Test User 1",
            "phone": "+4791234567",
            "email": "test1@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await create_registration_from_waitlist(db, identity_key1)

        # Manually set to allocated to simulate full campaign
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
            {"identity_key": identity_key1},
            {"$set": {"status": "allocated"}},
        )

        # Second registration should fail
        identity_key2 = "g" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key2,
            "name": "Test User 2",
            "phone": "+4712345679",
            "email": "test2@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        with pytest.raises(Exception) as exc:
            await create_registration_from_waitlist(db, identity_key2)
        assert "full" in str(exc.value).lower() or "409" in str(exc.value)


class TestPhoneVerification:
    @pytest.mark.asyncio
    async def test_start_phone_verification_success(self, db):
        # Setup registration
        identity_key = "h" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)

        # Mock SMS config and provider
        with patch("founding_500.sms_config", return_value=("sid", "token", "service")), \
             patch("founding_500.provider_call", new_callable=AsyncMock) as mock_provider:
            mock_provider.return_value = {"status": "pending", "sid": "verify_sid_123"}

            result = await start_phone_verification(db, "+4791234567", registration.registration_id)

            assert result["challenge_id"] != ""
            assert result["expires_in"] == 300
            assert "SMS" in result["message"]

            # Check challenge stored
            challenge = await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].find_one({"registration_id": registration.registration_id})
            assert challenge is not None
            assert challenge["verification_sid"] == "verify_sid_123"
            assert challenge["consumed"] is False

    @pytest.mark.asyncio
    async def test_start_phone_verification_wrong_phone(self, db):
        identity_key = "i" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)

        with patch("founding_500.sms_config", return_value=("sid", "token", "service")), \
             patch("founding_500.provider_call", new_callable=AsyncMock):

            with pytest.raises(Exception) as exc:
                await start_phone_verification(db, "+4712345679", registration.registration_id)  # Wrong phone
            assert "matcher ikke" in str(exc.value) or "400" in str(exc.value)

    @pytest.mark.asyncio
    async def test_verify_phone_success(self, db):
        identity_key = "j" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)

        # Create challenge
        challenge_id = _challenge_id()
        phone_hash = _phone_hash("+4791234567")
        await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].insert_one({
            "_id": challenge_id,
            "registration_id": registration.registration_id,
            "phone_hash": phone_hash,
            "verification_sid": "verify_sid_123",
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
            "attempts": 0,
            "consumed": False,
        })

        with patch("founding_500.sms_config", return_value=("sid", "token", "service")), \
             patch("founding_500.provider_call", new_callable=AsyncMock) as mock_provider:
            mock_provider.return_value = {"status": "approved", "sid": "verify_sid_123"}

            result = await verify_phone(db, "+4791234567", registration.registration_id, challenge_id, "123456")

            assert result["ok"] is True
            assert result["status"] == "verified"

            # Check challenge consumed
            challenge = await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].find_one({"_id": challenge_id})
            assert challenge["consumed"] is True

            # Check registration updated
            reg = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration.registration_id})
            assert reg["status"] == "verified"
            assert reg["verified_at"] is not None

    @pytest.mark.asyncio
    async def test_verify_phone_wrong_code(self, db):
        identity_key = "k" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)

        challenge_id = _challenge_id()
        phone_hash = _phone_hash("+4791234567")
        await db[COLLECTION_CAMPAIGN_PHONE_VERIFICATIONS].insert_one({
            "_id": challenge_id,
            "registration_id": registration.registration_id,
            "phone_hash": phone_hash,
            "verification_sid": "verify_sid_123",
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
            "attempts": 0,
            "consumed": False,
        })

        with patch("founding_500.sms_config", return_value=("sid", "token", "service")), \
             patch("founding_500.provider_call", new_callable=AsyncMock) as mock_provider:
            mock_provider.return_value = {"status": "failed", "sid": "verify_sid_123"}

            with pytest.raises(Exception) as exc:
                await verify_phone(db, "+4791234567", registration.registration_id, challenge_id, "wrong")
            assert "Feil" in str(exc.value) or "401" in str(exc.value)


class TestAllocation:
    @pytest.mark.asyncio
    async def test_allocate_campaign_place_success(self, db):
        identity_key = "l" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)

        # Manually verify
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
            {"registration_id": registration.registration_id},
            {"$set": {"status": "verified", "verified_at": datetime.now(timezone.utc).isoformat()}},
        )

        result = await allocate_campaign_place(db, registration.registration_id, "admin1")

        assert result["ok"] is True
        assert result["status"] == "allocated"

        reg = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration.registration_id})
        assert reg["status"] == "allocated"
        assert reg["allocated_at"] is not None

    @pytest.mark.asyncio
    async def test_allocate_campaign_place_max_reached(self, db):
        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 1,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        identity_key = "m" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        registration = await create_registration_from_waitlist(db, identity_key)

        # Fill up the campaign
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
            {"registration_id": registration.registration_id},
            {"$set": {"status": "verified"}},
        )

        # Add another allocated registration to fill the slot
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].insert_one({
            "registration_id": "other123",
            "identity_key": "other" * 12 + "key",
            "name": "Other User",
            "phone": "+4712345679",
            "phone_hash": _phone_hash("+4712345679"),
            "email": "other@example.com",
            "city": "Oslo",
            "device": "android",
            "status": "allocated",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "allocated_at": datetime.now(timezone.utc).isoformat(),
        })

        with pytest.raises(Exception) as exc:
            await allocate_campaign_place(db, registration.registration_id, "admin1")
        assert "full" in str(exc.value).lower() or "409" in str(exc.value)


class TestInvitations:
    @pytest.mark.asyncio
    async def test_send_invitation_android(self, db):
        identity_key = "n" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)

        # Set to allocated
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
            {"registration_id": registration.registration_id},
            {"$set": {"status": "allocated", "allocated_at": datetime.now(timezone.utc).isoformat()}},
        )

        result = await send_invitation(db, registration.registration_id)

        assert result["ok"] is True
        assert result["invitation_id"] != ""
        assert result["status"] == "queued"

        # Check invitation created
        invitation = await db[COLLECTION_CAMPAIGN_INVITATIONS].find_one({"registration_id": registration.registration_id})
        assert invitation is not None
        assert invitation["device"] == "android"
        assert invitation["apk_link"] == "https://example.com/app.apk"

    @pytest.mark.asyncio
    async def test_send_invitation_ios(self, db):
        identity_key = "o" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "ios",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)

        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
            {"registration_id": registration.registration_id},
            {"$set": {"status": "allocated", "allocated_at": datetime.now(timezone.utc).isoformat()}},
        )

        result = await send_invitation(db, registration.registration_id)

        assert result["ok"] is True

        invitation = await db[COLLECTION_CAMPAIGN_INVITATIONS].find_one({"registration_id": registration.registration_id})
        assert invitation["device"] == "ios"
        assert invitation["testflight_link"] == "https://testflight.apple.com/join/test"


class TestCampaignStatus:
    @pytest.mark.asyncio
    async def test_get_campaign_status(self, db):
        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        # Add some registrations
        for i in range(3):
            reg_id = f"reg{i}"
            await db[COLLECTION_CAMPAIGN_REGISTRATIONS].insert_one({
                "registration_id": reg_id,
                "identity_key": f"key{i}" * 16,
                "name": f"User {i}",
                "phone": f"+471234567{i}",
                "phone_hash": _phone_hash(f"+471234567{i}"),
                "email": f"user{i}@example.com",
                "city": "Oslo",
                "device": "android",
                "status": "verified" if i < 2 else "allocated",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

        status = await get_campaign_status(db)

        assert status.campaign_id == CAMPAIGN_ID
        assert status.total_registrations == 3
        assert status.verified_count == 2
        assert status.allocated_count == 1
        assert status.remaining_places == 499


class TestAdminActions:
    @pytest.mark.asyncio
    async def test_admin_reject_registration(self, db):
        identity_key = "p" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
            {"registration_id": registration.registration_id},
            {"$set": {"status": "verified"}},
        )

        result = await admin_update_registration(db, registration.registration_id, "reject", "admin1", "Ikke kvalifisert")

        assert result["ok"] is True
        assert result["status"] == "rejected"

        reg = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration.registration_id})
        assert reg["status"] == "rejected"
        assert reg.get("rejection_reason") == "Ikke kvalifisert"

    @pytest.mark.asyncio
    async def test_admin_waitlist_registration(self, db):
        identity_key = "q" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
            {"registration_id": registration.registration_id},
            {"$set": {"status": "verified"}},
        )

        result = await admin_update_registration(db, registration.registration_id, "waitlist", "admin1", "Venter på plass")

        assert result["ok"] is True
        assert result["status"] == "waitlisted"

        reg = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration.registration_id})
        assert reg["status"] == "waitlisted"


class TestLinkCustomer:
    @pytest.mark.asyncio
    async def test_link_customer_account(self, db):
        identity_key = "r" * 64
        await db.beta_waitlist.insert_one({
            "identity_key": identity_key,
            "name": "Test User",
            "phone": "+4791234567",
            "email": "test@example.com",
            "city": "Oslo",
            "role": "passenger",
            "device": "android",
            "status": "new",
        })

        await db.beta_campaign_config.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "max_customers": 500,
            "cost_cap_kr": 180,
            "total_budget_kr": 90000,
            "active": True,
            "kill_switch": False,
        })

        registration = await create_registration_from_waitlist(db, identity_key)
        await db[COLLECTION_CAMPAIGN_REGISTRATIONS].update_one(
            {"registration_id": registration.registration_id},
            {"$set": {"status": "allocated", "allocated_at": datetime.now(timezone.utc).isoformat()}},
        )

        customer_id = str(ObjectId())
        await db.users.insert_one({
            "_id": ObjectId(customer_id),
            "email": "test@example.com",
            "role": "user",
        })

        # Mock qualify_customer
        with patch("founding_500.qualify_customer", new_callable=AsyncMock) as mock_qualify:
            mock_qualify.return_value = MagicMock(customer_id=customer_id, qualified=True)

            result = await link_customer_account(db, registration.registration_id, customer_id)

            assert result["ok"] is True

            reg = await db[COLLECTION_CAMPAIGN_REGISTRATIONS].find_one({"registration_id": registration.registration_id})
            assert reg["customer_id"] == customer_id


if __name__ == "__main__":
    pytest.main([__file__, "-v"])