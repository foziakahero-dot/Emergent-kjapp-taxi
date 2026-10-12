# SNAR Phase 5 continuation — 2026-10-12

Decision: **NO-GO for controlled beta.** The isolated database is provisioned and seeded; the backend cannot start without its QA Mongo credential. Canonical DNS/TLS and isolated Stripe configuration still block builds and live QA.

## Source and new changes

- Branch: `qa/snar-v10-phase5-staging-e2e`.
- Prior latest head: `7e801753c8b31ea6ff35e68e57e45323521b4966` (two commits after `819d564383b42f3f329ae23e9e9b5a32dda4dbf4`).
- Python 3.12.7 was already configured; dependency build succeeds.
- The CLI URL guard previously only exported a function, so invoking it directly did no validation. It now rejects non-QA profiles and any target other than the approved exact HTTPS origin.
- APK workflow now requires canonical DNS/TLS, Mongo health, QA isolation, Stripe test mode, no readiness blockers and auto-charge off before either build. It rejects redirects and checks again before each app build.
- Workflow dispatch on another branch cannot run QA jobs.
- APK copy/upload paths now agree; SHA256 and source/run/API evidence accompany each artifact.
- No application UI or backend business logic was changed.

## Live infrastructure evidence

| Item | Verified result |
|---|---|
| Render service | `snar-api-qa` |
| Render ID | `srv-db61otlckfvc73bqp480` |
| Render host | https://snar-api-qa.onrender.com |
| Render workspace / region | `tea-dassqnrbc2fs73a770i0` / Frankfurt |
| Runtime | Python 3.12.7; dependency build PASS |
| Latest observed deploy | `dep-db630aijnfac73c7oj4g`, commit `7e801753c8b31ea6ff35e68e57e45323521b4966`, `update_failed` |
| Runtime blocker | `KeyError: 'MONGO_URL'` |
| Canonical API | https://api-qa.snarapp.no |
| Domain verification | Render retry returned Verification Error / Waiting for DNS |
| TLS | Waiting for Verification; NOT certified |
| Required DNS record | CNAME host `api-qa`, target `snar-api-qa.onrender.com` |
| DNS access | No connected authoritative DNS editor was available; provider not independently confirmed |
| Atlas project | `SNAR Phase 5 QA`, `6acc26dd5baf02c7edfe0f92` |
| Cluster | `snar-qa`, `6acc27266b2b9c24df70b88c`, AWS EU_CENTRAL_1, IDLE |
| Database | `snar_qa` |
| QA DB user | `snar_qa_render`, readWrite only on `snar_qa`, scoped to `snar-qa` |
| QA network | Render Frankfurt CIDRs only; no world-open rule was added |
| Safe settings added | `KJAPP_SERVICE_AREA_ENFORCE=true`, `ADMIN_EMAIL=qa.admin@example.com` |
| Existing safety settings | APP_ENV=qa, DB_NAME=snar_qa, demo disabled, automatic charging disabled, isolated web origins, QA JWT, Python pin |
| Missing Render keys | MONGO_URL, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET |
| Stripe account | `Kjappapp sandbox`, `acct_1TG3m12eKdaX7ani`, livemode=false |
| Stripe isolation | BLOCKED: enabled sandbox webhooks still target production API and legacy Base44 services. No QA payment events were generated. |
| GitHub runner | Run `38189296640` reports recent account payments failed or spending limit needs increasing. No billing setting was changed. |

The automatic security review rejected the earlier Mongo/JWT credential transfer into Render. This continuation did not repeat that transfer or route the credential through the browser. The QA Mongo URI must be entered through an authorized human secret-entry path. Do not paste it in chat or commit it.

The non-secret Render environment update automatically initiated a QA-only deploy. The deployment result and missing-MONGO_URL failure above were inspected; no extra manual deployment was issued.

## Synthetic QA database seed

Seeded via the Atlas connection to the independently verified QA cluster, without transferring its database credential. Preflight found the fixture collections empty. BSON object IDs and binary document storage were verified afterward.

| Collection | Synthetic records |
|---|---:|
| users | 6 |
| fleets | 1 |
| fleet_vehicles | 3 |
| uploaded_files | 18 |
| document_blobs | 18 |
| platform_settings | 1 |
| places | 2 |

- QA Customer 01–03 and QA Driver 01–03.
- All three Drivers are approved, offline, and each has exactly one assigned vehicle.
- One synthetic Fleet, Oslo locations, repository pricing defaults and supported ride classes.
- Identity/document fixtures are explicitly synthetic, not real provider verification or licences.
- Password hashes are stored in the QA database. The private password handoff remains outside the repository with private permissions; no passwords are committed here.
- Reproducible seed tooling remains `scripts/seed-snar-qa.py`, which refuses a non-QA database, preflights collisions and uses insert-only upserts.

## Code verification in this continuation

| Check | Result |
|---|---|
| Certified backend boundary + Phase 5 QA tests | 320 passed + 7 subtests across 29 modules |
| Additional beta waitlist admin module | 3 passed |
| Backend combined executed total | **323 passed + 7 subtests, 0 failed** across 30 modules |
| Backend compilation | PASS |
| Network boundary | Socket connections disabled for unit tests; no production connections |
| Customer TypeScript | PASS |
| Driver TypeScript | PASS |
| Customer design verification | PASS |
| Driver trip summary suite | 4 passed |
| QA URL + backend preflight tests | 12 passed |
| Workflow validation | YAML parse and all run-block bash syntax PASS |
| Artifact path execution simulation | Both apps PASS; upload files actually created at expected root paths |
| Customer API audit | 241 routes / 83 contracts / 0 unmapped |
| Driver API audit | 61/61 mapped / 0 unmapped |

This is a certified local regression boundary, not the complete legacy network integration suite and not device/provider certification.

## QA APK and E2E evidence

| Item | Result |
|---|---|
| Customer QA build ID / APK | NOT BUILT / no artifact URL |
| Driver QA build ID / APK | NOT BUILT / no artifact URL |
| Both QA profile targets | Exactly https://api-qa.snarapp.no; runtime APK verification NOT RUN |
| QA01–QA28 | PASS 0 / FAIL 0 / BLOCKED 28 / NOT RUN 0 |
| Complete synthetic ride | BLOCKED — backend runtime, Stripe and builds unavailable |
| Two-Driver acceptance | Runtime/device BLOCKED; code concurrency contracts PASS |
| Restart/recovery | Device BLOCKED; covered code contracts PASS |
| Customer receipt | Device/provider BLOCKED; covered code contracts PASS |
| Driver earnings | Device/provider BLOCKED; covered code contracts PASS |
| Phase 5 native visual captures | 0 |
| Visual carry-forward | MATCHED 0 / PARTIAL 5 / BLOCKED 60 / NOT RUN 2 |

Customer/Driver package identities and native provider registration remain the previously recorded baseline; no APK package/version verification can be claimed without an artifact.

## Remaining actions

1. Authorized human entry of the QA-only MONGO_URL on the existing Render QA service. Keep DB_NAME=snar_qa and APP_ENV=qa.
2. Add/verify only the api-qa CNAME with the authoritative DNS provider; then verify valid TLS.
3. Configure isolated Stripe sandbox credentials and a QA webhook on the existing route `/api/stripe/webhook`. Resolve sandbox events still routed to non-QA endpoints before generating test payments. Do not change live mode.
4. Deploy QA successfully; require both health and readiness to pass. Keep automatic charging off.
5. Resolve GitHub Actions account payment/spending restriction or use the already authorized local/EAS QA build path after infrastructure passes.
6. Build and inspect both QA artifacts, then run real synthetic E2E/device QA, receipts, earnings, concurrency, recovery and screenshot comparison.

FCM/push, email, Google/Apple OAuth, AI and identity provider actions remain blocked/suppressed. Twilio is not configured. Mapbox token scopes remain unverified. Supabase was not used.

## Production protection

Production database and backend untouched. No Stripe live transaction, real payout, production push/SMS/email, production DNS update, production deployment, main merge, OTA, store publication or TestFlight submission occurred. No production rollout was started.
