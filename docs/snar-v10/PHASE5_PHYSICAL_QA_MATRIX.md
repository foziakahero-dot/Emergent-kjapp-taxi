# Phase 5 Physical / Device QA Matrix

## Updated continuation — 2026-10-12

The current evidence is [PHASE5_CONTINUATION_2026-10-12.md](PHASE5_CONTINUATION_2026-10-12.md). The separate Render service and Atlas QA cluster now exist. Six synthetic users, three vehicles and one Fleet are seeded and verified in snar_qa. QA deployment, Mongo authentication and canonical HTTPS health now pass; 34 live synthetic API auth/profile/vehicle/RBAC/logout checks passed (0 failed). Stripe readiness still blocks builds and full E2E; the QA CNAME is confirmed, and Render shows Verified / Certificate Issued. API health/readiness and Stripe isolation remain blocked. No QA APK or physical/device E2E result exists. Code gates passed: 323 backend tests plus 7 subtests, both TypeScript checks, Customer design verification, 4 Driver tests, 12 QA guard tests, and 0 unmapped API calls. Final decision remains NO-GO for controlled beta.

## Historical pre-provisioning evidence

The original report below is retained for provenance; its resource-availability statements are superseded by the dated update above. Its physical QA statuses and visual carry-forward counts remain unchanged.


**Status: NOT EXECUTABLE — QA backend and QA APKs are unavailable.** No QA app was installed or network-enabled. Phase 4 remains static/offline only and is not evidence for Phase 5 backend testing.

Status meanings: PASS/FAIL require executed evidence; BLOCKED means a required isolated service/provider/build is unavailable; NOT RUN means the check could be performed but was not attempted. All 28 Phase 5 checks are **BLOCKED** because there is no resolved QA endpoint, separate test database or QA build.

| ID | Check | Status | Blocker / safe boundary |
|---|---|---|---|
| QA01 | Correct Customer QA build/backend target | BLOCKED | QA profile guard is tested, but no QA artifact or resolved service exists. |
| QA02 | Customer Google sign-in | BLOCKED | No QA OAuth registration/credential; QA backend rejects provider exchange. |
| QA03 | Customer Apple sign-in | BLOCKED | No QA Apple registration/credential; QA backend rejects provider exchange. |
| QA04 | Driver login | BLOCKED | No QA APK or synthetic QA account. |
| QA05 | Runtime permissions | BLOCKED | No QA APK/device session. |
| QA06 | GPS and location freshness | BLOCKED | Requires isolated QA API and synthetic Driver/device location. |
| QA07 | Two Drivers | BLOCKED | No QA database, approved synthetic Drivers or QA APKs. |
| QA08 | Complete Customer-to-Driver trip | BLOCKED | No isolated service/data/builds; no production flow was used. |
| QA09 | Stripe test reservation/SCA | BLOCKED | QA Stripe test secret/publishable/webhook credentials missing. |
| QA10 | Apple Pay / Google Pay sandbox | BLOCKED | QA-specific merchant/OAuth/wallet configuration unavailable. |
| QA11 | Two-Driver accept concurrency | BLOCKED | No QA dispatch service or synthetic trips/Drivers. |
| QA12 | Customer restart/recovery | BLOCKED | No active QA trip/build. |
| QA13 | Driver restart/recovery | BLOCKED | No active QA trip/build. |
| QA14 | Wait-inside / pickup guidance | BLOCKED | Requires supported backend trip and QA run. |
| QA15 | Cancellation / no-show | BLOCKED | No QA synthetic trip. |
| QA16 | Offline/network interruption | BLOCKED | No QA build/service to test. |
| QA17 | Customer ↔ Driver messages | BLOCKED | No QA trip/accounts. |
| QA18 | Support | BLOCKED | No QA service/data; provider delivery unconfigured. |
| QA19 | Selfie/documents | BLOCKED | No QA accounts/storage verification; do not send production files. |
| QA20 | External navigation | BLOCKED | Requires QA trip coordinates and an authorized device run. |
| QA21 | New-trip push | BLOCKED | QA push delivery is deliberately disabled; separate project/device allowlist required. |
| QA22 | Trip-phase push | BLOCKED | QA push delivery is deliberately disabled; separate project/device allowlist required. |
| QA23 | Customer receipt | BLOCKED | No QA completed/paid test trip. |
| QA24 | Email receipt | BLOCKED | QA external email is deliberately disabled; no isolated mail sink. |
| QA25 | Driver earnings | BLOCKED | No QA completed, paid test trip. |
| QA26 | Payout / Fleet finance visibility | BLOCKED | No QA Fleet configuration; real payouts prohibited. |
| QA27 | Security / privacy | BLOCKED | No QA account/service environment for device-level testing. |
| QA28 | Voice/AI, scheduled, motion, accessibility | BLOCKED | No QA build/device; unsupported backend/provider capabilities remain excluded. |

**Totals: PASS 0 / FAIL 0 / BLOCKED 28 / NOT RUN 0.** This is not a claim of failed product behavior; the environment prerequisites were not met. Static code gates and QA-config unit tests are recorded separately.

No production API, database, push, email, OAuth, payment or payout action was performed.

