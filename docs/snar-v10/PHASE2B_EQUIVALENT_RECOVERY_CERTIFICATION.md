# SNAR Phase 2B Equivalent Recovery Certification

## Certification status

**FUNCTIONALLY EQUIVALENT RECOVERY CANDIDATE**

This is **not** an **EXACT PHASE 2B BYTE RECOVERY**. The reconstructed files are not claimed to be byte-identical to the lost Phase 2B files.

The original lost local HEAD was:

`a43bdc1bb783e0d1bb5ed28e4131d8137ca8d25a`

The original final Git blobs were not persisted in an accessible Git object store. The inspected local objects, stashes, and controlled remote refs do not contain the original Work commit or the 11 missing final blobs. SHA values identify expected bytes but cannot recreate those bytes.

## Historical hash evidence

The strict verifier checks 14 target files:

- **3/14 historical hashes recovered exactly:** `backend/requirements-ci.txt`, `backend/tests/test_navigation_settings_unit.py`, and `frontend/app.config.js`.
- **11/14 unavailable for exact byte proof:** `backend/server.py`, the six reconstructed contract tests listed below, `frontend/customer-build-gate.json`, `driver-app/src/lib/nativeRuntime.ts`, `driver-app/app.config.js`, and `.github/workflows/ios-build.yml`.
- **All `MUST_BE_ABSENT` invariants pass.**

The four unresolved targets outside the reconstructed backend/test changes remain at their existing branch contents; they were not rewritten to guess at the unavailable historical bytes:

- `frontend/customer-build-gate.json`
- `driver-app/src/lib/nativeRuntime.ts`
- `driver-app/app.config.js`
- `.github/workflows/ios-build.yml`

The strict hash verifier therefore remains intentionally uncertified.

## Reconstructed files

These seven files contain the reviewed functional reconstruction:

- `backend/server.py`
- `backend/tests/test_beta_trip_integrity_contract.py`
- `backend/tests/test_beta_trip_lifecycle_contract.py`
- `backend/tests/test_fleet_live_identity_contract.py`
- `backend/tests/test_mobile_server_truth_contract.py`
- `backend/tests/test_receipt_identity_recheck_contract.py`
- `backend/tests/test_security_regressions_unit.py`

`backend/server.py.rej` was reviewed before removal. Its two rejected hunks were the Admin 2FA helper and the `require_superadmin` guard; both are already present in `backend/server.py`.

Line-ending-only working-tree noise was excluded from the commit. The normalized index blobs for those files were verified to remain equal to their existing branch blobs.

## Semantic verification

The reconstructed backend and tests were reviewed and exercised for these contracts:

- Admin and Superadmin access requires enabled TOTP through the admin, superadmin, fleet-owner, trip-access, and private-file guards. A direct check verified that `twofa_disable` rejects both Admin and Superadmin before accessing the database.
- Admin and Superadmin sensitive trip and file reads fail closed when TOTP is disabled. The security regression test verifies denial occurs before database access.
- Password-reset tokens are claimed atomically with a conditional `find_one_and_update` on unused, unexpired tokens; the reset clears the stored plaintext token and updates `tokens_valid_after` to revoke prior sessions. The parallel reset test verifies exactly one request succeeds and only one password/session mutation occurs.
- Driver reservation recovery recognizes fresh in-flight locks, conditionally clears only stale reservations, and fails closed if the reservation changes during recovery. Driver acceptance claims are conditional; sequential offers must still match the current driver and `offer_seq`, and must not have expired.
- The latest `offer_trip_to_next_driver` function was compared with the locked source at the branch base and is identical. The persisted search uses `SEARCH_ATTEMPTS = 3`; offer-generation updates use `offer_seq` compare-and-set protection.
- Mongo connection configuration retains bounded selection/connect/socket timeouts and pool/wait-queue limits. Required trip, identity, file, reset-token, and revoked-session indexes remain declared in `lifespan`.
- Health and readiness both return HTTP 503 when Mongo is unavailable. This was checked directly with a local unavailable-database fake; the health regression test also passes.
- Private file reads retain owner, role, scope, and fleet checks after the mandatory Admin 2FA guard.
- Trip-integrity tests cover ownership/role enforcement, fail-closed earnings, and canonical `vehicle_access_query` behavior for assigned, selected, and fleet-wide vehicles within the driver's active fleet.
- Trip-lifecycle tests cover `payment_authorizing`/`authorizing` until successful card reservation, subsequent searching/reserved state, ownership, unpaid completion protection, and receipt assertions.
- Receipt tests execute `_commission_for_trip` with `ensure_receipt_snapshot`, covering zero and promotional booked commission, platform fallback when booking data is absent, and immutable historical commission after a later Fleet agreement change.
- Fleet/identity and mobile/server-truth tests retain Fleet-owner scope and private identity-file protections, Customer active-trip restore and uncertain-booking recovery, Driver accept reconciliation, and paid/server-authoritative receipt and rating state.
- The unchanged native-build controls remain fail-closed: Customer native-build authorization is false, the iOS workflow is manual and contains no compile or release action, Driver Firebase configuration throws when Firebase is required without a file secret, and notification-handler installation is guarded without changing GPS/push/dedupe code.

The six reconstructed contract test files above were included in the complete recorded Phase 2B backend regression boundary. Assertions were not skipped, deleted, weakened, or marked expected-failure.

## Code gate results

- `python -m compileall -q backend`: **PASS**
- Recorded Phase 2B backend regression boundary: **276 passed, 7 subtests passed** (25 test files; 29.05 seconds)
- Customer `npx tsc --noEmit`: **PASS**
- Driver `npx tsc --noEmit`: **PASS**

On Windows, the full pytest run used an in-memory collection hook to shorten only the oversized parametrized test node ID for `test_untrusted_image_validation`. This prevents Windows from rejecting the overlong `PYTEST_CURRENT_TEST` environment value. All parametrized cases, tests, and assertions still ran; no test was skipped or changed.

## Operational boundary

No deployment, native build (APK/IPA/TestFlight), OTA, production database mutation, or provider transaction occurred. The historical iOS build authorization remains revoked, and all absence invariants remain passing.

The strict branch `recovery/snar-mobile-v10-phase2b` was not rewritten or force-pushed. This candidate is based on its existing commit `09781f731ad0505dd718815ec0f4fd1d77d3e351` and is isolated on `recovery/snar-mobile-v10-phase2b-equivalent`.
