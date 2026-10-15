"""Synthetic QA-only flow. Creates two customers, one unconfirmed Stripe test
SetupIntent and one support ticket; never charges, confirms a card or sends mail.
Passwords, bearer tokens and Stripe client secrets remain in memory only.
"""
import json
import secrets
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = 'https://api-qa.snarapp.no/api'
checks = []


def call(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(BASE + path, method=method, headers=headers,
                                    data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def expect(name, status, expected, **safe):
    assert status == expected, f'{name}: HTTP {status}, expected {expected}'
    checks.append({'check': name, 'status': status, **safe})


status, ready = call('GET', '/ready')
expect('isolated QA readiness', status, 200)
assert ready['checks']['qa_mode'] and ready['checks']['qa_database_isolated']
assert ready['checks']['stripe_test_mode_configured'] and not ready['checks']['production_mode']
assert not ready['checks']['auto_charge_enabled']

tokens = []
for _ in range(2):
    password = secrets.token_urlsafe(28)
    email = 'qa-flow-' + secrets.token_hex(8) + '@example.invalid'
    status, registered = call('POST', '/auth/register', {
        'fullName': 'Synthetic QA flow', 'email': email, 'password': password, 'accepted_terms': True})
    expect('synthetic customer registration', status, 200)
    assert registered['user']['role'] == 'user'
    token = registered['token']
    tokens.append(token)
    status, logged_in = call('POST', '/auth/login', {'email': email, 'password': password, 'client': 'customer'})
    expect('customer login', status, 200)
    assert logged_in['user']['id'] == registered['user']['id']
    status, _ = call('POST', '/auth/logout', {}, logged_in['token'])
    expect('login session logout', status, 200)
    # Logout revokes this token; obtain a fresh session for the flow.
    status, logged_in = call('POST', '/auth/login', {'email': email, 'password': password, 'client': 'customer'})
    expect('customer relogin', status, 200)
    tokens[-1] = logged_in['token']

for path in ['/admin/overview', '/admin/support/tickets', '/fleet/me', '/fleet/overview']:
    status, _ = call('GET', path, token=tokens[0])
    expect('customer denied ' + path, status, 403)

status, setup = call('POST', '/payments/native/setup-intent', {}, tokens[0])
expect('Stripe test SetupIntent creation', status, 200)
setup_id = setup['setup_intent_id']
assert setup_id.startswith('seti_') and setup.get('client_secret')
status, pending = call('GET', '/payments/native/setup-intent/' + setup_id, token=tokens[0])
expect('unconfirmed setup remains pending', status, 200)
assert pending['ready'] is False and pending['status'] == 'requires_payment_method'
status, _ = call('GET', '/payments/native/setup-intent/' + setup_id, token=tokens[1])
expect('other customer denied setup', status, 404)

status, ai = call('POST', '/ai/chat', {'message': 'Synthetic QA availability check', 'session_id': 'qa-flow'}, tokens[0])
expect('unconfigured AI fails explicitly', status, 503)
status, ticket = call('POST', '/support/public', {
    'topic': 'annet', 'name': 'Synthetic QA flow', 'contact': 'qa-flow@example.invalid',
    'message': 'Synthetic QA support persistence check; no reply required.'})
expect('human support accepted without AI', status, 201, ticket_id=ticket['ticket_id'])

for token in tokens:
    status, _ = call('POST', '/auth/logout', {}, token)
    expect('flow session logout', status, 200)
    status, _ = call('GET', '/auth/me', token=token)
    expect('revoked session rejected', status, 401)

out = Path('evidence/2026-10-16')
out.mkdir(parents=True, exist_ok=True)
evidence = {'time': datetime.now(timezone.utc).isoformat(), 'api': BASE,
            'checks': checks, 'limitations': ['No card confirmation or charge',
            'No real email delivery or AI reply', 'Support Admin readback needs staff login',
            'No mobile build or physical-device test']}
(out / 'qa-server-flow.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(json.dumps(evidence, indent=2))
