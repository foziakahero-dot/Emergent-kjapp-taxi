# KJAPP Signature 2.0 — continuation status

Updated: 2026-09-14
Branch: `codex/kjapp-signature-mainline`
PR: #17
Base: current `main`
Visual source of truth: approved Emergent implementation already retained inside this repository under `_legacy_web/`.

## Customer — implemented / rebased onto current production logic
- Splash / onboarding retained where it already matches the approved minimalist Emergent direction.
- Login/register aligned while preserving real customer-role validation, Google sign-in, +47 treatment and password visibility.
- Forgot-password request screen uses the existing backend endpoint with anti-account-enumeration behavior.
- Signature map-first Home and 3-snap booking/search sheet.
- Real location, places search, saved places, route estimate, vehicle pricing, payment selection and real booking request preserved.
- Native map support with safe Android fallback when native Google Maps configuration is unavailable.
- Booking lifecycle covers searching, booking, driver-on-way, driver-at-pickup, in-trip, arrival, receipt/payment and rating.
- Live driver marker requires fresh backend GPS; stale/missing GPS is shown explicitly rather than simulated.
- Passenger cancellation is hidden/refused after trip start.
- Customer Oslo fallback coordinate is visual-only; it cannot be used as a real nearby/estimate/booking pickup when foreground location is unavailable.
- Receipt/Stripe verification, Trip History, profile, GDPR deletion and Signature dock remain wired to real/current APIs.

## Driver — implemented / rebased onto current production logic
- Driver Login preserves strict driver-role validation and current auth behavior.
- Signature map-first Driver Home with premium ONLINE/OFFLINE capsule.
- Offline, waiting, incoming-offer and active-trip command surfaces with progress stages and haptics.
- Foreground one-alert-per-offer safety net; current `nativeRuntime.ts` remains authoritative for native push/background location/deep links.
- Driver cannot transition backend availability to online without foreground location permission.
- If server state is restored as online after location permission was revoked, the client corrects availability back to offline.
- Earnings/payout retains real commission/backend data.
- Driver history shows gross/net earnings for completed rides and zero earned income for cancelled rides.
- Driver profile/settings/logout/GDPR routing and Signature dock are aligned.

## Shared / platform
- Native `react-native-maps` layers for Customer and Driver.
- Existing `InteractiveMap` remains the safe Android fallback when Google Maps is not configured.
- iOS can use native Apple Maps; Android native Google Maps activates only with a build-time key.
- Both apps perform best-effort server logout while always clearing local bearer state.
- No Supabase migration and no fake production trips, drivers, earnings or customer activity.

## Backend release hardening
The original backend implementation is preserved byte-for-byte as `backend/server_core.py`. Its Git blob SHA is identical to `main/backend/server.py`: `d74d057191a5aa9bb57130abea3784929a34df98`.

`backend/server.py` is now a small runtime composition root that preserves the existing `uvicorn server:app` contract and activates `backend/hardening.py`. The wrapper supports both `uvicorn server:app` from `backend/` and `uvicorn backend.server:app` from the repository root.

Hardened behavior:
- Passenger cancel only in `searching`, `booking`, `driver_on_way`, `at_pickup`.
- Passenger complete only after `arrived`; already-completed/rated requests are idempotent.
- Passenger and driver ratings only after the ride is finished.
- Stripe card-setup session must belong to the authenticated user before it can be persisted as that user's payment method.
- Payment-status lookup requires authentication and session ownership.
- Checkout reuses an existing open session and uses an atomic expiring per-trip lock to prevent concurrent duplicate Checkout sessions.
- Stripe payment intent is persisted onto the trip for real Admin refund linkage.
- Stripe webhook only marks the trip paid when Stripe reports `payment_status=paid`.
- Payment reconciliation preserves `rated` instead of downgrading it to `completed`.
- Message mark-seen requires actual trip ownership/participation.

Regression coverage is added in `backend/tests/test_release_state_guards.py` for cancellation, completion, passenger/driver rating, payment ownership, message ownership and repeated Checkout reuse.

Issue #18 documents the original passenger-cancellation backend defect. The code fix is present in PR #17; keep the release gate open until the hardened backend is deployed and the regression test suite passes in the connected backend environment.

## Validation state
### Source/static validation
- `backend/server.py` parses as valid Python.
- `backend/hardening.py` parses as valid Python.
- Hardening contains exactly 9 explicit legacy route removals and 9 corresponding replacements.
- `server_core.py` is Git-identical to the original `main/backend/server.py` blob.
- PR #17 remains draft and mergeable.

### Web previews
The current continuation head has successful Vercel Home/Admin/Fleet and Netlify preview checks.

### EAS / Android
A previous temporary Signature validation run was created through the connected Customer Expo project. On SHA `063d41dac9a825c1230fc84a7b9bc7736967a001`, both:
- `KJAPP Mobile Android validation / Validate KJAPP Customer (@elitetransport/kjapp)`
- `KJAPP Mobile Android validation / Validate KJAPP Driver from Customer EAS checkout (@elitetransport/kjapp)`

remain `pending`; raw Expo status says `Job is waiting to start.` This is a queue state, not a verified compile success or failure.

The Driver app still does not create checks from its own Expo project when the repository is probed. The remaining direct Driver build blocker is the Driver Expo project's GitHub connection/project-root configuration outside this repository.

GitHub Actions is not a reliable fallback at present: both existing and minimal diagnostic workflows have terminated with `startup_failure` before a runner/job is created.

## Remaining QA / release gate
Keep PR #17 **draft** until all are true:
1. Hardened backend is deployed in the connected backend environment and `backend/tests/test_release_state_guards.py` passes.
2. Customer app on final head receives terminal-green Expo/EAS validation and Android APK build.
3. Driver Expo GitHub connection/root is restored and Driver APK builds successfully, or an equivalent verified build is produced from the correct Driver project.
4. Customer physical-device smoke test covers onboarding/login → location/map → destination search → vehicle → payment → booking → driver assigned → pickup → active trip → receipt/payment/history.
5. Driver physical-device smoke test covers login → offline → online/location permission → offer → accept → pickup → active trip → complete → earnings/history.
6. Native/background notification behavior is verified with production Firebase/FCM/APNs credentials.
7. Stripe sandbox regression verifies open-session reuse, paid reconciliation and refund linkage.
8. Final pixel-level visual QA is performed against `_legacy_web/` at real target-device dimensions.

Do not label the release pixel-perfect, production-ready or merge-ready until the relevant external/device gates above have been verified.
