import asyncio
import ast
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from cryptography.fernet import Fernet
from fastapi import APIRouter, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from integration_settings import GROUPS, IntegrationSettings, install_integration_settings


class Collection:
    def __init__(self): self.docs = {}
    def find(self, query):
        async def to_list(length): return list(self.docs.values())[:length]
        return SimpleNamespace(to_list=to_list)
    async def find_one(self, query): return self.docs.get(query['_id'])
    async def insert_one(self, doc):
        if doc['_id'] in self.docs: raise DuplicateKeyError('duplicate')
        self.docs[doc['_id']] = dict(doc)
    async def replace_one(self, query, doc):
        previous = self.docs.get(query['_id'])
        matches = previous and previous['revision'] == query['revision']
        if matches: self.docs[doc['_id']] = dict(doc)
        return SimpleNamespace(modified_count=int(bool(matches)))


def make_client(monkeypatch):
    for fields in GROUPS.values():
        for key, _, _ in fields: monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv('SNAR_INTEGRATION_ENCRYPTION_KEY', Fernet.generate_key().decode())
    monkeypatch.setenv('APP_ENV', 'beta')
    collection = Collection()
    db = SimpleNamespace(integration_settings=collection)
    applied, events, verified = [], [], []
    def apply(values):
        import os
        os.environ.update(values)
        applied.append(dict(values))
    async def verify(key):
        verified.append(key)
        return 'acct_verified_test'
    settings = IntegrationSettings(db, apply, verify)
    async def auth(authorization: str = Header(default='')):
        if not authorization: raise HTTPException(401, 'Login required')
        if authorization != 'Bearer superadmin': raise HTTPException(403, 'Superadmin required')
        return {'id': 'admin-id', 'role': 'superadmin'}
    async def audit(*args, **kwargs): events.append(kwargs)
    api = APIRouter(prefix='/api')
    install_integration_settings(api, settings, auth, audit)
    app = FastAPI(); app.include_router(api)
    return TestClient(app), settings, collection, applied, events, verified


AUTH = {'Authorization': 'Bearer superadmin'}
BASE = '/api/admin/control/integration-settings'


def test_secrets_encrypted_and_summary_and_audit_redacted(monkeypatch):
    client, settings, collection, applied, events, _ = make_client(monkeypatch)
    secret = 'private-map-provider-key'
    result = client.put(BASE + '/maps_routing', headers=AUTH, json={'revision': 0, 'values': {'MAPTILER_API_KEY': secret}})
    assert result.status_code == 200
    assert secret not in result.text
    assert secret not in json.dumps(collection.docs)
    assert secret not in json.dumps(events)
    summary = client.get(BASE, headers=AUTH)
    field = summary.json()['groups']['maps_routing']['fields'][0]
    assert field['configured'] is True and field['value'] is None
    assert secret not in summary.text
    assert settings.decode(collection.docs['maps_routing'])['MAPTILER_API_KEY'] == secret
    assert applied[-1]['MAPTILER_API_KEY'] == secret


@pytest.mark.parametrize('headers,status', [({}, 401), ({'Authorization': 'Bearer admin'}, 403), ({'Authorization': 'Bearer customer'}, 403)])
def test_read_and_write_require_superadmin(monkeypatch, headers, status):
    client, _, collection, _, _, _ = make_client(monkeypatch)
    assert client.get(BASE, headers=headers).status_code == status
    assert client.put(BASE + '/maps_routing', headers=headers, json={'revision': 0, 'values': {'MAPTILER_API_KEY': 'secret'}}).status_code == status
    assert not collection.docs


def test_storage_fails_closed_without_master_key(monkeypatch):
    client, _, collection, _, _, _ = make_client(monkeypatch)
    monkeypatch.delenv('SNAR_INTEGRATION_ENCRYPTION_KEY')
    assert client.get(BASE, headers=AUTH).json()['writable'] is False
    assert client.put(BASE + '/maps_routing', headers=AUTH, json={'revision': 0, 'values': {'MAPTILER_API_KEY': 'secret'}}).status_code == 503
    assert not collection.docs


def test_other_instance_restores_after_restart_and_rotation(monkeypatch):
    client, settings, collection, applied, _, _ = make_client(monkeypatch)
    other_values = []
    other = IntegrationSettings(SimpleNamespace(integration_settings=collection), other_values.append)
    for revision, value in enumerate(['first-secret', 'rotated-secret']):
        assert client.put(BASE + '/maps_routing', headers=AUTH, json={'revision': revision, 'values': {'MAPTILER_API_KEY': value}}).status_code == 200
        asyncio.run(other.refresh())
        assert other_values[-1]['MAPTILER_API_KEY'] == value
    # Restarts have no in-memory revision cache.
    restarted = IntegrationSettings(SimpleNamespace(integration_settings=collection), other_values.append)
    asyncio.run(restarted.refresh())
    assert other_values[-1]['MAPTILER_API_KEY'] == 'rotated-secret'


def test_stale_revision_and_unknown_fields_cannot_overwrite(monkeypatch):
    client, _, collection, applied, _, _ = make_client(monkeypatch)
    payload = {'revision': 0, 'values': {'MAPTILER_API_KEY': 'first-secret'}}
    assert client.put(BASE + '/maps_routing', headers=AUTH, json=payload).status_code == 200
    payload['values']['MAPTILER_API_KEY'] = 'stale-secret'
    assert client.put(BASE + '/maps_routing', headers=AUTH, json=payload).status_code == 409
    assert applied[-1]['MAPTILER_API_KEY'] == 'first-secret'
    assert client.put(BASE + '/maps_routing', headers=AUTH, json={'revision': 1, 'values': {'JWT_SECRET': 'override'}}).status_code == 400
    assert len(applied) == 1


def stripe_payload(mode='test'):
    return {'revision': 0, 'acknowledge_stripe_change': True, 'values': {
        'STRIPE_SECRET_KEY': f'sk_{mode}_private_testfixture',
        'STRIPE_PUBLISHABLE_KEY': f'pk_{mode}_public_testfixture',
        'STRIPE_WEBHOOK_SECRET': 'whsec_private_testfixture'}}


def test_stripe_keys_applied_together_after_verification(monkeypatch):
    client, _, collection, applied, _, verified = make_client(monkeypatch)
    payload = stripe_payload()
    result = client.put(BASE + '/stripe', headers=AUTH, json=payload)
    assert result.status_code == 200 and result.json()['stripe_account_id'] == 'acct_verified_test'
    assert verified == [payload['values']['STRIPE_SECRET_KEY']]
    assert applied == [payload['values']]
    assert 'private_testfixture' not in json.dumps(collection.docs)


@pytest.mark.parametrize('scenario', ['mixed', 'partial', 'live_beta', 'no_ack'])
def test_stripe_invalid_combinations_do_not_change_runtime(monkeypatch, scenario):
    client, _, collection, applied, _, verified = make_client(monkeypatch)
    payload = stripe_payload('live' if scenario == 'live_beta' else 'test')
    if scenario == 'mixed': payload['values']['STRIPE_PUBLISHABLE_KEY'] = 'pk_live_wrongmode'
    if scenario == 'partial': del payload['values']['STRIPE_WEBHOOK_SECRET']
    if scenario == 'no_ack': payload['acknowledge_stripe_change'] = False
    assert client.put(BASE + '/stripe', headers=AUTH, json=payload).status_code == 400
    assert not applied and not collection.docs and not verified


def test_failed_stripe_verification_retains_previous_values(monkeypatch):
    client, settings, collection, applied, _, _ = make_client(monkeypatch)
    async def fail(key): raise HTTPException(400, 'Could not verify')
    settings.verify_stripe = fail
    assert client.put(BASE + '/stripe', headers=AUTH, json=stripe_payload()).status_code == 400
    assert not applied and not collection.docs


def test_server_runtime_keys_update_without_changing_document_storage(monkeypatch):
    import os
    from ai_configuration import configured_ai_key
    source = Path(__file__).resolve().parents[1].joinpath('server.py').read_text()
    function = next(node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef) and node.name == '_apply_integration_settings')
    stripe = SimpleNamespace(api_key='old')
    runtime = {'os': os, 'stripe': stripe, 'EMERGENT_LLM_KEY': 'storage-original', 'APP_ENV':'development', 'configured_ai_key':configured_ai_key,
               'AI_LLM_KEY': 'old-ai', 'MAPTILER_API_KEY': 'old-map', 'STRIPE_WEBHOOK_SECRET': 'old-webhook',
               'FCM_APP': None, 'FCM_INIT_TRIED': True}
    exec(compile(ast.Module(body=[function], type_ignores=[]), 'runtime-update', 'exec'), runtime)
    runtime['_apply_integration_settings']({'STRIPE_SECRET_KEY': 'new-stripe', 'STRIPE_WEBHOOK_SECRET': 'new-webhook',
                                           'SNAR_AI_KEY': 'new-ai', 'MAPTILER_API_KEY': 'new-map'})
    assert stripe.api_key == 'new-stripe' and runtime['STRIPE_WEBHOOK_SECRET'] == 'new-webhook'
    assert runtime['AI_LLM_KEY'] == 'new-ai' and runtime['MAPTILER_API_KEY'] == 'new-map'
    assert runtime['EMERGENT_LLM_KEY'] == 'storage-original'
    monkeypatch.delenv('FCM_SERVICE_ACCOUNT_JSON', raising=False)
    runtime['_apply_integration_settings']({'FCM_SERVICE_ACCOUNT_JSON': '{}'})
    assert runtime['FCM_APP'] is None and runtime['FCM_INIT_TRIED'] is False
