import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from test_phase2c_dispatch_identity_projection import server


def test_first_selfie_is_optional_only_when_server_policy_is_optional(monkeypatch):
    monkeypatch.setattr(server, 'KJAPP_DRIVER_IDENTITY_REQUIRED', False)
    driver = {'role': 'driver', 'approved': True, 'identity_verification_status': 'not_submitted'}
    assert server.user_public(driver)['identity_verification_required'] is False
    monkeypatch.setattr(server, 'KJAPP_DRIVER_IDENTITY_REQUIRED', True)
    assert server.user_public(driver)['identity_verification_required'] is True


def test_recheck_cannot_be_bypassed_by_optional_first_selfie_policy(monkeypatch):
    monkeypatch.setattr(server, 'KJAPP_DRIVER_IDENTITY_REQUIRED', False)
    for status in ['recheck_required', 'retry_required']:
        assert server.user_public({'role': 'driver', 'identity_verification_status': status})['identity_verification_required'] is True
    assert server.user_public({'role': 'driver', 'identity_verification_status': 'pending_review',
        'identity_verified_at': '2026-10-01T12:00:00Z'})['identity_verification_required'] is True


def test_customer_never_inherits_driver_selfie_gate(monkeypatch):
    monkeypatch.setattr(server, 'KJAPP_DRIVER_IDENTITY_REQUIRED', True)
    assert server.user_public({'role': 'user'})['identity_verification_required'] is False


def verified_driver(**fields):
    return {
        '_id': 'driver', 'role': 'driver', 'approved': True,
        'identity_verification_status': 'verified',
        'identity_verified_at': '2026-10-14T00:00:00+00:00',
        'last_driver_device_id': 'original',
        'last_driver_login_at': datetime.now(timezone.utc).isoformat(),
        **fields,
    }


@pytest.mark.parametrize(('env', 'expected'), [('qa', 'verified'), ('production', 'recheck_required')])
def test_new_installation_requires_recheck_only_outside_qa(monkeypatch, env, expected):
    async def update(query, change):
        assert query == {'_id': 'driver'}
        assert change['$set']['last_driver_device_id'] == 'replacement'

    monkeypatch.setattr(server, 'APP_ENV', env)
    monkeypatch.setattr(server, 'db', SimpleNamespace(users=SimpleNamespace(update_one=update)))
    result = asyncio.run(server._apply_driver_identity_risk(verified_driver(), 'replacement', 'driver', on_login=True))
    assert result['identity_verification_status'] == expected


def test_qa_restores_only_the_prior_device_recheck(monkeypatch):
    driver = verified_driver(identity_verification_status='recheck_required',
                             identity_recheck_trigger='new_device', online=False)

    async def restore(query, operation, *, return_document):
        assert query['identity_recheck_trigger'] == 'new_device'
        assert query['identity_verified_at'] == driver['identity_verified_at']
        assert query['active_trip_id'] == {'$in': [None, '']}
        assert return_document == server.ReturnDocument.AFTER
        result = {**driver, **operation['$set']}
        for field in operation['$unset']:
            result.pop(field, None)
        return result

    monkeypatch.setattr(server, 'APP_ENV', 'qa')
    monkeypatch.setattr(server, 'KJAPP_DRIVER_IDENTITY_REQUIRED', True)
    monkeypatch.setattr(server, 'db', SimpleNamespace(users=SimpleNamespace(find_one_and_update=restore)))
    result = asyncio.run(server._apply_driver_identity_risk(driver))
    assert server.user_public(result)['identity_verification_required'] is False
    assert result['identity_verified_at'] == driver['identity_verified_at']
    assert result['online'] is False


@pytest.mark.parametrize('override', [
    {'identity_recheck_trigger': 'admin'},
    {'identity_recheck_trigger': 'scheduled'},
    {'identity_recheck_trigger': 'long_inactivity'},
    {'identity_verified_at': None},
    {'active_trip_id': 'trip'},
    {'identity_recheck_pending_reason': 'Manual review'},
    {'approved': False},
])
def test_qa_keeps_other_identity_requirements(monkeypatch, override):
    monkeypatch.setattr(server, 'APP_ENV', 'qa')
    monkeypatch.setattr(server, 'db', None)
    driver = verified_driver(**{'identity_verification_status': 'recheck_required',
                                'identity_recheck_trigger': 'new_device', **override})
    result = asyncio.run(server._apply_driver_identity_risk(driver))
    assert result['identity_verification_status'] == 'recheck_required'
