# SNAR Phase 5 continuation — 2026-10-12

Decision: **NO-GO for controlled beta.** The isolated database is provisioned and seeded; the backend cannot start without its QA Mongo credential. The QA CNAME now resolves correctly and Render shows Verified / Certificate Issued. Missing Mongo configuration and isolated Stripe readiness still block builds and live QA.

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
| Latest observed deploy | `dep-db6d1g59fdbs73fnacpg`, commit `7045e397ba02e6b550f6c389c4533e7905610d89`, `update_failed` |
| Runtime blocker | `KeyError: 'MONGO_URL'` |
| Canonical API | https://api-qa.snarapp.no |
| Domain verification | Verified after Uniweb CNAME was added and Render Verify was clicked |
| TLS | Render shows Certificate Issued; healthy API response is still unavailable |
| Required DNS record | CNAME host `api-qa`, target `snar-api-qa.onrender.com` |
| DNS evidence | User reported Uniweb created the record; Google DNS CNAME answer confirms the exact target, TTL 3600 |
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

The initial non-secret Render environment update automatically initiated a QA-only deploy. A later QA-only deployment of 7045e39 also built successfully but failed on missing MONGO_URL, as recorded in the afternoon evidence below.

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
2. DNS and Render certificate setup are complete. Require a healthy direct HTTPS response from the canonical QA host before allowing builds.
3. Configure isolated Stripe sandbox credentials and a QA webhook on the existing route `/api/stripe/webhook`. Resolve sandbox events still routed to non-QA endpoints before generating test payments. Do not change live mode.
4. Deploy QA successfully; require both health and readiness to pass. Keep automatic charging off.
5. Resolve GitHub Actions account payment/spending restriction or use the already authorized local/EAS QA build path after infrastructure passes.
6. Build and inspect both QA artifacts, then run real synthetic E2E/device QA, receipts, earnings, concurrency, recovery and screenshot comparison.

FCM/push, email, Google/Apple OAuth, AI and identity provider actions remain blocked/suppressed. Twilio is not configured. Mapbox token scopes remain unverified. Supabase was not used.

## Production protection

Production database and backend untouched. No Stripe live transaction, real payout, production push/SMS/email, production DNS update, production deployment, main merge, OTA, store publication or TestFlight submission occurred. No production rollout was started.

## Afternoon resume — 2026-10-12, Europe/Oslo

- User reported that the QA password had been added.
- A QA-only deploy was triggered on `snar-api-qa` for `7045e397ba02e6b550f6c389c4533e7905610d89`.
- Deploy ID: `dep-db6d1g59fdbs73fnacpg`.
- Dependency build: PASS. Runtime: `update_failed`, with `KeyError: 'MONGO_URL'` at 12:22:56 UTC.
- A fresh authenticated Render environment page was inspected: MONGO_URL is absent from the saved variable names. No stored secret values were exposed.
- Authoritative DNS lookup confirms `ns01.no.brand.one.com` and `ns02.no.brand.one.com`; these are Uniweb's documented nameservers. Norid registrar is GROUP.ONE NORWAY AS.
- QA CNAME lookup returned DNS status 3 (NXDOMAIN), with no answer.
- Render still shows Waiting for DNS / Waiting for Verification.
- The user was given the exact new DNS record: CNAME name `api-qa`, target `snar-api-qa.onrender.com`, default TTL. It must be added only inside the snarapp.no zone.
- Stripe sandbox webhook inventory is unchanged: production API and legacy Base44 destinations are still enabled; no QA payment or webhook delivery was generated.
- Latest observed GitHub run for 7045e39: `38190571430`, startup_failure. No new APK artifact was produced.
- No application source changes or new regression run were needed for this resume; earlier certified test results above remain carry-forward evidence.
- Production remains untouched.

Next required step is direct saving of the complete QA Mongo connection string as MONGO_URL on the existing QA Render service. Setting the Atlas password alone does not configure the backend environment. The canonical HTTPS health/readiness gates and isolated Stripe setup must pass before QA APK builds and E2E payment tests.

## DNS completion after Uniweb confirmation — 2026-10-12

- User supplied Aida's 14:36 confirmation that the new QA CNAME was added.
- Independent Google DNS query returns status 0: `api-qa.snarapp.no.` CNAME `snar-api-qa.onrender.com.`, TTL 3600. The A query also resolves the CNAME chain.
- Clicked Verify on the existing QA domain in Render. The domain reached Verified; certificate status progressed to Certificate Issued, confirmed on the service's Custom Domains page.
- Canonical `/api/health` and `/api/ready` checks still do not return a healthy API response. The deployment remains update_failed because the saved QA environment has no MONGO_URL.
- Only saved environment variable names were checked; no stored credential values were read. A new unsaved MONGO_URL row is prepared with the QA cluster's non-secret URI template and `<db_password>` placeholder. It must not be saved until the authorized human replaces the placeholder with the correct credential.
- No new deployment was started after DNS verification. Stripe isolation, runner restriction and physical QA blockers are unchanged. Production resources were not changed.
