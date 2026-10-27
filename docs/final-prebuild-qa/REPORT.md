# SNAR final pre-build QA — 27 October 2026

**QA decision: B — CODE READY, EXTERNAL CONFIGURATION BLOCKS RELEASE.**
**Release build: BLOCKED. No QA result A exists for this cycle. No APK/AAB/IPA/TestFlight build was started.**

The release objective is production with real Stripe, real customers and real fleet owners. QA is the isolated verification stage, not the intended production business environment. Customer and Driver design freeze was preserved; no frozen screen was redesigned in this QA cycle.

## Re-audit and source

- Repository: `foziakahero-dot/Emergent-kjapp-taxi`.
- Initial local Launch Candidate: `launch/snar-v1-final-20261026 @ b31c1ed292a9f34ae074d9e64367640f8417e90b`, clean. Its tree matched published candidate `8114164cf220aa2b170eb2cca12511218a56b99a` exactly.
- QA work branch: `qa/snar-v1-prebuild-20261027`; code and harness changes are recorded in logical commits, not force-pushed.
- Final implementation candidate: `c8ee166a8d30027b8fb9355f7e7bc84806d52136`, tree `0113360a1b2311136922de2b4a00929c806b706e`.
- Existing QA source branch: `qa/snar-v10-phase5-staging-e2e`. Previous QA history is retained as a merge parent; the selected runtime tree is the inspected candidate tree, without restoring old Driver social login or weakening payment isolation.
- Final QA API source: `f52b6bfba556a9baf9bf4a11acad5138fa60071d`; Render deploy `dep-dbgh5jnf3r2c73ek0k2g`, service `srv-db61otlckfvc73bqp480`, confirmed workspace `tea-dassqnrbc2fs73a770i0`. Deploy reached LIVE.
- QA API: `https://api-qa.snarapp.no` for **both** tested apps.
- Production API: `https://api.kjappapp.no`, still source `02ed5c061d34f80f5b255a2f270a4903aa3c271e`. PR #135 remains the production promotion candidate; it was not merged/deployed in this QA cycle.
- Customer path: `frontend/`; Driver path: `driver-app/`.
- Default app startup still targets production. QA exports explicitly used `EAS_BUILD_PROFILE=qa`, `EXPO_PUBLIC_BACKEND_URL=https://api-qa.snarapp.no`, and a cleared Metro cache. Initial cached web exports incorrectly retained production URLs; they were discarded for testing. Active entry bundles were checked directly: both use QA, with no production API literal. See `environment-proof.json`.
- Configured app version: `1.0.0` for both. EAS uses remote version sources; no new remote build number was allocated or assumed. Identifiers, schemes and project IDs are in `app-config.json`.
- This report commit changes verification material/tools only after the listed implementation source. Build validation must not mistake a changed documentation SHA for a different mobile/backend implementation.

## Launch Candidate commits

- `c8ee166` test: keep GPS freshness independent of AST parse time
- `876fc40` test: start dispatch clocks inside each regression fixture
- `fab0f43` test: align ETA, identity and sequential dispatch regression fixtures
- `e4f74e4` fix(fleet): validate company intake and secure password changes
- `7bc249f` fix(admin): resolve JSON request models for real fleet onboarding
- `8114164` docs: record production launch verification and explicit provider gates
- `3436f26` test: verify current Driver auth and component payment contracts
- `f08abee` chore(mobile): align Expo 57 patch dependencies
- `7d61b71` fix(customer): integrate the approved original live vehicle marker
- `841c5ac` fix(driver): honor identity policy and synchronize offer countdown
- `232e80c` fix(finance): preserve zero commission across reports and exports
- `afbc13e` fix(mobile): guard native notifications and bound Driver startup
- `e616b16` fix: recover card setup and isolate transactional onboarding delivery
- `84d35fb` feat: stabilize Driver readiness and snapshot subscription fares
- `1320e22` feat(customer): focus map, bound search and simplify navigation
- `95ca119` feat(customer): add provider-verified phone login with safe fallback
- `372e7d9` docs: audit launch source, infrastructure and baseline blockers


## Independently repeated checks

| Check | Result | Scope |
|---|---|---|
| Backend regression | 538 passed, 11 subtests passed, 0 failures | All `backend/tests/test_*.py` except historical `test_iter*` scripts that target other legacy external deployments. One upstream Starlette/AnyIO deprecation warning. `backend.xml` (oversized input-parameter names fingerprinted with SHA-256; all results retained) |
| Customer and Driver TypeScript | PASS | Both app directories |
| Expo dependency check | PASS with offline caveat | Existing Expo 57 patch versions; no dependency upgrade in final QA |
| Web exports | PASS | Explicit same QA URL; direct local Expo CLI, cleared cache; no native/cloud build |
| UI smoke | 22 scenarios PASS | Intercepted synthetic fixture APIs only; 390×844; no page exceptions, horizontal overflow or wrong API target. `ui/ui-results.json` |
| Session lifecycle | 2 provider tests PASS | Actual Customer/Driver AuthProvider login, remount persistence, logout and expired-session cleanup using isolated storage/API adapters; no real credentials |
| Root checks | 20 PASS | Real hooks for feed expiry/radius/own-position exclusion/socket recovery, search Back/reopen, approved assets, payment imports and QA configuration guards |
| Driver helpers | 6 PASS | Server/monotonic offer clock and truthful pending-payment summary behavior |
| QA bundle guard | PASS | Rejects production/mixed/missing target; checks active bundle referenced by index.html |
| Admin and Fleet compilation | PASS | Admin TypeScript + Vite; Fleet TypeScript + Vite. Admin bundle-size warning is advisory. Fleet has no committed lockfile; dependencies installed without creating a replacement lockfile |
| Live QA health/readiness | 200/200 | QA environment, isolated database, Stripe test mode, auto-charge off. Does not prove email/provider readiness |
| Live QA OpenAPI/auth boundaries | PASS | Schema generates; Admin/Fleet JSON models are bodies, unauthenticated Driver/Fleet/Admin requests return 401. Live route/method compatibility is in `api-compatibility.json` |
| QA destination search | HTTP 200, 3 results with coordinates | Public QA address search for Majorstuen; no account token |
| Map provider fetch | HTTP 200 image | Public Esri tile for Oslo; proves provider fetch, not native Mapbox rendering |
| Live Stripe account | BLOCKED by Stripe verification | Kjappapp / KJAPP TECH AS: `charges_enabled=false`, `payouts_enabled=false`, `details_submitted=false`, `card_payments=inactive`, `disabled_reason=requirements.past_due`. Existing production webhook is enabled. See `stripe-production-readiness.json` |

## Defects fixed during final QA

1. **P1, Admin/Fleet JSON request parsing.** Installer-local request models were deferred string annotations, leaving FastAPI unable to resolve them as JSON bodies. `/openapi.json` returned 500; affected Admin fleet invitation/vehicle/user actions could not consume their intended requests. Concrete annotations restore body parsing. Live QA schema now succeeds; local ASGI tests retain 401 authorization and require valid JSON bodies before reaching the fleet lookup.
2. **P1, real fleet intake guards.** Public intake now validates the Norwegian organisation-number check digit, recognizes legacy formatted identifiers, rejects existing open/approved/company duplicates and serializes submission for the same organisation using the existing TTL collection and unique key. Parallel drafts cannot both become pending. Existing approved records are not rewritten. Manual document/licence/identity approval is still mandatory; a valid check digit is not proof of business identity.
3. **P1, account password rotation contract.** Authenticated password change verifies the current password, rate-limits attempts, uses a compare-and-set credential update, clears temporary-password state and invalidates older sessions. It issues a replacement session after the update. No password is sent by email and no real account credential was changed during QA.
4. **QA target safeguard.** Cached exports had production URLs despite intended QA configuration. The repeatable preparation tool uses fresh output, cleared cache and verifies the actual referenced entry bundles. Fixture UI tests reject any API origin other than the selected QA API, rather than silently fulfilling the wrong host.
5. **Test-harness repairs.** Historical tests assumed removed Driver OTP/offer-socket behavior, moved UI components, unlabelled ETA policy, missing identity-policy globals or a wall clock captured during collection. Updated fixtures preserve role, ownership, 2FA, expiry, payment and concurrency checks. Actual handler tests cover the revised contracts. Production freshness/deadline thresholds were not widened to make tests pass.

The organisation-number check follows Brønnøysundregistrene's published modulus-11 weights: https://www.brreg.no/om-oss/registrene-vare/om-enhetsregisteret/organisasjonsnummeret/ . No legal/entity-ownership conclusion is inferred from this check.

## Customer evidence and limits

- Phone/OTP: provider-backed existing-account flow tested locally; live QA reports `enabled=false`. New phone-only registration is not implemented; existing account creation alternatives remain.
- Google: live Customer config enables Google and has a web client ID; iOS client ID is absent. Provider signatures/issuer/audience/linking tested locally. Native Android/iOS login is not runtime-certified.
- Apple: iOS implementation and configured bundle preserved; only supported iOS can show Apple. Physical Apple login is not certified.
- Session/login/logout: actual provider logic passes isolated lifecycle tests. Remote signed-in session persistence was not exercised.
- Home/search: web fixtures and actual component tests cover destination selection, minimize/reopen with query retention, loading/errors, 3 navigation items and secondary AI. Public QA geocoding succeeds.
- Vehicles: original approved PNG bytes/hash/RGBA/dimensions verified; map marker renders in local UI. A fixture representing the Customer's own ID is rejected as a car. Actual feed tests cover 5 km, online/available status, freshness, movement, category and late HTTP/socket recovery. Native bearing/anchor and real Driver visibility still require devices.
- Empty supply: the exact `Ingen biler tilgjengelig akkurat nå` state is implemented. Unavailable providers are not presented as success.
- Booking/payment: actual isolated handlers cover stored-card ownership/mode, authorization before dispatch, failure/release/capture, return adapters and immutable fee snapshots. Native PaymentSheet, a real test-mode authorization/capture and production live-card payment were not performed in this cycle.
- Android/iOS safe areas, keyboard and foreground/background behavior are not certified by a desktop web viewport.

## Driver evidence and limits

- No Google/Apple sign-in in the Driver app/auth contract; live QA config disables both. Real password-handler tests cover email/phone, wrong role/password, disabled account and 2FA.
- Optional first selfie follows server policy; required recheck is still blocking. Profile, approval, selected vehicle and documents remain server gates.
- Home is explicitly offline/online, with one primary action and Hjem/Turer/Inntekt/Konto. Fixture screens and TypeScript pass.
- GO ONLINE → GPS → eligible supply → real Customer map → offline removal: **NOT VERIFIED end-to-end**. Local handler/feed coverage is not substituted for this P0 verification gate.
- Incoming offer: actual atomic sequential-dispatch tests prove one offer, 30-second maximum per Driver, rejection/timeout/next eligible Driver and 60-second overall search. Monotonic display projects server time. Real push/background arrival is not certified.
- Pickup/start/active/complete/cancellation/payment states are tested through isolated canonical handlers. Native navigation, cross-app synchronization and completed paid-trip history/earnings are not live-certified.
- Biometrics are not offered by the current Driver login; no unsupported biometric claim is made.

## Exact E2E stop and automatic approval rejection

The remote account-based run stopped **before QA account login**. Automatic approval review rejected transmitting previously retrieved QA credentials to `api-qa.snarapp.no` and persisting session tokens locally, stating that the current trusted instruction did not explicitly authorize this credential use. No workaround, alternative credential channel, account reset or authentication bypass was attempted.

A separate read-only check using the previously supplied Resend key was also rejected by automatic approval review because explicit authorization for using that credential in the check was not recognized. This was not retried through another channel. Provider/domain validation and message delivery remain unverified.

Consequently the chain has not been certified past authentication: GO ONLINE, real GPS supply, real Customer live-car visibility, booking, Stripe confirmation/capture and both histories/earnings all remain live E2E gates. No real Customer/Fleet/Driver data, real payment, real payout or production test ride was created.

## External actions still required, separately

1. Explicitly authorize use of the previously supplied QA account credentials against the QA API for controlled verification; keep credentials/session tokens in memory for the test rather than a disk artifact.
2. Explicitly authorize a read-only Resend key/domain check; configure the correct verified production sender/key and isolated QA sender/key. Live readiness currently reports email unconfigured. Then verify registration/approval/invitation/reset delivery without exposing passwords or tokens.
3. Configure isolated Twilio Verify credentials and enable Customer OTP in the intended environments; test delivery and invalid/expired codes.
4. Supply/verify the Google iOS OAuth client and baked URL scheme; verify Android OAuth package/signing/Firebase configuration through secure EAS configuration.
5. Verify Apple Sign-In capability/entitlement and runtime on iOS.
6. Verify Apple Pay merchant ID, processing certificate and app capability before enabling it.
7. Verify Google Pay Android/merchant production readiness before enabling it.
8. The Stripe account owner must complete the account's overdue verification: correct company identity/address, bank account, beneficial-owner details, representative city and Stripe terms acceptance. A company document is pending verification. Stripe currently disables both charges and payouts; live keys and an enabled webhook do not override this. After Stripe enables card payments, verify the production configuration and explicitly activate native cards, then complete controlled card setup → app return → authorization → dispatch → capture, plus declined/insufficient funds and cancellation/release. No identity details, bank details or acceptance were fabricated; no payment flag was changed while the provider blocks payments.
9. Run the full Customer/approved-Driver flow on two devices, including GPS/background/realtime, offline removal, trip completion and histories/earnings. Synthetic fixture vehicles are not production approval or real GPS evidence.
10. Promote the reviewed candidate to the production branch/API only after the required verification. Production remains `02ed5c0`; no claim that native users already have the new frontend. Then repeat production read-only checks and an explicitly authorized controlled real-payment test.
11. A later release build must confirm secure EAS secrets and remote version/build numbers. No build is authorized by a non-A QA result.

## Classification and release gate

- Known code P0 remaining after these fixes: 0 demonstrated; this is not proof that untested critical device/provider paths are clear.
- Known code P1 remaining after these fixes: 0 demonstrated in the covered scope.
- External P0 payment blocker: the production Stripe account cannot accept charges or payouts until its overdue verification is completed and accepted by Stripe. External P1 workflow blockers: SMS, email and native payment/social/provider readiness where required. Native GO ONLINE/payment/cross-app evidence is a mandatory blocked verification gate, not a passed test.
- P2/P3: native visual/safe-area/keyboard confirmation remains pending; Admin bundle-size warning and upstream/test-runner deprecations are nonblocking. Phone-only new-account creation and recurring subscription billing are not implemented by this cycle; existing registration and zero-commission trip snapshots must not be confused with those capabilities.
- **QA B; not A. Release builds BLOCKED.** No further product/design changes or build are triggered by this report.
