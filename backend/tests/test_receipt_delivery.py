import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
import mongomock
import pytest
from receipt_delivery import deliver_pending_receipt


class Collection:
    def __init__(self, raw): self.raw = raw
    async def find_one_and_update(self, *a, **k): return self.raw.find_one_and_update(*a, **k)
    async def update_one(self, *a, **k): return self.raw.update_one(*a, **k)


@pytest.fixture
def env():
    from types import SimpleNamespace
    raw = mongomock.MongoClient().receipts.receipt_ledger
    raw.insert_one({'trip_id': 'fixture-trip', 'payment_status': 'paid',
        'email_delivery_pending': True, 'email_delivery_attempts': 0, 'gross_amount': 173})
    return raw, SimpleNamespace(receipt_ledger=Collection(raw))


def test_unconfigured_mail_never_claims_or_sends(env):
    raw, db = env; send = AsyncMock()
    assert asyncio.run(deliver_pending_receipt(db, send, lambda: False)) is False
    assert raw.find_one()['email_delivery_attempts'] == 0
    send.assert_not_awaited()


def test_delivered_receipt_exits_queue_without_changing_amount(env):
    raw, db = env
    async def sender(trip):
        raw.update_one({'trip_id': trip}, {'$set': {'email_delivery_pending': False}})
    assert asyncio.run(deliver_pending_receipt(db, sender, lambda: True)) is True
    assert asyncio.run(deliver_pending_receipt(db, sender, lambda: True)) is False
    assert raw.find_one()['gross_amount'] == 173


def test_retry_backoff_bound_and_crashed_lease_recovery(env):
    raw, db = env; send = AsyncMock(side_effect=RuntimeError('provider unavailable'))
    assert asyncio.run(deliver_pending_receipt(db, send, lambda: True)) is True
    assert raw.find_one()['email_delivery_attempts'] == 1
    assert asyncio.run(deliver_pending_receipt(db, send, lambda: True)) is False
    raw.update_one({}, {'$set': {'email_delivery_next_at': datetime.now(timezone.utc) - timedelta(seconds=1),
        'email_delivery_lease_until': datetime.now(timezone.utc) + timedelta(minutes=2)}})
    assert asyncio.run(deliver_pending_receipt(db, send, lambda: True)) is False
    raw.update_one({}, {'$set': {'email_delivery_lease_until': datetime.now(timezone.utc) - timedelta(seconds=1)}})
    assert asyncio.run(deliver_pending_receipt(db, send, lambda: True)) is True
    raw.update_one({}, {'$set': {'email_delivery_attempts': 8,
        'email_delivery_next_at': datetime.now(timezone.utc) - timedelta(seconds=1)}})
    assert asyncio.run(deliver_pending_receipt(db, send, lambda: True)) is False
    assert send.await_count == 2


def test_unpaid_and_historical_receipts_not_automatically_sent(env):
    raw, db = env; send = AsyncMock()
    raw.update_one({}, {'$set': {'payment_status': 'pending'}})
    assert asyncio.run(deliver_pending_receipt(db, send, lambda: True)) is False
    raw.update_one({}, {'$set': {'payment_status': 'paid'}, '$unset': {'email_delivery_pending': ''}})
    assert asyncio.run(deliver_pending_receipt(db, send, lambda: True)) is False
    send.assert_not_awaited()
