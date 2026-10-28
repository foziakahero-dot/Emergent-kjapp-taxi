import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
import os
os.environ.setdefault('MONGO_URL','mongodb://127.0.0.1:27017')
os.environ.setdefault('DB_NAME','snar_return_test')
os.environ.setdefault('JWT_SECRET','unit-test-secret-that-is-long-enough-for-hs256')
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
from fastapi import HTTPException
import pytest


def test_verified_card_checkout_returns_to_payment_methods_in_same_web_app(monkeypatch):
    from bson import ObjectId
    uid = str(ObjectId())
    monkeypatch.setenv('STRIPE_PUBLISHABLE_KEY', 'pk_test_unit')
    monkeypatch.setenv('NATIVE_PAYMENTS_ENABLED', 'true')
    monkeypatch.setattr(server,'_enforce_rate_limit',AsyncMock())
    monkeypatch.setattr(server,'_trusted_checkout_origin',lambda origin: origin)
    monkeypatch.setattr(server,'db',SimpleNamespace(users=SimpleNamespace(find_one=AsyncMock(return_value={'_id':ObjectId(uid),'email':'unit@example.invalid','stripe_customer_id':'cus_test'}),update_one=AsyncMock())))
    create = Mock(return_value=SimpleNamespace(id='cs_test',url='https://checkout.stripe.com/test'))
    monkeypatch.setattr(server.stripe,'StripeClient',Mock(return_value=SimpleNamespace(v1=SimpleNamespace(checkout=SimpleNamespace(sessions=SimpleNamespace(create=create))))))
    monkeypatch.setattr(server.stripe,'api_key','sk_test_unit')
    result = asyncio.run(server.stripe_card_setup(server.CardSetupRequest(origin_url='https://customer.example'),SimpleNamespace(),{'id':uid}))
    params=create.call_args.args[0]
    assert params['success_url']=='https://customer.example/payment-methods?setup=success&session_id={CHECKOUT_SESSION_ID}'
    assert params['cancel_url']=='https://customer.example/payment-methods?setup=cancel'
    assert 'usage' not in params.get('setup_intent_data', {}), 'Checkout setup mode must not send the unsupported usage field'
    assert 'payment_method_types' not in params
    assert result['session_id']=='cs_test'


def test_card_registration_never_silently_returns_to_unrelated_landing(monkeypatch):
    from bson import ObjectId
    monkeypatch.setenv('STRIPE_PUBLISHABLE_KEY', 'pk_test_unit')
    monkeypatch.setenv('NATIVE_PAYMENTS_ENABLED', 'true')
    monkeypatch.setattr(server,'_enforce_rate_limit',AsyncMock())
    monkeypatch.setattr(server.stripe,'api_key','sk_test_unit')
    monkeypatch.setattr(server,'db',SimpleNamespace(users=SimpleNamespace(find_one=AsyncMock(return_value={'email':'unit@example.invalid'}))))
    monkeypatch.setattr(server.stripe,'StripeClient',Mock())
    monkeypatch.setattr(server,'_trusted_checkout_origin',lambda origin:'https://landing.example')
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.stripe_card_setup(server.CardSetupRequest(origin_url='https://customer.example'),SimpleNamespace(),{'id':str(ObjectId())}))
    assert error.value.status_code==400
