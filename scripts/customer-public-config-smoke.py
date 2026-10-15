"""Read-only live config verification; never outputs API keys or creates payments."""
import json
import urllib.request
from pathlib import Path

base = 'https://api-qa.snarapp.no/api'
results = []
for path in ['/health', '/ready', '/payments/native/config', '/auth/native/config']:
    with urllib.request.urlopen(base + path, timeout=30) as response:
        body = json.load(response)
        if path == '/health':
            safe = {'status': body.get('status'), 'db': body.get('db')}
            assert safe['status'] == 'ok' and safe['db'] is True
        elif path == '/ready':
            safe = {'ready': body.get('ready'), 'blockers': body.get('blockers'),
                    'stripe_key_configured': body.get('checks', {}).get('stripe_key_configured'),
                    'email_configured': body.get('checks', {}).get('email_configured')}
        elif path == '/payments/native/config':
            safe = {'enabled': body.get('enabled'), 'test_mode': body.get('test_mode'),
                    'test_publishable_key_present': str(body.get('publishable_key', '')).startswith('pk_test_'),
                    'google_pay_enabled': body.get('google_pay_enabled'),
                    'apple_merchant_present': bool(body.get('apple_merchant_id'))}
            assert safe['enabled'] is True and safe['test_mode'] is True and safe['test_publishable_key_present']
            # Wallet availability is explicit provider/device configuration, not
            # implied by a working Stripe test key.
        else:
            safe = {'google_enabled': body.get('google_enabled'),
                    'google_web_client_present': bool(body.get('google_web_client_id')),
                    'google_ios_client_present': bool(body.get('google_ios_client_id'))}
        results.append({'path': path, 'status': response.status, 'body': safe})

out = Path('customer-validation-out')
out.mkdir(exist_ok=True)
(out/'native-config-smoke.json').write_text(json.dumps(results, indent=2)+'\n')
print('SNAR_PUBLIC_CONFIG_SMOKE ' + json.dumps(results))
