# KJAPP Oslo Beta Readiness Report

Branch: `beta/oslo-production-ready`  
Production merge: **not performed**  
Emergent production backend deployment: **not performed**

## Implemented on this branch

### Trip integrity
- Passenger duplicate active-booking guard.
- Atomic driver reservation lock prevents one driver from accepting two concurrent rides.
- Driver reservation lock self-heals when no canonical active trip remains.
- Driver cannot go offline while an active ride is in progress.
- Customer trip completion is state-guarded and idempotent.
- Driver lock is released on arrival, no-show, customer cancellation and driver cancellation.

### Push notifications
- New mobile builds register Expo Push tokens instead of treating raw iOS APNs tokens as Firebase tokens.
- Backend sends Expo Push notifications to real devices through APNs/FCM and keeps legacy FCM-token support.
- Customer and Driver push deep-links are normalized to valid Expo Router routes.
- Push events covered include driver assigned, driver arrived, trip started, trip completed, cancellation and payment state.

### Payments
- Stripe webhook verifies stored trip/user/amount/currency before applying payment state.
- Webhook processing remains idempotent.
- Verified payment no longer overwrites a later ride state such as `rated`.
- Customer and driver receive payment-completed notifications.
- Stripe return URLs are restricted to trusted KJAPP web origins and the marketing site bridges payment/setup callbacks back into the native Customer app.
- Saved cards are explicitly provisioned for `off_session` use.
- Optional automatic post-trip card charging is implemented behind `KJAPP_AUTO_CHARGE_ENABLED=false` by default, with deterministic Stripe idempotency and secure manual Checkout fallback when a bank requires customer action.

### Driver navigation / live ride
- Driver app has native navigation launch to pickup and destination.
- Existing live GPS updates remain canonical in `/driver/location`.
- Assigned driver's coordinates continue to update the active trip shown on the customer map.
- Customer/Driver map already smooths movement between received GPS points.
- Foreground and background GPS now adapt to ride state: lower-frequency while idle/online and higher-frequency during `driver_on_way`, `at_pickup`, and `in_trip`.
- GPS samples include device capture timestamps; backend rejects stale samples and implausible jumps.

### iOS
- Customer bundle ID: `no.kjapp.app`.
- Driver bundle ID: `no.kjapp.driver`.
- Customer Sign in with Apple capability and native Apple button added.
- Backend accepts native Apple identity tokens using `APPLE_BUNDLE_ID`.
- Driver declares background location + remote notification modes.
- Export-compliance flag set for standard/non-exempt encryption handling.
- EAS production auto-increment enabled for both apps.
- iOS smoke workflow now covers Customer and Driver simulator compilation.

## External configuration still required

### Emergent backend
Before production deployment configure/verify:
- `APPLE_BUNDLE_ID=no.kjapp.app`
- Stripe production/test keys appropriate for beta
- MongoDB production connection
- JWT secret
- any email credentials used for receipts
- `KJAPP_PUBLIC_WEB_ORIGIN=https://kjappapp.no`
- keep `KJAPP_AUTO_CHARGE_ENABLED=false` until Stripe saved-card/Connect test E2E passes; only then enable it intentionally

### Apple / EAS
One-time account work:
- Apple App ID `no.kjapp.app`
- Apple App ID `no.kjapp.driver`
- Push Notifications capability on both
- Sign in with Apple on Customer
- APNs credentials in EAS
- App Store Connect app records for Customer and Driver before TestFlight submission

### Android
- Verify FCM credentials used by the Expo projects before Play-store release.

## CI status

GitHub is currently returning workflow conclusion `startup_failure` with **zero jobs started** on PR-triggered runs. This happens before repository build/test commands execute, so it is not evidence of a TypeScript, Python or Xcode compile failure. GitHub Actions account/repository execution must be restored before CI can certify the branch.

## Backend ownership migration

Do **not** combine the Oslo beta stabilization with an infrastructure cutover. The migration is planned separately in `BACKEND_MIGRATION_PLAN.md`.

Release strategy:
- TestFlight/internal beta may continue against the current Emergent API.
- Establish `https://api.kjappapp.no` before long-lived App Store / Play production builds.
- Initially it may route to the existing known-good backend.
- After beta stabilization, migrate FastAPI/Mongo/storage/AI to KJAPP-controlled infrastructure behind the same hostname, so mobile apps do not need a new release just because the backend provider changes.

## Required verification before beta

The portable `backend/scripts/e2e_dispatch.py` now also checks duplicate customer booking rejection, losing-driver acceptance rejection, idempotent completion, native push config and Oslo service-area readiness.

1. Backend Python compile/test.
2. Customer TypeScript + Expo config.
3. Driver TypeScript + Expo config.
4. Android Customer APK.
5. Android Driver APK.
6. iOS Customer simulator/device build.
7. iOS Driver simulator/device build.
8. Physical-device test: locked-screen new-trip push.
9. Physical-device test: Driver background GPS while screen is locked.
10. End-to-end ride: request -> dispatch -> accept -> pickup -> start -> arrive -> payment -> rating.
11. Emergent deployment of the reviewed backend branch.
12. Post-deploy smoke test against `https://github-app-builder-28.emergent.host/api`.

## Release rule

Do not merge this branch to `main` and do not deploy the backend until the checks above are completed or explicitly waived for a controlled beta.
