# SNAR Customer pre-build report — 4 October 2026 (Europe/Oslo)

**BUILD BLOCKED. Customer is implemented in part and source-validated; it is not production ready. No APK, IPA, TestFlight or EAS build was started. Driver implementation was not changed.**

## Source and checkpoint

- Customer branch: `audit/customer-prebuild-snar-20261003`, starting commit `ebb76fc009ba8d7daed8b24e50ea5a9a70ed0cbe`.
- Backup: `backup/customer-prebuild-snar-20261004` at that starting commit.
- PR #64: draft, head `ab23e2825a47d6adcfadf1cc080198c17b87b8e9`.
- PR #65: draft, head `85d2c19bdbc5aa74f1abfd306e51909e53a4505e`. Customer PR is stacked on its design branch; neither PR was merged.
- Render starting head: `d93cbb6c8282e82e52fbb5674087103928814daa`. Backup: `backup/customer-api-preprofile-20261004`.
- Latest user-provided design source: `Revolutionary AI Taxi App Design (3).zip`, especially `src/apps/CustomerApp.tsx`, screens, `LiveMap.tsx`, `SnarMark.tsx` and `src/index.css`. Archive/source SHA-256 checkpoint: `FIGMA_CUSTOMER_SOURCE_20261004.json`.
- Figma Make connector supplied source resource links but no renderable native screenshot. The attached ZIP is the actual source used. No Supabase runtime was introduced.

## Implemented and locally verified

- Native `InteractiveMap` resolves to `@rnmapbox/maps`. Raster fallback is separate and explicitly reports missing native map configuration. Loading/error/retry states exist. Lines require backend route geometry; fabricated pickup-to-destination straight lines were removed.
- Nearby cars retain stable IDs, interpolate position/heading and distinguish the assigned car. Heading zero and heading-only changes work. Backend excludes demo/internal/offline/stale/unavailable and already assigned drivers using existing compliance rules plus an active-trip check. Physical map rendering remains unverified.
- Category display names are SNAR / SNAR XL / Premium; existing `ai-first` / `trygg` / `premium` IDs are retained. Exact standard/van/premium vehicle SVG paths from the latest ZIP replace one generic silhouette. Existing red app icon bytes are retained.
- Active trip can minimize/reopen without resetting backend state. Home polls `/trips/active` on focus and foreground, shows persistent driver/status/vehicle/ETA card and reconciles missed request responses. Booking is disabled until active state is confirmed and while an active trip exists. Component test covers minimize → reopen and completed → receipt.
- Customer profile photo: authenticated upload/read/delete, camera/gallery/crop/progress/replacement/fallback. Dedicated MongoDB document per customer, atomic replacement, max 5 MB upload, JPEG/PNG/WebP content validation, 20 MP bound, re-encoding to max 768px JPEG and EXIF/GPS removal. Images are private, no-store and scoped to the current customer. No Render local disk or public bucket URL is used. Export and erasure include the photo. Role/auth/isolation/image validation/replace/delete/export tests pass.
- Explicit authenticated Google linking requires the same verified email and refuses another account's subject or replacement of an existing subject. Existing native login, audience checks, legal routing and 2FA restrictions are retained. Customer identity error messages use SNAR. Real OAuth configuration is still absent.
- Native Stripe requires matching test publishable/secret or restricted keys. Live native key combinations are refused. Existing server fare, fleet split, shared trip lock, deterministic idempotency, webhook/retrieval reconciliation and PaymentSheet flow are retained. The UI reports actual wallet availability; it does not claim wallets are operative. No live payments or activation flags were enabled.
- Customer-visible branding migrated to SNAR. Bundle identifier, Android package, EAS project, `kjapp` URL scheme/token storage and existing domains remain compatible. Customer receipt email subject uses SNAR.
- Transient auth/network failure preserves the stored session and offers retry; actual 401 clears it. Estimate responses cannot overwrite newer destination estimates. Duplicate booking/payment/chat/export/delete/link actions have guards. Chat errors are visible. History opens live/cancelled trips instead of doing nothing. Settings read failures show retry, failed updates roll back and deletion failures are visible. GDPR export shares actual JSON, including the protected photo, rather than only counts.
- Cancellation stays on the current trip unless the server confirms success or a fresh canonical read confirms cancellation after a lost response. Preview/confirm/submit guards prevent duplicate dialogs and requests; assigned trips expose cancellation with server fee preview. Safety share/report errors stay visible, double taps are guarded, and opening the emergency dialer does not wait for network logging. No actual emergency call was made by validation.
- Driver ETA/distance require valid coordinates and a server GPS timestamp within 30 seconds (up to 5 seconds clock tolerance). Missing, invalid, stale or future GPS reports a location wait rather than a current ETA; network failure is a separate status. Driver photo load failure falls back to the actual name initial.
- Search ignores responses for older queries, distinguishes a network failure from zero results, offers retry and cancels unsent work on unmount. Home recents now come only from valid finished customer trips, deduplicated by destination; public featured places are not relabeled as personal history. Home reconfirms canonical active state on every focus before enabling booking.
- Session generation guards prevent old refresh success/401 from changing a newer login. Logout completes local sign-out without waiting for remote cleanup; push unregister and backend logout keep the captured old session header. Cold offline launch retains the token and offers retry. These boundaries pass isolated component tests; full native lifecycle acceptance remains open.
- Fail-closed gate is checked by `eas-build-pre-install`, `npm run android`, `npm run ios` and the Customer jobs in existing Android/iOS GitHub build workflows. Its current refusal was exercised. Gate state is `frontend/customer-build-gate.json`; code is `frontend/scripts/customer-build-gate.cjs`.

## Quality gates and evidence

| Check | Result | Scope / limit |
|---|---|---|
| npm install and lock | PASS | SDK 57 dependencies; image picker ~57.0.20; Pillow pinned 11.3.0 |
| Customer TypeScript | PASS | `npx tsc --noEmit` |
| Component/design tests | PASS | `npm run test:design`; real component logic with isolated fixtures; not a live taxi E2E |
| Focused backend tests | PASS | 47 tests: `test_mobile_commerce.py`, `test_customer_profile.py`, `test_security_regressions_unit.py`; also pass against the Render-compatible server retaining hotfixes |
| Expo Doctor | PASS | 21/21 after generated native directories were moved outside the source project; temporary non-CNG warning resolved, not ignored |
| Expo config | PASS / config gaps | SNAR display name; approved icon; existing identifiers/API target; Apple Sign-In plugin, Stripe, Mapbox, image picker and notifications present |
| Android native prebuild | PASS | `npx expo prebuild --platform android --no-install`; no Gradle compilation or installed APK |
| iOS native prebuild | PASS | `npx expo prebuild --platform ios --no-install`; no Xcode compilation/signing/IPA |
| Android Hermes export | PASS | `npx expo export --platform android`; includes native dependency imports; does not compile native SDKs |
| iOS Hermes export | PASS | `npx expo export --platform ios`; same limitation |
| Broader available legacy suite | FAIL | Same expanded 92-test selection: starting checkpoint 10 failed / 82 passed; changed source 3 failed / 89 passed. Restored exact source fixtures and repaired seven harness/obsolete Customer assertions. Remaining three failures are unchanged Driver assertions; Driver source was verified against the original audit blobs and not modified. Full suite is not green |
| Static beta policy | PASS / release warning | Source policy passes with real fixtures. Existing beta placeholder privacy/terms text remains a blocker for public commercial release |
| API contract result | FAIL | All 77 source contracts map to routes, including support/push/protected image GETs. Required authenticated/native runtime acceptance is missing; source presence alone cannot yield PASS |
| Figma parity | PARTIAL | Shared colors/fonts/motion source checked; latest category paths ported. No per-screen native pixel comparison |
| Customer E2E | PARTIAL | Tested individual backend/component boundaries; 31-step physical rider/driver/payment sequence not executed |

Full matrices: `CUSTOMER_SCREEN_MATRIX_20261004.json` (43 rows, every requested column), companion Markdown, `CUSTOMER_ACTION_INVENTORY_20261004.json` (184 actions), `CUSTOMER_API_CALLERS_20261004.json` (143 callers), `CUSTOMER_API_CONTRACT_20261004.json` (77 contracts), `CUSTOMER_BACKEND_ROUTES_20261004.json` (216 routes).

Regenerate source inventories with `npm run audit:customer`. JSON states are deliberately PARTIAL wherever device/runtime evidence is missing. Disabled prototype-only accessibility choices and unavailable rewards are identified in source; no success is fabricated.

## P0 blockers

1. **Google OAuth missing in live backend.** `/api/auth/native/config` returns `google_enabled:false` with empty Web/iOS IDs. Configure actual Google project clients, package/signing fingerprints, accepted Web audience and compiled iOS scheme; test chooser/cancel, existing password accounts, explicit linking and consent on Android/iOS.
2. **Stripe test native payments disabled.** `/api/payments/native/config` returns disabled, empty publishable key and no enabled wallets. Provision matching account test keys securely in Render, confirm existing webhook signing secret, then run test PaymentSheet/3DS/webhook replay/duplicate/lost-response acceptance. Never put keys in Git or chat.
3. **Native Mapbox runtime unverified and public access token missing from available Customer environment.** Set the actual allowed public access token in the Customer build environment. Check SDK download credentials if native compilation requires them. Prove native map, attribution, camera, geometry, real car heading/motion and error fallback on device.
4. **Reset/receipt email sender is not configured.** Live `/ready` reports `email_configured:false`. Set the existing server email provider/domain securely and verify reset deep links, expiry and receipt delivery.
5. **Physical Customer E2E/native acceptance missing.** Registration/login → real map/nearby drivers → route/fare → single booking → real matching/driver movement → minimize/tab/cold recovery → chat/safety → driver ends trip → test payment → receipt/rating → clean home. Include outage, denied permissions, no cars/card, stale GPS, cancels and background/foreground. No available authorized device/simulator/session was used to claim these results.

## P1 blockers / open review

- Pixel comparison of every native screen to the latest source remains open. Latest ZIP's category artwork is vector silhouettes and its tiers are Standard/Comfort/Premium/Van/accessible; the earlier requirement asks for three primary categories and realistic renders. Three existing backend IDs were retained and latest provided paths used. Realistic renders/full tier redesign were not invented. Confirm final asset/tier specification before pixel approval.
- Apple Pay registered Merchant ID, Stripe Apple Pay certificate, provisioning and merchant entitlement are absent. Google Pay runtime activation is absent. Sign in with Apple entitlement is generated, but App Store capability/provisioning and hidden-email/existing-account physical login are unverified.
- FCM/APNs delivery, push permission/token registration, external payment browser callbacks, reset/universal links, authenticated Image transport, keyboard/safe areas and OS export sharing remain unverified.
- Three existing Driver-only regression assertions still fail. No Driver implementation was changed; these remain tracked rather than waived as a green full-suite result.
- Existing public privacy/terms pages still contain beta placeholder text. Source static policy permits controlled beta; commercial public release requires actual approved legal content.
- Reward redemption and app-specific high-contrast/haptic preferences remain explicitly unavailable. Native OS accessibility settings are linked. These UI surfaces do not claim a backend success.

## External configuration still needed

| Platform | Actual configuration required |
|---|---|
| Render Google | `GOOGLE_CLIENT_ID`, Customer `GOOGLE_IOS_CLIENT_ID`; web secret/redirect only if web OAuth is enabled |
| Google Cloud / EAS | OAuth clients for `no.kjapp.app` with actual signing SHA-1/SHA-256; iOS `no.nexorahub.kjapp.customer`; `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` matching backend |
| Mapbox / EAS | `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`; authorized native SDK download credential if required |
| Render Stripe | Account Kjappapp TEST key pair (`pk_test` + matching `sk_test`/restricted test key), existing `STRIPE_WEBHOOK_SECRET`; only after secure setup enable `NATIVE_PAYMENTS_ENABLED` / Google Pay test flag |
| Apple / Stripe / EAS | Actual Merchant ID, Stripe Apple Pay certificate, entitlement/provisioning; matching backend `APPLE_PAY_MERCHANT_ID` and Customer `EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID` |
| Email / Push | Existing email sender credentials/domain; real FCM/APNs credentials and physical delivery verification |

The connected Stripe account was verified as Kjappapp TEST, `acct_1TGAN5KFJCRyVUgj`. Existing enabled webhook `we_1UMKcTKFJCRyVUgjzzOyDoiA` points to `https://api.kjappapp.no/api/stripe/webhook`, with PaymentIntent and Checkout events. Connector access did not provide safe issuance/retrieval of the required payment API key pair, so none was guessed or exposed. The old `/ready` object-storage flag concerns the existing general store; Customer photos use the authenticated Mongo store introduced here.

## Render deployment and commit log

Service `kjapp-beta-api`, My Workspace, existing branch `fix/beta-mobile-firebase-ops-20260926`, existing build/start commands and auto-deploy off were retained.

- `4d4dd5050c3d225b07a6892ef8c4b74477ee9c92`: protected photo routes/storage/GDPR, explicit Google linking, available-car filtering, test-only native payment config, receipt subject and tests. Deploy `dep-db0p65vavr4c738o8g9g` verified **live**; post-deploy health 200/db true, protected photo/link routes 401 without session, and no error logs in the checked startup interval.
- `865023425d48acc5c0c665ae248d828a689fceb0`: SNAR branding for Customer identity errors; Driver response branding preserved. Final deploy status is recorded in `CUSTOMER_VALIDATION_EVIDENCE_20261004.json`.
- Continuation review includes the network/cancellation/search/session/GPS fixes above and an updated source matrix; Customer continuation source commit: `56682d2e24e164acfad3ce06fa52df3f2c649052`. Evidence documentation checkpoint: `7eceba2bca157b4a182a55c659f9a29f9394f845`. No backend runtime change or additional Render deployment was needed for this continuation.
- Initial Customer implementation commit: `92b957e4f0581811bcdb6895551ca3b2940679b8`, draft PR [#67](https://github.com/foziakahero-dot/Emergent-kjapp-taxi/pull/67). All commits include `[eas skip]`.

Unauthenticated live smoke confirms health/auth boundaries/configuration availability. It does **not** validate a logged-in upload, link, booking or payment. No new test users, live charges or fake nearby cars were created.

## Remote CI status

GitHub Actions runs `37163387691` (push) and `37163390226` (PR) report `startup_failure`, path `BuildFailed`, with no jobs started. The same startup failure is present on the unchanged PR #65 head (runs `37097397045`, `37087528954`, `37087526771`). The connector exposes no diagnostic jobs and rejects check-suite detail retrieval, so the root cause is **unverified**; do not infer billing or a particular YAML error. The five edited build workflow files parse as valid YAML locally. Continuation source `56682d2e24e164acfad3ce06fa52df3f2c649052` also reports `startup_failure` for push `37165251333` and PR runs `37165253215` / `37165272537`; the queried run has zero jobs. Remote CI is not a PASS and must be restored before gate approval. No native compile/EAS build was launched by these runs.

## Build decision

P0 > 0. API runtime and native/device gates are not PASS. **Do not build APK/TestFlight.** EAS build ID, workflow build ID and install artifacts: **not created**. Complete external setup and the above acceptance evidence, resolve P1 review, then explicitly refresh the checked-in gate; a JSON PASS requires real evidence, not a source-route count.
