import asyncio
import logging
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stripe_fleet import ensure_fleet_account


class StripeFailure(Exception):
    def __init__(self, message):
        self.json_body = {"error": {"message": message}}
        self.request_id = "req_test"


def failing_stripe(message):
    def create(**kwargs):
        raise StripeFailure(message)
    return SimpleNamespace(api_key="configured", Account=SimpleNamespace(create=create))


def test_missing_connect_explains_required_action_without_leaking_error(caplog):
    caplog.set_level(logging.WARNING)
    with pytest.raises(HTTPException) as result:
        asyncio.run(ensure_fleet_account(
            None, failing_stripe("You can only create new accounts if you've signed up for Connect"),
            {"_id": "fleet-test"}, "owner@example.invalid",
        ))
    assert result.value.status_code == 503
    assert "Aktiver Connect" in result.value.detail
    assert "allerede opprettet" in result.value.detail
    assert "req_test" in caplog.text
    assert "owner@example.invalid" not in caplog.text
    assert "signed up" not in caplog.text


def test_other_stripe_errors_remain_generic_and_do_not_expose_provider_data(caplog):
    caplog.set_level(logging.WARNING)
    with pytest.raises(HTTPException) as result:
        asyncio.run(ensure_fleet_account(
            None, failing_stripe("unexpected provider error with private data"),
            {"_id": "fleet-test"},
        ))
    assert result.value.status_code == 502
    assert "private data" not in result.value.detail
    assert "private data" not in caplog.text


def test_existing_connection_is_reused_without_creating_another_account():
    stripe = SimpleNamespace(api_key="configured", Account=SimpleNamespace())
    assert asyncio.run(ensure_fleet_account(
        None, stripe, {"_id": "fleet-test", "stripe_account_id": "acct_existing"},
    )) == "acct_existing"
