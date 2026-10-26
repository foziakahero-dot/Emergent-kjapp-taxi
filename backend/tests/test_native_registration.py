"""Provider signatures, safe linking, account uniqueness and QA isolation."""
import asyncio
import os
os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:27017')
os.environ.setdefault('DB_NAME', 'snar_identity_test')
os.environ.setdefault('JWT_SECRET', 'unit-test-secret-that-is-long-enough-for-hs256')
import json
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import AsyncMock

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm
from test_mobile_commerce import env, sign_in


@pytest.fixture(scope='module')
def apple_signer():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(RSAAlgorithm.to_jwk(key.public_key()))
    jwk['kid'] = 'unit-apple-key'
    return key, jwk


def apple_token(env, signer, **changes):
    key, jwk = signer
    env.apple_keys.return_value = [jwk]
    claims = {'sub': 'apple-new', 'aud': 'no.nexorahub.kjapp.customer', 'iss': 'https://appleid.apple.com',
        'exp': int(time.time()) + 120, 'email': 'new@privaterelay.appleid.com', 'email_verified': 'true'}
    claims.update(changes)
    return jwt.encode(claims, key, algorithm='RS256', headers={'kid': jwk['kid']})


def apple_request(env, token, route='native'):
    return env.client.post('/auth/apple/' + route, json={'identity_token': token, 'client': 'customer'})


def test_new_google_customer_creates_one_database_account_and_one_welcome(env):
    env.verify.return_value.update(sub='new-google', email='new@example.invalid', picture='https://lh3.googleusercontent.com/qa-photo')
    sessions = [sign_in(env) for _ in range(2)]
    assert [r.status_code for r in sessions] == [200, 200]
    assert sessions[0].json()['user']['id'] == sessions[1].json()['user']['id']
    account = env.db.raw.users.find_one({'google_sub': 'new-google'})
    assert account['role'] == 'user'
    assert account['picture'] == 'https://lh3.googleusercontent.com/qa-photo'
    assert not account.get('legal_accepted')
    assert env.db.raw.users.count_documents({'email': 'new@example.invalid'}) == 1
    assert env.db.raw.onboarding_email_outbox.count_documents({'entity_id': str(account['_id']), 'provider': 'resend'}) == 1


def test_concurrent_google_retries_do_not_duplicate_accounts(env):
    env.verify.return_value.update(sub='concurrent-google', email='race@example.invalid')
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: sign_in(env), range(2)))
    assert [r.status_code for r in results] == [200, 200]
    assert env.db.raw.users.count_documents({'google_sub': 'concurrent-google'}) == 1
    assert results[0].json()['user']['id'] == results[1].json()['user']['id']


def test_matching_email_never_links_google_without_an_authenticated_action(env):
    env.db.raw.users.update_one({'_id': env.uid}, {'$unset': {'google_sub': ''}})
    assert sign_in(env).status_code == 409
    assert not env.db.raw.users.find_one({'_id': env.uid}).get('google_sub')
    assert env.client.post('/auth/google/link', json={'identity_token': 'verified-token'}).status_code == 200
    assert sign_in(env).status_code == 200


def test_invalid_google_and_unverified_new_email_never_create_accounts(env):
    env.verify.side_effect = ValueError('invalid signature')
    assert sign_in(env).status_code == 401
    env.verify.side_effect = None
    env.verify.return_value.update(sub='unverified', email='new@example.invalid', email_verified=False)
    assert sign_in(env).status_code == 401
    assert env.db.raw.users.count_documents({}) == 1


def test_apple_new_registration_and_repeat_login_use_same_customer(env, apple_signer):
    token = apple_token(env, apple_signer)
    first, second = apple_request(env, token), apple_request(env, token)
    assert first.status_code == second.status_code == 200
    assert first.json()['user']['id'] == second.json()['user']['id']
    assert env.db.raw.users.count_documents({'apple_sub': 'apple-new'}) == 1
    assert env.db.raw.onboarding_email_outbox.count_documents({'kind': 'customer'}) == 1


@pytest.mark.parametrize('changes', [{'aud':'other-app'}, {'iss':'https://other.example'}, {'exp':1}])
def test_apple_checks_audience_issuer_and_expiry(env, apple_signer, changes):
    assert apple_request(env, apple_token(env, apple_signer, **changes)).status_code == 401
    assert env.db.raw.users.count_documents({}) == 1


def test_apple_matching_email_never_automatically_links(env, apple_signer):
    token = apple_token(env, apple_signer, email=env.current['email'])
    assert apple_request(env, token).status_code == 409
    assert not env.db.raw.users.find_one({'_id':env.uid}).get('apple_sub')
    assert apple_request(env, token, 'link').status_code == 200
    assert apple_request(env, token).status_code == 200


def test_explicit_apple_link_supports_private_relay_without_changing_account_email(env, apple_signer):
    token = apple_token(env, apple_signer)
    assert apple_request(env, token, 'link').status_code == 200
    account = env.db.raw.users.find_one({'_id': env.uid})
    assert account['email'] == env.current['email'] and account['apple_sub'] == 'apple-new'
    env.current['id'] = '000000000000000000000001'
    assert apple_request(env, token, 'link').status_code == 409


def test_qa_oauth_requires_qa_ids_and_explicit_enable(env, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'qa')
    config = env.client.get('/auth/native/config').json()
    assert not config['google_enabled'] and not config['apple_enabled']
    assert sign_in(env).status_code == 503
    env.verify.assert_not_awaited()
    monkeypatch.setenv('QA_GOOGLE_CLIENT_ID', 'dedicated-qa-web-client')
    monkeypatch.setenv('QA_GOOGLE_AUTH_ENABLED', 'true')
    assert sign_in(env).status_code == 200
    env.verify.assert_awaited_once_with('verified-token', 'dedicated-qa-web-client')
    assert env.client.get('/auth/native/config').json()['google_web_client_id'] == 'dedicated-qa-web-client'


@pytest.mark.parametrize('changes', [{'aud': 'another-client'}, {'iss': 'https://fake.example'}, {'exp': 1}])
def test_google_signature_audience_issuer_and_expiry(monkeypatch, changes):
    import server
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(RSAAlgorithm.to_jwk(key.public_key())); jwk['kid'] = 'qa-google-key'
    monkeypatch.setattr(server, '_get_google_keys', AsyncMock(return_value=[jwk]))
    claims = {'sub': 'google-sub', 'aud': 'expected-client', 'iss': 'https://accounts.google.com', 'exp': int(time.time()) + 120}
    claims.update(changes)
    token = jwt.encode(claims, key, algorithm='RS256', headers={'kid': jwk['kid']})
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as error:
        asyncio.run(server._verify_google_id_token(token, 'expected-client'))
    assert error.value.status_code == 401


def test_google_accepts_signed_identity_but_rejects_forged_or_malformed_token(monkeypatch):
    import server
    from fastapi import HTTPException
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(RSAAlgorithm.to_jwk(key.public_key())); jwk['kid'] = 'qa-google-key'
    monkeypatch.setattr(server, '_get_google_keys', AsyncMock(return_value=[jwk]))
    claims = {'sub': 'google-sub', 'aud': 'expected-client', 'iss': 'https://accounts.google.com', 'exp': int(time.time()) + 120}
    token = jwt.encode(claims, key, algorithm='RS256', headers={'kid': jwk['kid']})
    assert asyncio.run(server._verify_google_id_token(token, 'expected-client'))['sub'] == 'google-sub'
    for invalid in ['not-a-jwt', jwt.encode(claims, 'attacker-secret', algorithm='HS256', headers={'kid': jwk['kid']}), token[:-20] + 'a' * 20]:
        with pytest.raises(HTTPException) as error:
            asyncio.run(server._verify_google_id_token(invalid, 'expected-client'))
        assert error.value.status_code == 401
