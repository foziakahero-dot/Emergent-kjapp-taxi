# SNAR V10 — Phase 5 execution status — 2026-10-12

## Scope
This record covers only the isolated Phase 5 QA environment. Production, beta production, main, production databases, production Stripe, production push/email/OAuth and production web deployments were not modified.

## Git source
- QA branch: `qa/snar-v10-phase5-staging-e2e`
- Phase 5 safeguard baseline: `819d564383b42f3f329ae23e9e9b5a32dda4dbf4`
- QA-only Android workflow added after the baseline: `phase5-qa-apks.yml`

## MongoDB Atlas QA
- Separate Atlas project exists: `SNAR Phase 5 QA`
- Separate free QA cluster exists: `snar-qa`
- Region: AWS Frankfurt / `EU_CENTRAL_1`
- QA database name: `snar_qa`
- Dedicated database user exists with `readWrite` limited to `snar_qa` and cluster `snar-qa`
- Network access is restricted to Render Frankfurt egress rather than open internet access

No production MongoDB target is used by this QA plan.

## Render QA backend
- Separate service: `snar-api-qa`
- Service id: `srv-db61otlckfvc73bqp480`
- Branch: `qa/snar-v10-phase5-staging-e2e`
- Auto deploy: disabled
- Region: Frankfurt
- Render URL: `https://snar-api-qa.onrender.com`
- Runtime pinned to Python `3.12.7`

### Build result
PASS: Python dependency/build stage succeeds on Python 3.12.7.

The earlier Python 3.14 / Rust/maturin/Cargo-cache build failure is no longer the active blocker.

### Runtime result
BLOCKED: application startup currently fails at import with:

`KeyError: 'MONGO_URL'`

The database URI contains authentication material. The connected automation safety layer does not permit transferring that credential from Atlas into Render. This must not be bypassed or weakened. Once the isolated QA Mongo URI is entered through an authorized secret-entry path, redeploy and run `/api/health` and `/api/ready`.

## Render QA environment already configured
The following non-production settings were applied to the QA service:
- `APP_ENV=qa`
- `DB_NAME=snar_qa`
- `ENABLE_DEMO_DATA=false`
- `KJAPP_AUTO_CHARGE_ENABLED=false`
- `KJAPP_DRIVER_IDENTITY_REQUIRED=false`
- isolated HTTPS web/reset/fleet/checkout origins using the QA Render host
- `TRUST_PROXY=true`
- dedicated QA JWT secret
- `PYTHON_VERSION=3.12.7`

Secret values are intentionally not recorded in this document.

## Stripe
A connected Stripe sandbox/test account is available. No live-mode payment, payout or webhook action was performed. The repository QA guard rejects live or unknown Stripe key modes.

Test-mode secret configuration remains a readiness item if required by the exercised payment path. No production Stripe key is permitted in this environment.

## Android QA builds
Customer and Driver `eas.json` QA profiles both target exactly:

`https://api-qa.snarapp.no`

A QA-only GitHub workflow was added at:

`.github/workflows/phase5-qa-apks.yml`

It:
- is restricted to the Phase 5 QA branch
- sets `EAS_BUILD_PROFILE=qa`
- sets `EXPO_PUBLIC_BACKEND_URL=https://api-qa.snarapp.no`
- runs the Phase 5 QA URL guard
- type-checks Customer and Driver
- performs Expo Android prebuild
- builds separate arm64 release APKs locally with Gradle
- uploads `SNAR-Customer-QA` and `SNAR-Driver-QA` artifacts

The connected GitHub integration does not expose workflow dispatch, and integration-authored commits do not provide evidence that the workflow executed. Therefore APK artifacts are not marked PASS until an actual workflow run exists and artifacts are inspected.

## DNS
The repository's locked QA mobile profiles expect `https://api-qa.snarapp.no`. The Render QA service exists, but canonical QA DNS has not been certified in this execution. Do not weaken the mobile QA URL guard by changing the apps to a production URL.

## E2E certification state
Not yet eligible for GO.

Still requiring runtime evidence:
1. Authorized QA `MONGO_URL` secret entry on `snar-api-qa`.
2. Successful QA backend deploy.
3. `/api/health` and `/api/ready` PASS.
4. Canonical `api-qa.snarapp.no` routing/certificate verification.
5. Stripe test-mode configuration for payment-path testing, with auto charge/payout safeguards preserved.
6. Actual Customer QA APK artifact.
7. Actual Driver QA APK artifact.
8. Physical/API E2E: customer request -> driver accept -> pickup -> start -> complete -> test payment -> receipt -> driver earnings.
9. Concurrent two-driver accept test.
10. Restart/recovery test.

## Safety statement
No production deploy, production database mutation, production payment/payout, production push/email/OAuth call, main merge or production mobile build was performed during this execution.
