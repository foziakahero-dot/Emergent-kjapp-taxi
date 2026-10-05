#!/usr/bin/env bash
# Source checks only: no native compilation, EAS build, live DB or payment calls.
set -euo pipefail
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$task_root"
export CI=1
export EXPO_PUBLIC_BACKEND_URL=https://api.kjappapp.no
export APP_ENV=test
export ENABLE_DEMO_DATA=false
export MONGO_URL=mongodb://127.0.0.1:27017
export DB_NAME=snar_isolated_source_tests
unset STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET SENDGRID_API_KEY

python3 -m venv /tmp/snar-customer-validation-venv
/tmp/snar-customer-validation-venv/bin/python -m pip install -r backend/requirements-ci.txt
/tmp/snar-customer-validation-venv/bin/python -m pytest \
  backend/tests/test_mobile_commerce.py \
  backend/tests/test_customer_profile.py \
  backend/tests/test_security_regressions_unit.py -q

cd frontend
npm ci --no-audit --no-fund
npx tsc --noEmit
npm run test:design
npx expo-doctor@latest
npm run audit:customer
npx expo export --platform android --output-dir /tmp/snar-customer-android-source
npx expo export --platform ios --output-dir /tmp/snar-customer-ios-source
cd "$task_root"

# Live configuration checks are read-only and output booleans, never key values.
python3 scripts/customer-public-config-smoke.py

# Publish only a minimal validation result, never source bundles or private data.
python3 - <<'PY'
import json, os
from pathlib import Path
contracts = json.loads(Path('docs/CUSTOMER_API_CONTRACT_20261004.json').read_text())
assert contracts and all(row['backend'] for row in contracts), 'Unmapped API contract'
gate = json.loads(Path('frontend/customer-build-gate.json').read_text())
assert gate['customerBuildAuthorized'] is False, 'Source validation cannot authorize a native build'
out = Path('customer-validation-out')
out.mkdir(exist_ok=True)
result = {'sourceValidation': 'PASS', 'commit': os.getenv('RENDER_GIT_COMMIT', ''),
          'checks': ['47 focused backend tests', 'Customer TypeScript', 'component tests',
                     'Expo Doctor', 'source API mapping', 'Android Hermes export', 'iOS Hermes export'],
          'nativeBuildAuthorized': False, 'physicalDeviceAcceptance': 'UNVERIFIED'}
(out/'result.json').write_text(json.dumps(result, indent=2)+'\n')
(out/'index.html').write_text('<!doctype html><html lang="nb"><meta charset="utf-8"><title>SNAR kildekontroll</title><main><h1>SNAR Customer: kildekontroll bestått</h1><p>TypeScript, komponenttester, isolerte backendtester og Android/iOS-kildeeksport er kontrollert.</p><p>Fysisk app-testing gjenstår. APK/TestFlight er ikke godkjent eller bygget.</p></main></html>')
print('SNAR_CUSTOMER_SOURCE_VALIDATION_PASS; NATIVE_BUILD_BLOCKED')
PY
