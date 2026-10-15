# QA repair checkpoint — 16 October 2026 (Oslo)

## Build hold
Do not start APK, iOS, TestFlight or store builds. The owner must approve a new controlled build after the final report. Mobile fixes in this checkpoint are source changes, not changes to the already installed APK.

## Confirmed infrastructure
- Render My Workspace `tea-dassqnrbc2fs73a770i0`, service `snar-api-qa` / `srv-db61otlckfvc73bqp480`.
- Compute is paid **0.5c-512mb ($7/month)**, separately from workspace Pro and the Starter build plan. Rechecked through Render connector 16 October, 00:54 Oslo. No further paid upgrade made.
- API stays **https://api-qa.snarapp.no**. Driver `qa` and `testflight-qa`, and Customer QA profiles point to this same service. No production API migration is needed for Driver to use the paid QA service.
- Live backend at inspection: `5e484f59dca9adc271e1a0c5c239a614d968ab80`, deploy `dep-db8lfjrl550s73eeorkg`. Autodeploy is off.
- QA environment variable names show no dedicated Google/Apple, AI or Resend credentials. Values were not exposed. Provider configuration is a blocker for live acceptance, not a reason to stop other repairs.

## Customer navigation, history and ride controls
IMPLEMENTED / TESTED LOCALLY:
- Activity accepts the actual GET `/api/trips` top-level array. Previously it only read `.trips` and silently showed no rides. Completed/cancelled rows open the owned trip detail, then receipt. Active trips remain separate.
- All tab scenes fill the full canvas behind the floating dock; removed the extra 112px scene margin because scroll screens already reserve dock space. The previous empty target area could produce a dark/grey Android blur.
- Dock and trip dock reuse the source glass layer (blur, then theme tint). Source dimensions, five labels/icons, inverse AI tile, selected red indicator and safe area handling are retained. No decorative unread message dot is invented.
- Minimize now returns home in one action, caching the existing server trip under its customer key. It never sends cancel, payment or booking requests. The shared active-trip island reopens that same trip.
- Nearby markers require valid coordinates and server GPS timestamps; expired, invalid and missing timestamps are hidden, including between refreshes. Server time is used to tolerate a skewed phone clock. Background responses cannot restore stale markers after resume.
- GPS permission denial, disabled services, timeout and provider errors are distinguished. GPS lookup is bounded to ten seconds. Manual pickup is explicit on home and route screens, overrides late GPS responses and does not require location permission.
- Existing vehicle marker SVG matches the source `VehicleMarker` geometry; it is driven by real server car coordinates and heading. No fabricated drivers were added.

DESIGN SOURCE:
`SNAR Fleet v2 Design System (3)(1).zip`, SHA256 `5bb43ac60579f335ba72c562cde7b62bc8b74bf6ce6586c82a0f3837f9e2dabd`.
Compared `src/CustomerApp.tsx`, `src/snar10/kit.tsx` and dock/glass rules in `src/index.css` / `signature.css` to native code. Native pixel comparison at the same viewport is still pending; this is not certified pixel-identical.

CHECKS PASSED:
- `node scripts/verify-v10-screen-checkpoint.cjs`: actual component history/detail/receipt routing, customer/driver ride controls, invalid/pending quotes, duplicate booking exclusion, manual pickup and message/state behavior. Updated obsolete active-trip fixtures to the shared query cache and used the real array response for Activity.
- `node scripts/verify-figma-mobile.cjs`: minimize/home/reopen, unchanged trip on minimize, cancellation reconciliation, fonts/themes, safety errors and lifecycle cleanup.
- `node frontend/scripts/car-availability-regression.cjs`: server clock skew, expiry, invalid timestamps, background/resume race, live refresh and unobscured map bounds.
- `node frontend/scripts/pickup-location-regression.cjs`: permission, GPS disabled, timeout, provider error, invalid coordinates and explicit prompt.
- Customer `npx tsc --noEmit` and `git diff --check`.

NOT VERIFIED ON DEVICE / AGAINST QA:
New navigation appearance, GPS/wallet/Google/Apple OS dialogs, real online-driver map movement and end-to-end ride. Physical-device acceptance remains mandatory after a later authorized test build.

## Next steps
1. Finish isolated QA native auth configuration, secure explicit account linking, idempotent creation tests and Resend welcome outbox for password/social signup.
2. Configure/test a QA-only AI provider; retain human support ticket and passenger/driver access checks.
3. Finish platform-specific Stripe wallet support and server-confirmed test settlement.
4. Verify separate QA Admin/Fleet hosting, API routes and permissions. Do not repoint the production Netlify panels.
5. Validate startup recovery and compare actual device screenshots to the source before requesting build approval.
