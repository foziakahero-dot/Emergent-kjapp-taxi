# KJAPP Signature continuation status

Branch: `codex/kjapp-signature-mainline`
PR: #17
Base: current `main`
Visual source of truth: approved Emergent implementation already retained inside this repository under `_legacy_web/`.

## Customer — implemented / rebased onto current production logic
- Splash / onboarding retained where it already matches the approved minimalist Emergent direction.
- Login aligned to the approved Emergent auth hierarchy while preserving real customer-role validation and Google sign-in.
- Register aligned to the approved Emergent hierarchy, including +47 phone treatment, password visibility and circular submit action.
- Forgot-password request screen added against the existing `/auth/forgot-password` backend endpoint with anti-account-enumeration behavior.
- Signature map-first Home and 3-snap booking/search sheet.
- Destination search inside the sheet using the real places API.
- Saved places kept on the newer real API implementation rather than regressing to static UI.
- Vehicle selection, real route estimate, pricing and real payment-method selection preserved.
- Payment Methods kept on the newer Stripe verification/retry implementation rather than regressing to the older reference behavior.
- Booking lifecycle aligned for searching, booking, driver-on-way, driver-at-pickup and in-trip states.
- Live driver marker now requires fresh backend GPS data; stale/missing GPS is shown as waiting rather than simulated movement.
- Trip cancellation now requires explicit confirmation before the backend cancel call.
- Receipt hierarchy aligned while preserving the newer Stripe payment-status verification/retry flow.
- Rating changed to select-stars then explicitly submit, matching the approved reference and reducing accidental ratings.
- Trip History aligned with pickup/dropoff hierarchy, total-spend summary and correct reopening of active trips.
- Floating dock preserves the newer KJAPP Assist tab: Home / Assist / Trips / Profile.
- Signature profile hierarchy while preserving GDPR permanent deletion and current backend contracts.
- Settings retained where current implementation already matches or exceeds the old reference.

## Driver — implemented / rebased onto current production logic
- Driver Login aligned to the approved Emergent auth hierarchy while preserving strict driver-role validation.
- Signature map-first Driver Home.
- Premium ONLINE/OFFLINE capsule.
- Offline, waiting, incoming-offer and active-trip command surfaces.
- Active-trip progress stages and haptics.
- One-alert-per-new-offer foreground notification safety net.
- Current `nativeRuntime.ts` remains authoritative for native push registration, background location, background pending-offer fallback notification and notification deep links.
- Floating Signature dock: Drive / Earnings / Profile.
- Earnings retained on the newer production implementation because it already exceeds the legacy reference with real commission, payout, week/month periods and charts.
- Driver Trip History aligned to show pickup + dropoff + status + date + gross/net hierarchy while preserving commission detail sheets.
- Signature Driver profile uses current real driver, rating and vehicle data.
- Driver Settings preserves current settings/GDPR behavior and explicitly returns to `/driver-login` after logout or account deletion.

## Shared / platform
- Native `react-native-maps` layers for Customer and Driver.
- Existing `InteractiveMap` remains the safe Android fallback when Google Maps is not configured.
- iOS can use native Apple Maps.
- Android native Google Maps activates only when a build-time key exists.
- Expo config uses `android.config.googleMaps.apiKey` and preserves each app's existing Expo identity/project IDs.
- Both apps perform best-effort server logout while always clearing the local bearer session even if the server is unreachable.
- FastAPI + MongoDB architecture and existing production API contracts remain unchanged.
- No Supabase migration and no fake production trips, drivers, earnings or customer activity.

## Intentionally not ported from old PR #7
- Customer on-device profile-photo association/persistence pretending to be cross-device state.
- Stale upload API wrappers used only by that profile-photo implementation.
- Old Driver push wrapper/root runtime; current `nativeRuntime.ts` on `main` is newer and remains authoritative.
- Any old layout that would remove the newer KJAPP Assist tab.
- Any old payment code that would regress the current Stripe verification/status flow.

## Build validation
- Customer EAS workflow triggers correctly from the connected Customer Expo project. Signature branch builds were submitted during the temporary validation trigger and GitHub still reports them as pending; do not claim a green APK until a terminal build result is verified.
- Driver standalone EAS workflow exists under `driver-app/.eas/workflows/build-apk.yml`, but the Driver Expo project did not create a check for Signature branch pushes. The remaining trigger blocker is outside the Driver source workflow and requires the Driver Expo project GitHub connection/app root (`driver-app`) to be corrected.
- The repository GitHub Actions APK workflow cannot currently be used as a fallback. A one-step `echo` smoke workflow also terminated with `startup_failure` before any job was created. Existing `main` runs show the same pre-existing behavior, so this is a repository/account GitHub Actions runner/policy/billing/startup issue rather than an application compile failure.
- Temporary Signature branch CI/EAS triggers used for diagnosis were removed again; release triggers remain `main` only.

## Remaining QA / release gate
Keep PR #17 as draft until:
1. Customer APK reaches a terminal green build and receives device smoke testing.
2. Driver Expo GitHub connection is restored and Driver APK builds successfully.
3. Customer device smoke test covers onboarding/login -> location/map -> destination search -> vehicle -> payment -> booking -> driver assigned -> pickup -> active trip -> receipt/history.
4. Driver device smoke test covers login -> offline -> online -> offer -> accept -> pickup -> active trip -> complete -> earnings/history.
5. Native/background notification behavior is verified with production Firebase/FCM credentials before release.
6. Final pixel-level visual QA is performed against the retained `_legacy_web/` approved reference on real target device dimensions; implementation work alone is not labeled pixel-perfect without that visual comparison.
