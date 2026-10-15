# QA repair checkpoint — 16 October 2026 (Oslo)

## Hosting correction — current continuation
The historical Netlify continuation instruction below is superseded. Verified
through the Vercel connector: team SNAR `team_kmJvnYjv4bsVk1dJC8P9Vuwe`, existing
projects `snar-admin` (`prj_8HcC2vmFXvh1fRpCeAyi2zOimrXp`) and `snar-fleet`
(`prj_hvAWgduSHGulD23MdDaQe0t58gfF`) already have previews from this QA branch.
Use Vercel QA previews; do not modify production domains or Netlify production sites.
Two empty Netlify QA projects were mistakenly created during continuation
(`snar-admin-qa`, `snar-fleet-qa`); nothing was deployed to either. Do not use them.

The existing AI implementation imports `emergentintegrations`; this is legacy
code, not backend hosting. The owner disputes any Emergent dependency. No new
Emergent key was created, no provider was changed, and QA AI remains unavailable.
Do not introduce or activate an Emergent dependency without resolving this choice.
The backend remains the same paid Render QA service for both mobile apps.

Render deployment `dep-db8m6q8473hc73amf5f0` is LIVE at `2bb10a1cfbefe450ac53536c371684f5e1f7f80d`
(2026-10-15 23:37:20 UTC). Live /api/health and /api/ready returned 200, isolated QA DB,
Stripe test mode, production_mode=false and auto_charge_enabled=false.
Google and Apple are enabled in native public config; Google iOS client is absent.
Native card setup is enabled; Google Pay is false and Apple merchant ID is empty.
No claim of device wallet readiness is warranted.

Resend is signed in and the QA domain still shows the DNS-record step. Authoritative
NS lookup returned `ns01.no.brand.one.com` and `ns02.no.brand.one.com`.
Uniweb and Emergent secure sign-in requests returned declined; do not retry those
requests without a new user request. No DNS records, sender key or AI key were set.

QA panel export is `npm run build:qa` in each web project. It forces
`VITE_API_BASE=/api`, adds a runtime QA API guard, emits a Vercel-only artifact in
`artifacts/phase5-qa/<panel>`, removes inherited Netlify redirects, proxies only to
`https://api-qa.snarapp.no/api/:path*`, adds noindex and release metadata. Normal
production build/deploy configuration is unchanged. `.netlify/` is ignored so
accidental local project bindings cannot enter Git.

## Build hold
Do not start APK, iOS, TestFlight or store builds. The owner must approve a new controlled build after the final report. Mobile fixes in this checkpoint are source changes, not changes to the already installed APK.

## Confirmed infrastructure
- Render My Workspace `tea-dassqnrbc2fs73a770i0`, service `snar-api-qa` / `srv-db61otlckfvc73bqp480`.
- Compute is paid **0.5c-512mb ($7/month)**, separately from workspace Pro and the Starter build plan. Rechecked through Render connector 16 October, 00:54 Oslo. No further paid upgrade made.
- API stays **https://api-qa.snarapp.no**. Driver `qa` and `testflight-qa`, and Customer QA profiles point to this same service. No production API migration is needed for Driver to use the paid QA service.
- Live backend at the latest inspection: `e3200b150edbb52c4cbb3e1ff2a0f8a26c450185`, deploy `dep-db8lvuta7eks73bl7rd0`, live 16 October 01:23 Oslo. Autodeploy is off. The subsequent wallet/AI/startup checkpoint is source-only until explicitly deployed to QA.
- Dedicated Google and Apple public QA settings have now been saved in Render (details below). Dedicated AI and Resend secrets are not configured yet. Never inherit production keys in QA.

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
1. Resume with the handoff at the end of this file. Do not repeat completed implementation or request the design ZIP again.
2. Finish dedicated Resend sender DNS/key and AI credentials, then test actual delivery/reply.
3. Deploy the wallet/AI/startup checkpoint to QA and exercise server flows; device wallets and provider OS dialogs remain unverified.
4. Prepare and verify separate QA Admin/Fleet hosting, API routes and permissions. Do not repoint production Netlify panels.
5. Compare actual device screenshots to the source after a later expressly approved test build.

## Native identity and Resend checkpoint
IMPLEMENTED / TESTED LOCALLY:
- QA native OAuth now requires explicit `QA_GOOGLE_AUTH_ENABLED=true` + `QA_GOOGLE_CLIENT_ID`, or `QA_APPLE_AUTH_ENABLED=true` + `QA_APPLE_BUNDLE_ID` (Driver: `QA_APPLE_DRIVER_BUNDLE_ID`). QA never inherits production/shared provider settings. Google iOS also needs its QA iOS client ID and the matching URL scheme in the signed binary.
- Verified provider subject is the identity key. New customers are created with customer role; existing same-email accounts require sign-in and explicit link. Added authenticated Apple linking, including private relay email support, and retained authenticated Google linking.
- Unique partial provider indexes and duplicate-key recovery protect concurrent registration/link requests. Password registration also handles a raced duplicate email cleanly.
- Native Google SDK cancellation is treated as cancellation. Both account-link actions share one lock; Apple linking appears only on iOS.
- New password/social customer records enqueue one durable Resend welcome job by user ID. Repeated signup/login cannot enqueue duplicate jobs. Temporary queue failure leaves a marker for worker recovery. Welcome email does not claim email ownership verification.
- Customer welcome jobs are isolated from the existing SendGrid outbox consumer. Resend uses stable idempotency keys and retries with leases/backoff. No message bodies or credentials are logged.
- QA email delivery requires `QA_RESEND_ENABLED=true`, `QA_RESEND_API_KEY` and `QA_RESEND_FROM_EMAIL`, using a sender verified in the intended Resend account. Production/shared Resend credentials are never inherited in QA.

CHECKS PASSED:
- 69 backend tests for mobile identity, RS256 Apple signature/audience/issuer/expiry, repeat/concurrent account creation, safe linking, invalid/unverified tokens, QA isolation, signup welcome queue/provider retries, existing Fleet/partner email behavior and commerce guards.
- 40 additional security, mobile-server-truth and concurrent login/health tests.
- Customer TypeScript and diff whitespace checks passed.

BLOCKED / NOT VERIFIED AGAINST QA OR ON DEVICE:
- Google/Apple public QA settings have now been configured as documented below. No real Google/Apple provider sign-in or Resend email delivery is certified yet.
- Confirm Google Cloud Android OAuth registration for `no.kjapp.app` and `no.kjapp.driver` against each EAS signing SHA-1; verify Web client audience and iOS clients. Do not assume a client ID's type from its text.
- Confirm Apple capability/merchant setup in the existing developer team. Customer bundle `no.nexorahub.kjapp.customer`, Driver `no.nexorahub.kjapp.driver`.
- Read-only QA preflight found zero duplicate email, Google-subject and Apple-subject groups before deployment; no production data was repaired.

The navigation checkpoint was pushed as `bb6a992a5edc08ce632b26476b50f4f09a185126`. Auth/email checkpoint commit is recorded in the subsequent Git history.

## Live QA verification and provider configuration
- Auth/Resend code checkpoint `e3200b150edbb52c4cbb3e1ff2a0f8a26c450185` deployed successfully.
- A synthetic `example.invalid` customer was registered through the running QA API: HTTP 200, role `user`, exactly one database user and one welcome job. Login returned 200 for the same user; logout returned 200; revoked session returned 401. Generated password/tokens were not printed or committed. No real email was sent.
- QA read-only preflight also found zero duplicate `(user_id, stripe_payment_method_id)` groups before the forthcoming index.
- Render now has `QA_GOOGLE_AUTH_ENABLED=true` and `QA_GOOGLE_CLIENT_ID=209896468593-7ajfd1t61mnmbr6ui63fk5v6qcdseccp.apps.googleusercontent.com`, the Web client ID previously supplied by the owner. No Google client secret is required for native ID-token verification.
- Render now has `QA_APPLE_AUTH_ENABLED=true`, `QA_APPLE_BUNDLE_ID=no.nexorahub.kjapp.customer`, and `QA_APPLE_DRIVER_BUNDLE_ID=no.nexorahub.kjapp.driver`. Backend Apple verification uses public Apple signing keys, not a developer private key.
- Google Cloud console returned Site Unavailable in this browser after one reload. Android OAuth registrations/signing SHA-1 and Google iOS client IDs are still unverified. Customer Android `no.kjapp.app`; Driver Android `no.kjapp.driver`. Previously recorded customer EAS SHA-1: `44:C8:7B:B8:9C:6E:E9:9B:34:AA:99:7D:B5:A6:70:AD:74:0C:E4:2C`; recheck against the signing credentials actually used for a later authorized build.

## Wallet, AI and startup source checkpoint
IMPLEMENTED / TESTED LOCALLY (not yet deployed):
- Stripe native SetupIntent/PaymentSheet supports the actual device's wallet: Google Pay on Android, Apple Pay on iOS. Unsupported wallets are hidden/disabled appropriately. Setup verifies the server-confirmed saved card before selection; SDK success alone never means paid. Explicit QA test-key guards remain.
- Native setup checks SetupIntent owner/customer and payment-method ownership. Repeated completion and signed webhook delivery upsert one saved method. Customer creation is idempotent. A verified, owned default payment-method pointer is shared by legacy and reservation charge paths; already authorized reservations retain their method.
- Native setup webhook recovery persists the verified method even if the app never returns. New partial unique index prevents duplicate saved methods per customer.
- AI reads only `QA_SNAR_AI_KEY` when `QA_AI_ENABLED=true` in QA. Retains the existing Emergent provider rather than silently introducing another provider or production key. Admin integration reload cannot bypass QA isolation. Provider chat sessions are namespaced per customer/environment to prevent shared provider history across users. Exception logs exclude provider messages/keys.
- Session restoration now starts while fonts load; source splash minimum is 1.6 seconds. A five-second font deadline and a ten-second auth request deadline prevent unbounded waiting. Storage failures expose the session retry view.

CHECKS PASSED:
- 73 backend tests across native wallet setup, ride reservations, mobile commerce/server truth, QA AI settings, support chat and integration settings.
- Native-wallet regression checks platform isolation, unsupported device, cancellation, pending backend status, test-key and merchant mismatches, and server-confirmed payment.
- Startup regression mounts the real root/auth modules with deterministic timers: session starts before fonts, minimum splash duration, font timeout, storage error and cleanup.
- Actual V10 component/checkpoint suite, Figma/mobile regression suite, customer TypeScript and whitespace checks passed. These do not establish device or real-provider acceptance.

## Continuation handoff — requested by owner at 01:28 Oslo
The owner wants a new chat to reduce conversation weight. Preserve the build hold and continue implementation from this file, fetching the actual QA branch head first. All necessary QA code changes, synthetic tests, normal commit/push and QA deployment are authorized. Do not force-push, merge main or modify production data.

### Immediate remaining actions
1. Confirm the next source checkpoint in Git history, then deploy it to `snar-api-qa` (autodeploy is OFF). Verify native public config and health plus actual server wallet setup behavior in QA. Do not start mobile builds.
2. Finish Resend QA configuration. The owner's Resend session is authenticated. Existing keys are old/shared; none was reused. Existing domains `kjapp.app` and `kjappapp.no` show Not Started, so no verified sender exists in the inspected account. A separate `qa-mail.snarapp.no` domain setup was initiated in Ireland and is currently on the DNS-record step, not verified. Dashboard URL observed: `https://resend.com/domains/add/e1dba859-8ac3-4021-81d9-bfa3857b751b`. Required DNS records relative to snarapp.no:
   - TXT `resend._domainkey.qa-mail`: `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDVJF8fntyYZyEqmaYOwhKPQZMu1vOQ3fRRoAc8GdhKTHzSinxxr7mKfH6Ib1jdrjsP0xhV1jZdazF9JJnVQ8DUoQOojoJlq1D6M0PjsmEP9RNhLcmwS6MjcLwGqkp7N0kVpjF6O//GWHcHRnxx/N0NHtR+9GkWa257hlmCLl4UYQIDAQAB`
   - CNAME `rsend.qa-mail` -> `rsend-euw1.forge.rmta.net`
   - CNAME `send.qa-mail` -> `send.forge.rmta.net`
   - TTL Auto. These are public DNS data, not secrets. Discover the actual authoritative DNS host, add only the QA subdomain records, then verify. Do not claim verification by clicking 'I've added the records' before DNS exists.
   - Intended sender after verification: `SNAR QA <noreply@qa-mail.snarapp.no>`. Configure `QA_RESEND_ENABLED`, `QA_RESEND_API_KEY`, `QA_RESEND_FROM_EMAIL` securely in Render. Create a QA-only sending key restricted to this domain; browser security policy requires confirmation at the final credential-creation action even with general task authorization. Never request secrets in chat or commit them. Account shows an unpaid-invoice banner; no billing action was taken and delivery blockage has not been proven.
3. Configure an isolated QA key with the existing Emergent provider (`QA_AI_ENABLED=true`, `QA_SNAR_AI_KEY`). No dedicated QA key has been found. Do not switch provider silently. Open the account/config UI and prepare the exact restricted credential action before asking any required final confirmation; continue other work meanwhile.
4. Admin/Fleet: existing Netlify sites are production (`kjapp-admin` id `b93e4ef0-cf6e-4453-bb93-925d1230354b`, `kjapp-fleet` id `4cef0cd7-fe1f-4672-8261-28996d7e6334`). No separate QA sites were found. Production currently uses `api.kjappapp.no`; do not repoint these sites. Prepare separate QA artifacts with `VITE_API_BASE=/api`, `VITE_APP_ENV=qa`, QA proxy `https://api-qa.snarapp.no/api/:splat`, noindex and commit evidence. The root netlify.toml is production marketing config and must not leak into QA panels. Connector can create sites/read config but has no deploy-upload operation; use authenticated CLI or permitted browser fallback as needed. No Netlify token is available locally.
5. Verify human support persistence/admin visibility, passenger/driver ownership, actual AI replies and actual Resend delivery. Device provider login, live-driver movement, wallet sheets/settlement and same-viewport design comparison are still unverified. Report these separately from passing local tests.

### Restored design and local work
Repository: `/workspace/scratch/545895e80915/snar-review` (external Git-backed; no separate Library copy of the repo).
Restored authoritative ZIP: `/workspace/scratch/545895e80915/design-reference/SNAR Fleet v2 Design System (3)(1).zip`; extracted `/workspace/scratch/545895e80915/design-reference/source`. Do not ask the owner to upload the same ZIP again. If scratch was reset, restore this named original file through Library.
Backend test interpreter: `/workspace/scratch/545895e80915/snar-perf-venv/bin/python`. Frontend dependencies installed; run its local `node_modules/.bin/tsc --noEmit` from `frontend`, not root npx.
