# SNAR Phase 2B Recovery Status

Branch: `recovery/snar-mobile-v10-phase2b`

Purpose: recover the lost local Work baseline `integration/snar-mobile-v10` / `a43bdc1bb783e0d1bb5ed28e4131d8137ca8d25a` without redesign, deploy, native build, OTA, database mutation or provider activity.

## Locked source heads

- main: `6f2c2d96e7290fb1b3331906e752958e1db4c356`
- Customer: `60c31b3e2ee3f9375d119dedf6584f2179f189e8`
- Driver: `244c081a5788babe5fff84bef3f3e1d3a14f7b3a`
- Backend: `e0b45fcfe4c907e2614bb691a33943192c9cb91b`

## Recovered and stored in GitHub

- authoritative Backend/Customer/Driver source subtrees
- current main Admin/Fleet/Marketing surfaces retained
- 47 Phase 2B manual reconciliation decisions restored directly to their recorded final Git blobs
- `backend/requirements-ci.txt` restored exactly, including `cryptography==49.0.0`
- Customer `frontend/app.config.js` restored byte-identically to Phase 2B
- retained navigation-settings backend test restored exactly
- Phase 2B root QA/release helper files restored where their exact Git blobs already existed
- candidate-only RuntimeGuard files and one-off native/OTA workflows excluded
- DB migration helper excluded
- inherited Customer native-build authorization revoked
- Driver Firebase native config restored fail-closed
- Driver notification-handler startup is guarded while preserving Driver GPS/push/dedupe behavior
- hard hash verifier: `scripts/verify_phase2b_recovery.py`
- deterministic backend guard recovery: `scripts/recover_phase2b_server.py`

## Critical byte targets

The recovery is not certified until these hashes pass:

| Path | Phase 2B final Git blob |
| --- | --- |
| `backend/server.py` | `b62557eef59b9b4e6f7a52a5ab7b528626bf350c` |
| `backend/requirements-ci.txt` | `eb918f65d558960ed985be3df518fe31c5cf7115` |
| `backend/tests/test_beta_trip_integrity_contract.py` | `8db6c09d38efbb71a88130f8705aa82db0a352b1` |
| `backend/tests/test_beta_trip_lifecycle_contract.py` | `f07442072f81f25604fea0b3a14814d0604c65c1` |
| `backend/tests/test_fleet_live_identity_contract.py` | `2eb6aeb0ca135f794606eb3cd29b5d0b3c7ff456` |
| `backend/tests/test_mobile_server_truth_contract.py` | `e06ea514442737624a7cd1f379b66b46a7174d47` |
| `backend/tests/test_navigation_settings_unit.py` | `4590c7f3584c27abe03ed1f639d3f8fe9d4e5079` |
| `backend/tests/test_receipt_identity_recheck_contract.py` | `8fea06ab47ad87d99d94ea460ea18ee5267849ad` |
| `backend/tests/test_security_regressions_unit.py` | `dbb6e916eb8938e4e0721646b4175943630a52f6` |
| `frontend/app.config.js` | `ba6eabbba9f54be5595cd87a21308adf5f8784c9` |
| `frontend/customer-build-gate.json` | `4195272b88d974e43477822aac53e0588fc290ce` |
| `driver-app/src/lib/nativeRuntime.ts` | `0568079056c8930b0f98cdfce9e24ea91262ec2c` |
| `driver-app/app.config.js` | `1bc214eccf81ffb61e974aa7f3af5ad0c288058b` |
| `.github/workflows/ios-build.yml` | `06fff6900ac711d757e73e955802dc4cf395a4a8` |

## Server recovery boundary

The final server must keep the locked Backend search/reservation implementation and restore only the approved historical guards:

- mandatory Admin/Superadmin 2FA + no-disable rule
- private sensitive reads fail closed through admin 2FA
- atomic one-use password-reset claim/session revocation
- fresh Driver reservation / accept lock guards
- Driver accept offer-generation and expiry claim checks
- bounded Mongo pool/timeouts + required indexes
- health/readiness return HTTP 503 when not healthy/ready

Do **not** replace `offer_trip_to_next_driver` with the older historical implementation. The Backend-head implementation, including the three-round/offer-sequence fix, remains authoritative.

Historical guard commits used as recovery evidence:

- `e3d1f0650a41d889f4f09efdd32e944de186478c`
- `eb8ccdd64910864507076bcf18e6ef182409b831`
- `f66c5e85351d08304f28576f12ceb730a3ed659e`

## Remaining test reconciliations

Phase 2B recorded these exact intentions:

- trip integrity: preserve role/ownership, fail-closed earnings and vehicle access; use canonical `vehicle_access_query` with assigned/selected/fleet-wide access behavior
- lifecycle: validate `payment_authorizing` / `authorizing` before searching/reserved while preserving ownership, unpaid completion and receipt assertions
- security: adapt fake to current Mongo CAS/search-round signature; retain existing guards; add two Driver-accept race tests and one-use parallel password-reset test
- receipt: execute `_commission_for_trip` together with `ensure_receipt_snapshot`; preserve explicit zero/promo booked rates; missing booked rate uses approved platform fallback
- fleet/identity and mobile server truth: keep server-truth/private-read boundaries from final Phase 2B suite

## Recorded Phase 2B final validation

- backend: 275 passed + 7 subtests, 1 warning
- Customer typecheck: PASS
- Driver typecheck: PASS
- mobile API mapping: 140/140, no controlled-scope mismatches
- 76/76 manual decisions resolved
- final diff from locked main: 256 paths, 72,709 insertions, 3,593 deletions
- web policy remained red only for four pre-existing assertions / three root gaps
- physical/native/provider QA was not performed

## Phase 3 guardrail

Do not start the new SNAR 10/Figma migration on this branch until the hash verifier and Phase 2C regression gate are green.

The actual newest SNAR 10/Figma source package is preserved separately as `SNAR_V10_VSCode_Package.zip` and is the Phase 3 visual source of truth. It must not be used to silently change backend/business behavior during recovery.
