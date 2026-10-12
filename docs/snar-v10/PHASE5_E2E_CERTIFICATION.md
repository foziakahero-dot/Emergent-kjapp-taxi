# Phase 5 Safe Staging / Functional E2E Certification

## Updated continuation — 2026-10-12

The current evidence is [PHASE5_CONTINUATION_2026-10-12.md](PHASE5_CONTINUATION_2026-10-12.md). The separate Render service and Atlas QA cluster now exist. Six synthetic users, three vehicles and one Fleet are seeded and verified in snar_qa. QA deployment, Mongo authentication and canonical HTTPS health now pass; 34 live synthetic API auth/profile/vehicle/RBAC/logout checks passed (0 failed). Stripe readiness still blocks builds and full E2E; the QA CNAME is confirmed, and Render shows Verified / Certificate Issued. API health/readiness and Stripe isolation remain blocked. No QA APK or physical/device E2E result exists. Code gates passed: 323 backend tests plus 7 subtests, both TypeScript checks, Customer design verification, 4 Driver tests, 12 QA guard tests, and 0 unmapped API calls. Final decision remains NO-GO for controlled beta.

## Historical pre-provisioning evidence

The original report below is retained for provenance; its resource-availability statements are superseded by the dated update above. Its physical QA statuses and visual carry-forward counts remain unchanged.


**Decision: NO-GO for controlled beta.** Phase 5 repository safeguards and QA build profiles are prepared, but an isolated backend, database, QA DNS, Stripe test configuration and QA APKs were not available. No functional/device E2E flow was attempted.

## Environment and safety

- Intended staging API: `https://api-qa.snarapp.no` — DNS unresolved during this run.
- QA backend service: **NOT PROVISIONED / UNKNOWN provider**.
- Separate QA Mongo database: **NOT PROVISIONED**.
- Stripe: **NO QA credentials**; code rejects live-mode keys/events.
- Google/Apple, FCM/push and email: **BLOCKED** pending isolated provider configuration; QA code disables these outbound paths.
- Mapbox: public token variable names exist in EAS, but scope/terms are **UNKNOWN**.
- EAS QA builds: profiles configured, builds **NOT RUN**.
- Production safety: no production API/database request, migration, deployment, environment change, DNS change, payment, payout, push, email or provider transaction occurred.

## QA01–QA28

| Result | Count |
|---|---:|
| PASS | 0 |
| FAIL | 0 |
| BLOCKED | 28 |
| NOT RUN | 0 |

The check-by-check reasons are in `PHASE5_PHYSICAL_QA_MATRIX.md`. Build-guard and code-level tests are not physical QA and do not change these statuses.

## Required E2E outcomes

| Scenario | Result | Evidence |
|---|---|---|
| Core synthetic Customer → Driver ride | **BLOCKED** | No QA service/database/build or Stripe test credentials. |
| Two-Driver near-simultaneous accept | **BLOCKED** | No QA trip or synthetic Drivers. Existing backend concurrency regression tests are not device evidence. |
| Customer/Driver restart and recovery | **BLOCKED** | No active QA trip/build. |
| Customer receipt | **BLOCKED** | No completed paid test trip. |
| Driver earnings | **BLOCKED** | No completed paid test trip. |
| Real payout | **NOT RUN / PROHIBITED** | No payout action is authorized. |
| Expanded native visual QA | **BLOCKED** | No QA APKs or safe backend state; Phase 4 screenshot counts remain carry-forward only. |

## Code gate evidence

After the Phase 5 code changes:

- Focused backend QA, QA isolation/provider, integration-settings, payment, reservation, search, cancellation, dispatch, settlement and internal-ride tests: **102 passed, 7 subtests passed, 0 failed** across 10 test modules. This final run includes the Phase 5 provider/config hardening.
- Backend compile: `python -m compileall -q backend` — **PASS**.
- Complete `python -m pytest -q backend/tests`: **BLOCKED at collection** for eight legacy integration modules requiring `REACT_APP_BACKEND_URL` or `MONGO_URL`. No production URL was supplied and no production connection was attempted. The recorded Phase 2C certified boundary remains historical (**277 passed, 7 subtests, 0 failed across 26 files**); this focused Phase 5 run does not claim to rerun all 26.
- Customer TypeScript: **PASS**; Customer design suite: **PASS**.
- Customer API audit: **241 backend routes / 161 contracts / 0 unmapped**; Customer screen audit: **43 screens**.
- Driver TypeScript: **PASS**; Driver API audit: **61/61 mapped / 0 unmapped**.
- QA URL guard: **PASS, 5 tests**; both Expo QA configs resolve with the exact staging target, reject the production target, and omit the shared Firebase service file.
- `git diff --check`: **PASS**.
- Production code has not been deployed or merged.

## Outstanding prerequisites

1. Provision an actual new QA backend service and isolated Mongo database, then configure only its secure environment.
2. Create the QA DNS record and verify TLS, `/api/health`, and `/api/ready`.
3. Add Stripe test secret/publishable/webhook credentials and a safe isolated HTTPS origin; keep auto-charge off.
4. Obtain provider-specific QA credentials/project registrations before authorizing Google/Apple, push, email, wallets or map-dependent visual checks.
5. Build/install staging-targeted QA APKs, verify manifests/runtime target, then execute physical QA and synthetic E2E flows.

The task cannot receive a `GO FOR CONTROLLED BETA` recommendation without the core ride, test payment, dispatch, receipt and earnings outcomes passing in that isolated environment.

