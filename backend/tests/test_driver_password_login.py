"""Driver remains invitation/password based; no legacy SMS or social login contract.

Exercise the real login handler and its shared password/disabled/2FA safeguards.
"""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import mongomock
import pytest
from bson import ObjectId
from fastapi import HTTPException, Request, Response
from test_phase2c_dispatch_identity_projection import server


class Users:
    def __init__(self, raw): self.raw = raw
    async def find_one(self, *args, **kwargs): return self.raw.find_one(*args, **kwargs)


def attempt(monkeypatch, identifier, *, role='driver', disabled=False, password='correct', twofa=False):
    raw = mongomock.MongoClient().db
    raw.users.insert_one({'_id': ObjectId(), 'role': role, 'email': 'driver@example.test',
        'phone': '+47 912 34 567', 'password_hash': 'fixture', 'disabled': disabled, 'totp_enabled': twofa})
    monkeypatch.setattr(server, 'db', SimpleNamespace(users=Users(raw.users)))
    monkeypatch.setattr(server, '_login_blocked', AsyncMock(return_value=False))
    monkeypatch.setattr(server, '_record_failed_login', AsyncMock())
    monkeypatch.setattr(server, '_clear_failed_logins', AsyncMock())
    monkeypatch.setattr(server, 'verify_password', lambda supplied, stored: supplied == 'correct' and stored == 'fixture')
    async def risk(user, *_args, **_kwargs): return user
    monkeypatch.setattr(server, '_apply_driver_identity_risk', risk)
    response = Response()
    result = asyncio.run(server.login(server.LoginRequest(email=identifier, password=password, client='driver'),
        Request({'type': 'http', 'headers': [], 'client': ('127.0.0.1', 1)}), response))
    return result, response


@pytest.mark.parametrize('identifier', ['DRIVER@example.test', '91234567', '+47 912 34 567', '004791234567'])
def test_invited_driver_uses_email_or_phone_with_password(monkeypatch, identifier):
    result, response = attempt(monkeypatch, identifier)
    assert result['user']['role'] == 'driver'
    assert result['token']
    assert 'access_token=' in response.headers['set-cookie']


@pytest.mark.parametrize('override', [{'role': 'user'}, {'disabled': True}, {'password': 'incorrect'}])
def test_passenger_disabled_or_wrong_password_never_opens_driver_session(monkeypatch, override):
    with pytest.raises(HTTPException) as error:
        attempt(monkeypatch, 'driver@example.test', **override)
    assert error.value.status_code == 401
    assert error.value.detail == 'Feil innlogging'
    server._record_failed_login.assert_awaited_once()


def test_password_does_not_bypass_enabled_second_factor(monkeypatch):
    result, response = attempt(monkeypatch, 'driver@example.test', twofa=True)
    assert result['twofa_required'] is True and result['twofa_token']
    assert 'token' not in result
    assert 'set-cookie' not in response.headers


def test_driver_has_no_otp_login_route():
    assert not any('/auth/driver/otp' in getattr(route, 'path', '') for route in server.app.routes)
