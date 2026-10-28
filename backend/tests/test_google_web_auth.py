"""Web and APK must enforce the same verified identity and role gates."""
from unittest.mock import AsyncMock, Mock
from types import SimpleNamespace
import httpx
import pytest
from test_mobile_commerce import env, sign_in
import mobile_commerce as commerce

BODY = {'code': 'google-code', 'code_verifier': 'a' * 43, 'redirect_uri': 'https://customer.example/', 'client': 'customer'}

@pytest.fixture
def web(env, monkeypatch):
    monkeypatch.setenv('GOOGLE_CLIENT_SECRET', 'server-only-secret')
    monkeypatch.setenv('GOOGLE_REDIRECT_URIS', BODY['redirect_uri'])
    post = AsyncMock(return_value=httpx.Response(200, json={'id_token': 'verified-token'}))
    transport = AsyncMock()
    transport.__aenter__.return_value = SimpleNamespace(post=post)
    monkeypatch.setattr(commerce.httpx, 'AsyncClient', Mock(return_value=transport))
    env.post = post
    return env


def test_web_uses_pkce_and_same_verified_customer_identity(web):
    result = web.client.post('/auth/google/web/code', json=BODY)
    assert result.status_code == 200 and result.json()['user']['role'] == 'user'
    web.verify.assert_awaited_once_with('verified-token', 'owned-web-client')
    assert web.post.call_args.kwargs['data']['code_verifier'] == BODY['code_verifier']
    assert 'server-only-secret' not in str(result.json())


def test_web_rejects_unknown_redirect_before_contacting_google(web):
    result = web.client.post('/auth/google/web/code', json={**BODY, 'redirect_uri': 'https://attacker.example/'})
    assert result.status_code == 400
    web.post.assert_not_awaited()


def test_web_rejects_bad_pkce(web):
    assert web.client.post('/auth/google/web/code', json={**BODY, 'code_verifier': 'short'}).status_code == 422
    web.post.assert_not_awaited()


def test_web_does_not_link_existing_account_by_email(web):
    web.db.raw.users.update_one({'_id': web.uid}, {'$unset': {'google_sub': ''}})
    assert web.client.post('/auth/google/web/code', json=BODY).status_code == 409
    assert web.client.post('/auth/google/web/link', json=BODY).json() == {'linked': True}
    assert web.client.post('/auth/google/web/code', json=BODY).status_code == 200


def test_web_driver_social_login_is_disabled_even_for_approved_linked_accounts(web):
    body = {**BODY, 'client': 'driver'}
    assert web.client.post('/auth/google/web/code', json=body).status_code == 403
    web.db.raw.users.update_one({'_id': web.uid}, {'$set': {'role': 'driver', 'approved': True, 'fleet_id': str(web.fid)}})
    assert web.client.post('/auth/google/web/code', json=body).status_code == 403
    web.post.assert_not_awaited()
    assert web.db.raw.users.count_documents({}) == 1


def test_approved_driver_cannot_link_or_login_with_google(web):
    web.current.update(role='driver', approved=True)
    web.db.raw.users.update_one({'_id': web.uid}, {'$set': {'role': 'driver', 'approved': True}, '$unset': {'google_sub': ''}})
    assert sign_in(web, 'driver').status_code == 403
    assert web.client.post('/auth/google/link', json={'identity_token': 'verified-token', 'client': 'driver'}).status_code == 403
    assert sign_in(web, 'driver').status_code == 403
    web.verify.assert_not_awaited()


def test_web_qa_never_inherits_shared_credentials(web, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'qa')
    monkeypatch.delenv('QA_GOOGLE_AUTH_ENABLED', raising=False)
    assert web.client.get('/auth/google/web/config').json()['enabled'] is False
    assert web.client.post('/auth/google/web/code', json=BODY).status_code == 503
    web.post.assert_not_awaited()


def test_provider_failure_and_missing_identity_never_issue_session(web):
    for response in [httpx.Response(400, json={'error':'invalid_grant'}), httpx.Response(200, json={})]:
        web.post.return_value = response
        assert web.client.post('/auth/google/web/code', json=BODY).status_code == 401
    web.post.side_effect = httpx.ConnectTimeout('provider timeout')
    assert web.client.post('/auth/google/web/code', json=BODY).status_code == 503
    web.verify.assert_not_awaited()
