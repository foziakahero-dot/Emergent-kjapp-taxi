# Phase 5 Staging Architecture Audit

## Updated continuation — 2026-10-12

The current evidence is [PHASE5_CONTINUATION_2026-10-12.md](PHASE5_CONTINUATION_2026-10-12.md). The separate Render service and Atlas QA cluster now exist. Six synthetic users, three vehicles and one Fleet are seeded and verified in snar_qa. Render startup is blocked by missing MONGO_URL; canonical DNS/TLS and Stripe isolation are incomplete. No QA APK or physical/device E2E result exists. Code gates passed: 323 backend tests plus 7 subtests, both TypeScript checks, Customer design verification, 4 Driver tests, 12 QA guard tests, and 0 unmapped API calls. Final decision remains NO-GO for controlled beta.

## Historical pre-provisioning evidence

The original report below is retained for provenance; its resource-availability statements are superseded by the dated update above. Its physical QA statuses and visual carry-forward counts remain unchanged.


**Status: BLOCKED before external provisioning.** Repository-side QA safeguards and build profiles are prepared on `qa/snar-v10-phase5-staging-e2e`; no QA service, database, DNS record, EAS build, or provider transaction was created.

**Baseline:** Phase 4 `7382f1a1fd25757003b01151a328834b89e33373`
**Target API:** `https://api-qa.snarapp.no`
**Production API:** `https://api.kjappapp.no` — not contacted or modified.

## Hosting and runtime facts found

| Area | Repository evidence | Finding |
|---|---|---|
| Backend | `backend/server.py`; FastAPI application object `app` | Backend root is `backend`. `MONGO_URL` and `DB_NAME` are required at import/startup. |
| Runtime dependencies | `backend/requirements-render.txt`, which includes `requirements-ci.txt`, `uvicorn==0.32.1`, and provider packages | Render-oriented dependency file exists, but it does not prove the active production host. |
| Deployment definition | No tracked `render.yaml`, Dockerfile, Procfile, Fly, Railway, or service ID/config was found | Authoritative production hosting and start command cannot be established from this checkout. A typical `uvicorn server:app --host 0.0.0.0 --port $PORT` command is an inference, not verified deployment configuration. |
| Python | CI config uses Python 3.12 | Production host runtime version is unknown. |
| Database | `MONGO_URL`, `DB_NAME` in `backend/server.py` and `backend/.env.example` | No local runtime Mongo variables or QA database credentials are available. Production connection details were not read. |
| Environment selector | Backend reads `APP_ENV`; it does not use `ENVIRONMENT` | QA must set `APP_ENV=qa`. Demo data remains disabled in QA. |
| Health/readiness | Router exposes `/api/health` and `/api/ready`; `backend/scripts/release_smoke.py` calls `/api/ready` | Liveness checks Mongo ping. Readiness checks required runtime configuration and Mongo only. Both routes were not called because the QA hostname does not resolve. |
| EAS projects | Customer and Driver project IDs in their `app.json`; authenticated EAS owner session available | Existing EAS project access exists, but no QA backend or provider-isolated EAS project exists. |

The app clients previously defaulted to the production API. New QA EAS profiles explicitly set the approved QA URL and `scripts/phase5-qa-build-guard.cjs` rejects any other QA target. Existing profiles were not changed. QA app labels include `QA BACKEND`; current package IDs remain `no.kjapp.app` and `no.kjapp.driver` because separate provider registrations/signing were not verified.

## Isolation implementation

- `backend/qa_safety.py` makes `APP_ENV=qa` fail startup unless `DB_NAME` contains a QA namespace marker, rejects known production database names and Mongo hosts clearly labelled production, and rejects live/unknown Stripe secret or publishable key modes. Errors never include connection strings or key values.
- The QA readiness contract requires the QA environment, QA database name, test-mode Stripe secret and webhook configuration, and an explicit isolated HTTPS web origin. Automatic charging must remain disabled.
- QA CORS is restricted to native local origins and the configured isolated HTTPS frontend; it does not include the production web-origin list or wildcard fallback.
- Production public-web URLs are not used as QA defaults. Password-reset email, all external email delivery, Google/Apple identity exchange, and all push delivery are disabled in QA until separately isolated provider configuration is implemented and verified.
- Live-mode Stripe webhook events are rejected in QA. Credentials loaded later from QA integration-settings storage are checked before application.
- QA Customer and Driver Expo configs ignore shared `GOOGLE_SERVICES_JSON` file variables so the preview Firebase service file is not embedded in QA APKs. They do not use Supabase code paths.

These controls prevent accidental use of key shared production integrations; they do **not** prove that an external Mongo URI, Stripe webhook secret, map token, or provider project supplied later is QA-owned. Those resources must be independently provisioned and verified.

## Access and resource inventory

| Resource / secret | Status | Evidence |
|---|---|---|
| `api-qa.snarapp.no` DNS | **MISSING** | DNS lookup returned no record at audit time. No DNS record was changed. |
| QA backend service | **MISSING / UNKNOWN** | No Render CLI, deployment manifest, service ID, or provider token name was present. Active production host cannot be inferred. |
| QA Mongo URI and `snar_qa` database | **MISSING** | No `MONGO_URL`/`DB_NAME` runtime environment variables or local credentials. No local Mongo daemon or interactive shell (`mongod`/`mongosh`) was available. |
| QA JWT/admin secrets | **MISSING** | No local QA secret variables. A secure service-side secret store must supply these; values are not requested in chat or written to Git. |
| Stripe test secret/publishable/webhook keys | **MISSING** | No Stripe runtime variables. QA-only keys must be placed in the QA service secret store. No live Stripe call occurred. |
| EAS access | **PRESENT** | `eas whoami` confirms an authenticated owner session. No EAS variable values were printed. |
| EAS `GOOGLE_SERVICES_JSON` variable name | **PRESENT; value/project UNKNOWN** | Name occurs in both apps’ shared EAS environments; QA Expo config now ignores it. |
| EAS Mapbox public token variable names | **PRESENT; scope/terms UNKNOWN** | Public variable names occur in both apps’ shared EAS environments. Map calls are read-only, but allowed scope/provider terms were not verified. |
| Driver EAS Supabase variable names | **PRESENT; not used by source** | Names occur in shared EAS environments; no Driver source references to these variables were found. No Supabase call was made. |
| Google / Apple QA OAuth | **MISSING / BLOCKED** | No separate QA client/bundle registration was verified. QA backend routes explicitly refuse these provider exchanges. |
| Firebase/FCM QA project | **UNKNOWN / BLOCKED** | Shared EAS service-file variable exists but its value/project was not read; QA build omits that file and push delivery is disabled. |
| SendGrid QA mail sink | **MISSING / BLOCKED** | QA backend suppresses all external email; no QA mail provider or recipient allowlist exists. |
| Twilio/SMS | **NOT REQUIRED FOR INITIAL QA / BLOCKED** | No Twilio integration/configuration was found. SMS OTP has no certified API contract. |
| AI/object-storage provider | **BLOCKED in QA** | Emergent/AI keys are not used by QA runtime code paths; QA documents use the QA Mongo-backed storage path. |

No secret values were displayed, copied, or committed. No existing production values were changed.

## Provider disposition

| Provider | Phase 5 classification | Boundary |
|---|---|---|
| Stripe | **REQUIRES QA CREDENTIAL** | Only `sk_test_` / `rk_test_` and matching `pk_test_` are accepted. Test webhook secret must be configured on the QA endpoint. Live-mode events are rejected. No charge, Connect account, or payout was attempted. |
| Firebase / FCM / Expo Push | **BLOCKED** | QA ignores the shared Firebase service file and suppresses outbound push. A dedicated QA project and explicit test-device allowlist are required. |
| Google / Apple | **BLOCKED** | QA backend rejects provider exchange/link routes until QA-specific OAuth registrations and credentials exist. |
| SendGrid / email | **BLOCKED** | All QA external email is suppressed; configure a mail sink/QA allowlist before email QA. |
| Twilio / SMS | **NOT REQUIRED FOR INITIAL QA** | Not configured or used by this repo; OTP flows are not certified. |
| Mapbox / MapTiler | **UNKNOWN; read-only only** | Map token names exist in shared EAS environments; values/scopes/terms were not inspected. No provider requests were made. |
| Supabase | **NOT USED** | Driver shared EAS variable names exist but no corresponding source use was found; no Supabase access was made. |
| Emergent AI / object storage | **BLOCKED in QA** | QA disables shared AI/storage credentials; no such QA credential exists. |

## Required external prerequisites

1. Identify the actual hosting provider and authorize a new QA-only service; do not point to or edit the production service.
2. Provision a separate Mongo QA database/namespace, preferably on a separate cluster, and securely inject its URI with `DB_NAME=snar_qa`.
3. Create only the QA DNS record for `api-qa.snarapp.no` to the new service. Do not change production DNS.
4. Supply a Stripe test-mode secret, publishable key and QA-endpoint webhook secret through the QA service secret store. Do not supply live keys.
5. Supply an isolated HTTPS web origin and configure `FRONTEND_URL`, `KJAPP_PUBLIC_WEB_ORIGIN`, `PASSWORD_RESET_WEB_BASE`, `FLEET_PUBLIC_URL` and checkout origins consistently. Password/email operations remain disabled in QA code until safe test delivery is provided.
6. Independently verify any shared Mapbox token's read-only scopes/terms before map/network visual QA.

Until those prerequisites exist, staging deployment, QA data seeding, QA APK generation and QA01–QA28 device/provider execution remain blocked.

