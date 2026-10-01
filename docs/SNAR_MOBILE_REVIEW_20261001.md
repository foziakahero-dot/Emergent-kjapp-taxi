# SNAR mobile corrections and screen review

PR #60 remains **Draft**. No merge, production deployment, signed native build or physical-device test was performed.

## Reference and limits

- Starting head: `b8e245d7a3bdff347a99730a377c24af31c6dad4`, branch `snar/mobile-ui-review-20260930`.
- Mobile files were materialized from that exact GitHub commit, with every downloaded blob SHA verified. This is a clean validation snapshot, not the user's local desktop checkout. Local untracked helper/plugin files were not included or changed.
- Design reference: the previously uploaded `Revolutionary AI Taxi App Design (2).zip` (2026-09-30), including `src/apps/CustomerApp.tsx`, `DriverApp.tsx`, `TaskBar.tsx`, `SnarMark.tsx`, `Splash.tsx`, `Login.tsx` and `index.css`.
- The Figma Make connector identified the same source filenames in file `y94k21wsXX8d9sI966cOAY`, but the resource reader could not retrieve them. No current Figma screenshot was returned. The exported ZIP is the available comparison reference; its equality to the latest Make revision is unverified.
- This is a source-level screen comparison. Local browser rendering failed, and `adb`/a native simulator are unavailable. No screenshot overlay, visual diff score, or pixel-perfect result is claimed.

## Functional corrections

1. Backend `SettingsUpdate` now accepts only `google`, `waze` or `apple` for `navigation_app`; new settings default to Google. Existing authenticated user-scoped database updates/readbacks are retained. The mobile selector waits for server confirmation, reports save failures, blocks concurrent selections and caches preferences under the authenticated account ID. It no longer shares the legacy global key or displays an unconfirmed save as successful.
2. Driver iOS declares Waze, Google Maps and Apple Maps query schemes. An Expo config plugin adds Android VIEW queries for Waze and Google navigation while preserving existing queries. Existing navigation coordinates, intermediate stops and browser fallback are retained. These native declarations require a fresh native build.
3. A finished trip is automatically dismissed only after `payment_status == paid` and while its card is visible (not covered by an active trip or offer). A manually dismissed pending summary uses a different receipt from a paid summary, so a later paid response can display the confirmed earnings. Dismissal is scoped to the account. The timer depends on both trip and payment status and cannot clear a different summary. This does not change charging, amounts, dispatch or backend trip states.
4. Both web TileMap control icons use white on the existing dark surface instead of navy on dark.

The settings correction adds a narrow backend change to the original mobile-only PR. The backend must be released before the new selector can confirm a saved choice against production. Until then the selector shows an error rather than claiming success.

## Source-level screen comparison

All rendered screens inherit a typography mismatch: reference Inter versus implementation Geist (JetBrains Mono is shared). Shared background `#F4F6FA`, white surfaces and navy `#001F3F` match; reference primary red `#FF0000` versus app `#D60013`, and online green `#12B981` versus app `#16734D`, differ. The darker app action colors also change contrast. These findings establish that the design is **SNAR-inspired, not a pixel-for-pixel port**.

| Screen / state | Reference → implementation | Confirmed source difference |
|---|---|---|
| Customer splash | `Splash` → `frontend/app/index.tsx` | Reference radial background, 104px mark, 60px wordmark and centered compact CTA; app solid background, mark inside a 132px frame, 52px wordmark and bottom full-width CTA. App retains KJAPP name. |
| Driver splash | `Splash(driver)` → `driver-app/app/index.tsx` | Shared reference composition versus separate app onboarding/layout and KJAPP Driver text. |
| Customer login | `Login(customer)` → `frontend/app/login.tsx` | Different header, social-button placement, field spacing and typography. Real Apple login remains iOS-only. |
| Driver login | `Login(driver)` / invitation flow → `driver-login.tsx` | Existing credential login and invitation requirement retained; prototype onboarding/contact/password steps are not replicated screen-for-screen. |
| Customer permissions/setup | `Permissions`, `ProfileSetup` → native permission calls / register / legal consent | Reference standalone permission cards and profile/payment/address setup have no exact matching app routes. |
| Customer home | `Browse` → `(app)/home.tsx` | Reference top search bar and bottom category sheet versus app destination entry inside the sheet plus profile/map controls. |
| Customer search | expanded `Browse` → `SearchSheet` in home | Similar full-screen search intent; different control placement, row structure and sizing. App has explicit minimize/close controls. |
| Customer vehicle choice | reference category cards → `VehicleAsset` and home | Reference five choices (AI, Comfort, Luxury, Van, wheelchair); app uses its configured vehicle types and custom SVG side-view art. Not identical assets or card layouts. |
| Confirm booking | `Confirm` → selected destination state in home | Reference separate confirmation page versus app in-sheet price, payment and needs controls. Real pricing must remain server-derived. |
| Matching / driver arriving / in trip | `Matching`, `Arriving`, `InRide` → `booking/[tripId].tsx` | Separate prototype screens versus one canonical server-state booking route. Driver/routing cards, state transitions and controls differ. |
| Customer receipt | `Receipt` → `receipt/[tripId].tsx` | Reference static paid summary versus app server-confirmed payment, receipt and rating states; structure and spacing differ. |
| Customer history | `Activity` → `(app)/history.tsx` | Prototype section cards versus app real trip list and empty/error/loading states. |
| Customer wallet/payment | `Wallet`, profile payments → `payment-methods.tsx`, `payment/success.tsx`, `payment/cancel.tsx` | Separate production payment flows; no exact match to prototype wallet/rewards screen. No fake balance or payment capability was added. |
| Customer profile/settings | `Profile`, `Sub` → profile/settings/saved-places | Prototype nested panels versus separate production routes, different rows and grouping. |
| Customer support/assist | prototype `Support` → `(app)/assist.tsx` and existing support links | Different conversational surface and available actions; prototype FAQ/reward content is not an implemented equivalent. |
| Customer register/reset/legal | register, forgot/reset and legal routes | No exact screen-by-screen reference for every production route. Retain real account and consent behavior. |
| Driver dashboard | `Dashboard` → `(driver)/home.tsx` | Reference identity/toggle header and offline dashboard versus app compact status control, map and operational bottom sheet. Prototype demand heat circles are not real backend data and must not be copied as live demand. |
| Driver offer | `RequestModal` → home offer state | Reference modal versus operational sheet with real offer expiry and customer data. |
| Driver to pickup / at pickup / in trip | `ToPickup`, `PickupConfirm`, `InTrip` → home active states | Reference separate screens and slide-looking CTA versus app state-based card/actions, minimize/reopen, external navigation and messaging. |
| Driver finished | `Complete` → home completed summary | Reference full confirmation versus compact pending/paid earnings summary. The payment dismissal correction preserves server truth. |
| Driver earnings | `Earnings` → `(driver)/earnings.tsx` | Reference red gradient weekly hero and 36px value versus app white surface, green accents, 44px value and period selector. |
| Driver profile/settings | `DriverProfile` → profile/driver-settings | Different route grouping, cards, fleet and account sections. |
| Driver vehicles/identity/photo | onboarding vehicle/documents/selfie → driver-vehicles/driver-identity/driver-profile-photo | Real standalone operational screens; differing step/navigation geometry. |
| Driver trips/reset/legal | driver-trips, forgot/reset, driver-legal-consent | Additional production routes with no complete equivalent in the design export. |
| Bottom navigation | `TaskBar` → app tab layouts | Customer reference floating rounded four-tab bar (Reise/Aktivitet/Lommebok/Profil) versus app fixed three-tab bar (Hjem/Turer/Profil). Driver also uses its own native tab layout. |
| Map and car markers | `LiveMap` → InteractiveMap / TileMap / CarMarker | Different renderers, markers and controls; the prototype's demo cars cannot replace online cars from the backend. Native map geometry requires device screenshots to assess. |
| Brand mark | `SnarMark` → both `BrandBadge` components | Chevron path/viewBox/radius proportions match, but gradients, shadows and animation differ. App accessibility labels and visible wordmark still say KJAPP. |

The matching work is therefore still an open review item. Compare equivalent live states at identical viewport/safe-area dimensions before accepting fidelity. Include small/large phones, keyboard-open search/login, loading/empty/error states, online/offline, pending/paid completion and real car-marker density. Do not copy prototype people, balances, sample prices, demand overlays or unsupported actions into production.

## Validation performed

Runtime: Node `24.19.0`, npm `11.9.0`. `npm ci` succeeded using existing lockfiles in both app folders. No dependency or lockfile changes.

| Check | Result |
|---|---|
| Full `npx tsc --noEmit`, clean Customer snapshot | PASS |
| Full `npx tsc --noEmit`, clean Driver snapshot | PASS |
| Expo config/prebuild for both apps | PASS |
| Driver config introspection | PASS: iOS schemes and Android manifest queries generated; existing HTTPS query retained |
| Customer Android Metro export | PASS, 1,949 modules, 4.7MB Hermes bundle |
| Customer iOS Metro export | PASS, 1,864 modules, 4.5MB Hermes bundle |
| Driver Android Metro export | PASS, 1,930 modules, 4.6MB Hermes bundle |
| Driver iOS Metro export | PASS, 1,845 modules, 4.4MB Hermes bundle |
| `node --test driver-app/tests/tripSummary.test.mjs` | PASS, 4 tests |
| New settings handler/model tests | PASS, 9 tests; actual handlers mounted on FastAPI with an in-memory collection, not live MongoDB |
| Relevant settings/mobile/receipt/trip-integrity/settlement suites | PASS, 59 tests including the 9 settings tests |
| Broader existing contract suites, before and after correction | Same 74 PASS / 6 FAIL on original head and updated code |
| Native signed build, startup, installed navigation app, push, end-to-end ride and payment | NOT RUN |
| Screenshot comparison against current Figma Make | NOT VERIFIED |

The six existing failures are `test_operational_trip_surfaces_use_real_trip_filter`, `test_public_seed_places_never_impersonate_user_home_or_work`, `test_admin_settings_can_never_reenable_demo_trips`, `test_all_mutating_e2e_scripts_refuse_shared_beta_and_require_isolation`, `test_mutating_e2e_scripts_do_not_store_legacy_passwords`, and `test_receipt_email_delivery_is_atomically_serialized_per_recipient`. Some tests have broken source variables (`ROOT` / `SERVER`); others assert source substrings. They fail identically on the original head and were not rewritten to obtain a green result. Broader regression is not fully green.

The reported CI run `36775021412` remains `startup_failure` with zero jobs on the original head. No exact cause is available and no workflow/billing changes were made. Check the new head separately after publishing. Export success is not device-startup or end-to-end proof.
