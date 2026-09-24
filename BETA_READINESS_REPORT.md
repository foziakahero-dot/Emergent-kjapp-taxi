# KJAPP Oslo Beta Readiness Report

Branch: `beta/oslo-production-ready`  
Production merge: **not performed**  
Emergent production backend deployment: **not performed**

## Implemented on this branch

### Trip integrity
- Passenger duplicate active-booking guard.
- Atomic driver reservation lock prevents one driver from accepting two concurrent rides.
- Driver reservation lock self-heals when no canonical active trip remains.
- Live driver actions require an approved driver account; admin accounts cannot impersonate a driver.
- Driver offers require online state and fresh GPS; stale/broadcast offers cannot bypass the acceptance gate.
- Driver cannot go offline while an active ride is in progress.
- Pickup arrival is GPS-proximity checked (configurable radius) before the driver can mark arrival.
- Trip start requires the explicit at-pickup state; the driver cannot skip the pickup transition.
- No-show requires the configured waiting time after a valid pickup arrival.
- Customer trip completion is state-guarded and idempotent.
- Passenger/driver rating is restricted to a finished ride lifecycle.
- Driver lock is released on arrival, no-show, customer cancellation and driver cancellation.

### Push notifications
- New mobile builds register Expo Push tokens instead of treating raw iOS APNs tokens as Firebase tokens.
- Backend sends Expo Push notifications to real devices through APNs/FCM and keeps legacy FCM-token support.
- One native token is rebound to one authenticated account; shared/reused phones cannot keep another account's push subscription.
- Customer logout unregisters this device and revokes the server session.
- Driver logout also stops background GPS before unregistering push and revoking the session.
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

## Approved P0/P1 beta-hardening pass — 24.09.2026

Implemented without redesigning Customer or Driver:

### Account recovery / legal wiring
- Customer and Driver now have native forgot-password and reset-password routes.
- Reset emails use fixed KJAPP app schemes (`kjapp://` / `kjapp-driver://`) with a trusted web fallback.
- Web fallback is controlled by `PASSWORD_RESET_WEB_BASE` and defaults to `https://fleet.kjappapp.no`; it is not derived from request headers.
- Customer signup requires explicit terms/privacy consent and stores consent timestamp + legal version.
- Driver invite signup requires the same explicit consent and stores it on the driver account.
- Fleet/løyvehaver application intake now also requires explicit partner/platform terms + privacy consent and stores consent timestamp + legal version.
- Canonical help/privacy/terms routes are now `/help`, `/personvern`, and `/vilkar` on `kjappapp.no`.
- Customer profile/settings and Driver settings route support/legal actions to the canonical `kjappapp.no` URLs.
- Old mobile/geocoding references to `support@kjapp.no`, `support@kjappapp.com` and `kjapp.no/vilkar` were replaced in active product code with `kjappapp.no` addresses.
- Legal routes intentionally contain beta placeholder copy only; final legally approved text remains a public-release blocker.

### Abuse protection / beta telemetry
- Mongo-backed fixed-window IP rate limits protect registration, password reset, Apple auth, address search, AI calls, payment-session creation, public fleet onboarding and public document uploads.
- Existing login brute-force protection remains separate and unchanged.
- Customer and Driver install a lightweight global JavaScript crash monitor.
- Client error reports are stored for 30 days through rate-limited `POST /api/client-errors`.
- This beta collector is not represented as a full native Crashlytics/Sentry replacement.

### Admin Beta Health
- New `GET /api/admin/beta-health` derives operational metrics from real non-demo records.
- Existing Admin dashboard now shows, without redesign:
  - trip completion rate,
  - dispatch assignment success,
  - median / p95 accept time,
  - fresh-GPS percentage,
  - fatal client-error count.

### Operations / store preparation
- `docs/INCIDENT_RUNBOOK.md` documents P0–P3 handling for dispatch, GPS, push, ride state, payment, settlement, app crash, API outage, Admin outage and privacy/security incidents.
- `docs/STORE_RELEASE_PACK.md` documents Customer/Driver IDs, draft store metadata, release notes, privacy-label review inventory and TestFlight/public-store gates.
- `docs/PHYSICAL_BETA_QA.md` is now the physical-device release gate for locked-screen push, background GPS, dispatch integrity, full ride lifecycle, payment, restart/network recovery and Admin/Fleet reconciliation.
- Driver store screenshots currently duplicate Customer assets and are explicitly marked placeholders; real Driver screenshots are still required before public store submission.
- Duplicate Customer TestFlight submit step was removed from the iOS release workflow.
- The approved P0/P1 implementation pass is now code-complete on this branch; the remaining work is build/device/deployment verification, not a product redesign.

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

GitHub is still returning workflow conclusion `startup_failure` with **zero jobs started** on PR-triggered runs, including the current P0/P1 commits. The run metadata shows `path: BuildFailed` and no jobs are created. This occurs before `compileall`, TypeScript, Expo Doctor, Vite or Xcode commands can execute, so it is **not** a successful validation and is also not evidence that application code failed compilation.

Until GitHub Actions execution is restored, the branch must remain unmerged. The intended gate is `.github/workflows/beta-gate.yml`: backend compile, Admin build, Marketing build, Customer typecheck/Expo Doctor/config and Driver typecheck/Expo Doctor/config.

## Backend ownership migration

Do **not** combine the Oslo beta stabilization with an infrastructure cutover. The migration is planned separately in `BACKEND_MIGRATION_PLAN.md`.

Release strategy:
- TestFlight/internal beta may continue against the current Emergent API.
- Establish `https://api.kjappapp.no` before long-lived App Store / Play production builds.
- Initially it may route to the existing known-good backend.
- After beta stabilization, migrate FastAPI/Mongo/storage/AI to KJAPP-controlled infrastructure behind the same hostname, so mobile apps do not need a new release just because the backend provider changes.

## Required verification before beta

The portable `backend/scripts/e2e_dispatch.py` checks duplicate customer booking rejection, sequential offer ownership/forwarding, losing-driver acceptance rejection, real pickup/destination GPS gates, idempotent completion, post-trip ratings, native push config and Oslo service-area readiness. It reads test credentials only from environment variables.

Use `docs/PHYSICAL_BETA_QA.md` for the physical-device evidence run.

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
