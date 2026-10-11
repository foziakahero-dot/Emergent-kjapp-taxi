# Phase 3A — Customer screen migration matrix

## Visual source selection

Selected the newest approved SNAR mobile design source available in the workspace: `C:\Users\Elite transport\Downloads\SNAR_V10_VSCode_Package.zip` (last modified 2026-10-09 22:51 local time). Its active reference contains `CustomerApp.tsx`, `DriverApp.tsx`, `snar10/kit.tsx`, `index.css`, the integration workbook and Phase 1 audit. The nested `snar10-kildekode.zip` contains the same active Customer/Driver source files. The package explicitly identifies these as the design reference; prototype Stage/sidebar controls and simulated data are not production behavior.

The package timestamp and active-screen inventory are newer than the other SNAR mobile design archives found in Downloads. No later approved Customer/Driver Figma export was found. Older Figma screenshots and unrelated SNAR Fleet/web design archives were not selected. Source/package files were inspected read-only and are not imported into the app.

Reference design screen inventory is C01–C36 in `reference/snar-v10-design/src/CustomerApp.tsx` and `SNAR_Master_Integration_Matrix.xlsx`. The workbook's Phase 1 provenance used different application/backend commits; its visual and state requirements are used as design evidence only. **Phase 2C commit `a62b7ce283719771bc8aa37922fafba0abbef1f8` remains the functional authority.**

## Functional constraints on visual mapping

The reference sign-in prototype uses SMS one-time-code authentication. The certified Customer app currently exposes email/password plus configured Apple and Google sign-in; Phase 2C does not provide a Customer SMS-OTP API contract. Do not simulate OTP or claim the reference sign-in flow is fully migrated. Retain supported auth behavior and adapt presentation unless a separately approved, backward-compatible API addition is made.

## Approved Customer design tokens

Source: `reference/snar-v10-design/src/index.css` `.s10` tokens and the Phase 1 audit.

| Token | Approved value |
|---|---|
| Font | Geist; Inter/system fallback; tabular numeric values |
| Light surfaces | background `#F7F5F1`, surface `#FFFFFF`, subtle `#F1EEE8` |
| Text | primary `#0B1A2C`, secondary `#4B5A6C`, tertiary `#8A95A3` |
| Primary | `#E00000`; pressed `#A80000`; soft `rgba(224,0,0,.08)` |
| Status | positive `#0D7A58`, warning `#A35A00`, critical `#D0001A` |
| Type scale | display 40/44, large 32/38, title 26/32, heading 20/26, body 16/23, secondary 14/20, caption 12/16, overline 11/14 |
| Geometry | 4/8-based spacing; radii 8/12/18/24/30; CTA 56 high, input 56, row minimum 56 |
| Motion | micro 150 ms, component 210 ms, sheet 280 ms; honor reduced-motion preference |
| Navigation | Hjem, Aktivitet, SNAR AI, Meldinger, Profil; active-trip navigation uses Sjåfør, Melding, Sikkerhet, Tur |

## Screen matrix

`PENDING` means the current implementation has not yet been migrated and checked against the selected source. `PARTIAL` is an audit classification, not a pixel-match claim. No screen is marked MATCHED without implementation and source comparison. TypeScript and automated component checks cannot certify visual parity.

| ID | Current route / production file | Current implementation | Source screen / state | API and functional dependencies | Missing design state or backend contract | Status and visual migration | Regression / test evidence |
|---|---|---|---|---|---|---|---|
| C01 | `app/index.tsx`, `app/_layout.tsx` | Existing session/role gate plus approved first-run marketing hierarchy; real session restore retained | Splash / session restore | `AuthContext`, `GET /auth/me`, `GET /trips/active` | restoring, offline, expired session, wrong role, legal consent, active trip | PARTIAL — onboarding source structure applied; runtime cold-start visual comparison pending | Onboarding route check and Customer TS/design checks pass; auth/recovery backend boundary pending |
| C02 | `app/(app)/home.tsx` | Server-backed home with new location header, bottom destination entry, live quick-place chips, voice/recenter actions | Returning user home | auth identity, places, active trip, real location | loading, empty, offline, stale GPS, active-trip restore, Island | PARTIAL — home shell migrated; native visual and state comparison pending | Customer TypeScript/design checks pass; home recovery/API tests pending |
| C03 | `app/index.tsx`, `app/register.tsx` | Single-screen onboarding hierarchy plus real email registration and explicit existing-account route; registration inputs use shared source-sized field primitive | One-screen introduction | auth/register/legal flow; no design mock assertions become product facts | initial, legal, existing account, validation, submitting, API error | PARTIAL — approved intro hierarchy applied, registration functionality retained; code-source comparison only | Onboarding action assertions, Customer TS/design checks pass; auth regression gate pending |
| C04 | `app/login.tsx` | Email/password and configured Apple/Google auth, repositioned in source hierarchy | Sign in | `authApi`, native Google/Apple contract; reference SMS OTP has no Phase 2C Customer API | input, submit, invalid credentials, provider cancel/error/config, legal | BLOCKED for SMS OTP; PARTIAL for supported email/Apple/Google auth and visual shell | Existing authentication source and controls retained; no OTP simulated; customer auth tests/device provider checks pending |
| C05 | `app/permissions.tsx`, home location state | Real Expo permission requests, retry/open-settings path and manual pickup selection | Location permission | Expo Location; reverse geocode only after real coordinates | requesting, denied, approximate, manual pickup, offline | PARTIAL — source hierarchy/state visuals and system-dialog behavior need device comparison | Home location retry behavior covered by design checks; device grant/deny NOT RUN |
| C06 | `app/(app)/home.tsx` | Mapbox home with backend availability; controls restyled without changing the real availability source | Home / live map | Mapbox, real `useAvailableCars`, places, GPS; never static cars | loading, empty, stale, reconnecting, denied permission, active trip | PARTIAL — map-backed shell retained; native visual audit pending | Customer design search/offline checks pass; availability tests pending |
| C07 | `app/(app)/home.tsx` | Bottom destination entry opens existing inline search sheet | Destination search | `placesApi`, saved/recent place APIs | typing, loading, empty, offline, query race, manual pickup | PARTIAL — entry migrated; search-sheet visual comparison pending | Customer design search race/offline checks pass |
| C08 | `app/(app)/home.tsx` | Backend route geometry/fare preview rendered in booking sheet | Route preview | backend route/fare estimate; pickup, dropoff, stops | loading, route failure, quote changed, manual pickup | PARTIAL — native route/map and preview visuals need source comparison | Server estimate path retained; quote/booking backend boundary required |
| C09 | `app/(app)/home.tsx`, `src/components/VehicleAsset.tsx` | Three server-priced selectable categories with bundled approved vehicle images; no fake options | Vehicle selection | approved `VEHICLES`, live availability and backend estimate | selected, unavailable, loading, quote changed | PARTIAL — current supported categories retained; prototype-only categories/assets not invented | Existing category/vehicle access coverage to rerun; current API category set is authoritative |
| C10 | `app/payment-methods.tsx`, home | Saved-card list/setup through existing payment API/native Stripe; wallet remains separate supported route | Payment method | `paymentApi`, native Stripe setup; wallet only if fully supported | loading, empty, selected/default, setup, unsupported, failed | PARTIAL — payment states and native appearance not screenshot compared | Payment boundary required; provider/device verification NOT RUN |
| C11 | `app/(app)/home.tsx` | Server trip request after quote/payment preconditions; response-loss reconciliation fetches active trip | Confirm booking | payment preconditions, quote version, `tripsApi.request` | submitting, authorizing, SCA, quote change, response unknown, existing trip | PARTIAL — confirmation layout still needs direct source comparison | Preserve idempotent authorization/uncertain-booking backend tests |
| C12 | `app/booking/[tripId].tsx` | Server-polled matching with real nearby cars, cancellation preview and no-driver retry route | Searching for Driver | canonical trip status, real availability, cancel preview | rounds 1–3, no match, retry, cancellation, offline/reconnect | PARTIAL — motion/state hierarchy present; native source comparison pending | Design checks cover cancellation/reconciliation; Phase 2C search/cancel boundary required |
| C13 | `app/booking/[tripId].tsx` | Canonical server Driver identity, vehicle/plate, protected photo and call/message actions | Driver found | canonical assigned Driver and vehicle | matched, stale, offline, Driver cancels | PARTIAL — server-backed card exists; match transition/layout comparison pending | Mobile server-truth/identity contracts required |
| C14 | `app/booking/[tripId].tsx` | Map and ETA use assigned trip and fresh GPS; stale GPS suppresses ETA | Driver approaching | assigned trip polling, fresh GPS, Mapbox | moving, stale, reconnecting, offline, Driver cancel | PARTIAL — existing safe ETA/identity UI not compared on device | GPS freshness + mobile server-truth checks required |
| C15 | `app/booking/[tripId].tsx` | Supported pickup pin/route only; no fake entrance or pedestrian path | Pickup guidance | trip pickup, route geometry; no invented entrance/walking route | entrance only if supplied, manual pin, stale, offline | BLOCKED for source's specific entrance/pedestrian guidance because no such API/asset contract exists; supported map guidance remains | No entrance API is assumed; preserve server coordinates |
| C16 | `app/booking/[tripId].tsx` | Server `at_pickup`, waiting policy, identity and vehicle confirmation | Driver arrived | authoritative trip status, Driver identity/vehicle | arrived, waiting policy, stale GPS, Driver cancel | PARTIAL — state and truth retained, wait-inside source comparison/device test pending | Lifecycle contract required |
| C17 | `app/booking/[tripId].tsx`, `GlobalCustomerShell.tsx` | Active trip, minimize/reopen; server-backed Journey Island added | Active trip / Journey Island | `GET /trips/active`, canonical trip polling, safe-area shell | active, minimized, reopened, restart, stale, offline, completed | PARTIAL — Island and five-tab shell implemented; visual/state audit pending | Customer design checks pass; Phase 2C active-trip restore regression required |
| C18 | `app/booking/[tripId].tsx` | Safety sheet with immediate native dialer, server share link and safety report | Safety | `safetyApi`, native dialer/share; no fictitious emergency dispatch | confirm, submitting, failed, offline; dial must remain immediate | PARTIAL — source layout/state needs native comparison; source's two-step dial confirmation intentionally differs to maintain immediate real dial | Safety/error regression required |
| C19 | `app/booking/[tripId].tsx` | Active-trip banner now uses server destination and GPS-qualified ETA; Driver identity remains server-backed | Approaching destination | canonical trip GPS/status only; ETA requires fresh Driver GPS | near destination, stale, offline, early end | PARTIAL — destination presentation migrated; progress/map comparison pending | Customer design regression asserts server destination and no pickup-state banner during active trip |
| C20 | `app/receipt/[tripId].tsx` | Server completion/payment resolution, actionable when settlement needs user action | Trip complete | authoritative completion and payment capture state | processing, failed, unknown response, retry same payment truth | PARTIAL — completion/source transition visual comparison pending | Phase 2C payment/settlement boundary required |
| C21 | `app/receipt/[tripId].tsx`, payment bridge routes | Polls server payment status; return callbacks do not assert payment success | Payment complete | server `payment_status`; provider/webhook truth | paid, email pending, fleet transfer pending, not paid | PARTIAL — each settlement state is server-derived; visual/provider checks pending | Payment truth assertions required; no real provider transaction |
| C22 | `app/receipt/[tripId].tsx` | Uses server trip/payment snapshot for distance, time, vehicle, receipt ID and price | Receipt | immutable server snapshot; no UI financial recalculation | loading, empty, failed, offline, share only if supported | PARTIAL — receipt card layout needs source comparison | Phase 2C receipt identity/recheck tests required |
| C23 | `app/receipt/[tripId].tsx` | Paid-only rating submit, duplicate-safe local state and refresh fallback | Rating | server trip ownership and rating API | unrated, draft, submit, error, skip | PARTIAL — star state exists; source transition/accessibility comparison pending | Rating server-truth tests required |
| C24 | `app/(app)/history.tsx` | Server-backed activity/history; heading moved to approved large title scale | Activity | `tripsApi.list`, receipt/history data | loading, empty, offline, scheduled only if supported, Island | PARTIAL — list/state contracts retained; row/screen visual audit pending | Customer TypeScript/design checks pass; history API/state regression pending |
| C25 | `app/(app)/history.tsx`, `app/receipt/[tripId].tsx` | History entries route to owner-scoped canonical booking/receipt screen | Trip detail | owner-scoped trip and receipt state | loading, unauthorized, missing, offline | PARTIAL — dedicated visual trip-detail screen not in API-backed route set; receipt route is reused | Receipt/ownership contracts required |
| C26 | `app/(app)/messages.tsx`, `app/booking/[tripId].tsx` + `src/components/ChatSheet.tsx` | New Messages tab opens only server-confirmed assigned-trip chat | Messages | assigned-trip chat API only; no generic inbox contract found | loading, empty, draft, sending, failed, received, closed, offline | PARTIAL — truthful active-trip entry and existing chat sheet; no historical inbox API | Customer TypeScript/design checks pass; chat authorization/error checks pending |
| C27 | `app/_layout.tsx` | Push routing, no persistent inbox | Notifications | Expo push registration and strict deep-link normalization | permission denied, push received, deep link, stale trip, offline | PARTIAL for routed notifications; BLOCKED for notification inbox/history because no such API | Push routing/device delivery NOT RUN |
| C28 | `app/(app)/assist.tsx` | Server-backed AI assistant; booking requires explicit confirmation through home flow | SNAR AI | existing `aiApi`; structured suggestions must not book without confirmation | initial, submit, result, failure, Island | PARTIAL — visual state and native source comparison pending | Existing API flow only; contract checks required |
| C29 | `app/(app)/assist.tsx` | Voice capture/transcription where native permission and provider are configured; no auto-book | Voice booking | native audio/mic and existing AI contracts; no auto-book | denied, listening, understanding, result, confirm, cancel, failure | PARTIAL — provider and permission states not physically verifiable | Native voice/device behavior NOT RUN |
| C30 | `app/(app)/profile.tsx`, `src/components/CustomerPhoto.tsx` | Server identity/photo header, grouped real account routes, and explicit Settings route | Profile | authenticated profile and private-photo API | loading, empty, save, error, offline, Island | PARTIAL — approved header/section structure applied; native visual comparison pending | Customer profile/settings route check and TypeScript/design checks pass; profile contract tests pending |
| C31 | `app/payment-methods.tsx`, `app/(app)/wallet.tsx` | Existing server-backed methods and native setup; wallet is not an authorization substitute | Payment methods | verified saved-card API and supported native setup | loading, empty, add, default, delete, unsupported, failure | PARTIAL — supported states kept; provider/device presentation not verified | Payment/API tests required; provider/device NOT RUN |
| C32 | `src/components/CustomerSupport.tsx` | AI support and ticket intake; real server responses/ticket IDs | Support | existing AI/public-support APIs; no human two-way conversation | active/last trip context, FAQ, draft, sending, failed, ticket closed | PARTIAL for supported support intake; BLOCKED for operator chat | Existing support contract component checks pass; human-chat API absent |
| C33 | `app/settings.tsx`, `app/(app)/profile.tsx` | Existing accessibility entry retained; system text/reduced-motion behavior where available | Accessibility | persisted settings only where API supports; native/system preferences | larger text, contrast, reduced motion, voice, saving/error | PARTIAL — no unsupported persistence is invented; physical accessibility check pending | Reduced-motion/toggle and Customer TS/design checks pass |
| C34 | `app/settings.tsx`, `app/(app)/profile.tsx` | Settings route linked from Profile; server-backed notification, privacy, version and logout actions | Settings | supported settings API, logout/session revocation | saving, error, push denied, logout, expired session, Island | PARTIAL — source row hierarchy and route reachability applied; native comparison pending | Customer settings/design checks and auth/session regression required |
| C35 | No scheduled-booking route | No canonical scheduled-trip contract identified | Scheduled ride | **No scheduled booking API**; must not fall through to immediate booking | editing time, quote change, failed, cancel, offline | BLOCKED — backend contract absent | No scheduled booking test/API |
| C36 | Shared across Customer screens | Loading/error/empty/offline states remain attached to real API screens | Empty/error/offline gallery | Existing per-screen APIs only | empty, offline, denied, not found, service-area, loading, domain errors | PARTIAL — covered states retained; complete visual gallery is not provided in the product source | Customer search/offline and active-trip failure checks pass; cluster tests pending |

## Audit reconciliation — all 43 discovered Customer screens

The source audit discovers 43 UI surfaces/substates. The rows below reconcile every discovered item with its detailed contract row above; repeated routes remain separate user journeys and are not counted as separate screens in the C01–C36 Figma prototype inventory.

| # | Discovered screen / state | Current route/file | Design source mapping | Status | API/functional/test evidence |
|---:|---|---|---|---|---|
| 1 | Splash/session restore | `/`, `app/index.tsx` | C01 | PARTIAL | Auth/session gate; TS/design checks; cold-start device compare pending |
| 2 | Permissions | `/permissions`, `app/permissions.tsx` | C05 | PARTIAL | Expo OS permissions; home location retry checks; physical grant/deny NOT RUN |
| 3 | Email/password login | `/login`, `app/login.tsx` | C04 | PARTIAL | Existing AuthContext API; auth regression required |
| 4 | Google login | `/login`, `socialSignIn.native.ts` | C04 | PARTIAL | Configured provider API; signing/device acceptance NOT RUN |
| 5 | Apple login | `/login`, `AppleSignInButton.ios.tsx` | C04 | PARTIAL | Configured provider API; iOS capability/device acceptance NOT RUN |
| 6 | Registration | `/register`, `app/register.tsx` | C03 | PARTIAL | Existing registration API/legal; auth regression required |
| 7 | Forgot password | `/forgot-password` | supplemental auth row | PARTIAL | One-use reset API; backend security tests required |
| 8 | Reset password | `/reset-password/[token]` | supplemental auth row | PARTIAL | Token check/reset and session revocation; backend security tests required |
| 9 | Legal consent | `/legal-consent` | supplemental auth row | PARTIAL | Server legal version/acceptance gate; auth tests required |
| 10 | Home/map | `/(app)/home`, `home.tsx` | C02/C06 | PARTIAL | Mapbox + actual available-cars API; backend/mobile boundary required |
| 11 | Destination search | `/(app)/home`, SearchSheet | C07 | PARTIAL | `placesApi.search`; stale response/offline/empty/retry tests PASS |
| 12 | Recent/favorite locations | `/(app)/home` | C02/C24 | PARTIAL | Saved places and validated completed-trip recents; API/state tests required |
| 13 | Saved locations CRUD | `/saved-places` | supplemental places row | PARTIAL | Owner-scoped saved-place CRUD; edit identity regression required |
| 14 | Ride categories | `/(app)/home` | C09 | PARTIAL | Server categories/prices + bundled vehicle artwork; vehicle/vehicle-access tests required |
| 15 | Price estimate | `/(app)/home` | C08 | PARTIAL | Server route/fare quote; estimate/quote-change tests required |
| 16 | Booking review | `/(app)/home` | C11 | PARTIAL | Quote, payment method, wait-policy consent; booking boundary required |
| 17 | Booking submit | `/(app)/home` → `/booking/[tripId]` | C11/C12 | PARTIAL | Authorized server request/uncertain response recovery; reservation tests required |
| 18 | Driver matching | `/booking/[tripId]` | C12 | PARTIAL | Canonical search state/cancel/retry; dispatch boundary required |
| 19 | Driver approaching | `/booking/[tripId]` | C13/C14 | PARTIAL | Server identity and fresh GPS/ETA; mobile truth/GPS tests required |
| 20 | Driver arrived / pickup | `/booking/[tripId]` | C15/C16 | PARTIAL | `at_pickup`, waiting policy, identity; lifecycle test required |
| 21 | Active trip | `/booking/[tripId]` | C17/C19 | PARTIAL | Canonical trip state, destination, fresh position; active-trip tests required |
| 22 | Customer–Driver chat | `ChatSheet` | C26 | PARTIAL | Trip-scoped messages API; authorization/error tests required |
| 23 | Safety/SOS/share | `/booking/[tripId]` | C18 | PARTIAL | Safety API + immediate native dial; safety regression required |
| 24 | Minimize active trip | `/booking/[tripId]` | C17 | PARTIAL | ActiveTripCard, automated minimize/reopen/completion checks PASS |
| 25 | Reopen active trip | `/(app)/home` → `/booking/[tripId]` | C17 | PARTIAL | `tripsApi.active()` canonical restore; Phase 2C recovery tests required |
| 26 | Payment methods | `/payment-methods` | C10/C31 | PARTIAL | Saved-method and Stripe setup APIs; provider/device NOT RUN |
| 27 | Google Pay | `/receipt/[tripId]`, native payment bridge | C21 | PARTIAL | Native provider capability; physical Android/provider QA NOT RUN |
| 28 | Apple Pay | `/receipt/[tripId]`, native payment bridge | C21 | PARTIAL | Native provider capability; physical iOS/provider QA NOT RUN |
| 29 | Stripe card payment | `/receipt/[tripId]` | C20/C21 | PARTIAL | Server checkout/payment status; no real provider transaction |
| 30 | Receipt | `/receipt/[tripId]` | C20–C22 | PARTIAL | Immutable server snapshot/receipt identity; receipt tests required |
| 31 | Rating | `/receipt/[tripId]` | C23 | PARTIAL | Paid-only server rating; rating truth tests required |
| 32 | Activity/history | `/(app)/history` | C24/C25 | PARTIAL | `tripsApi.list`; history/receipt route tests required |
| 33 | Profile | `/(app)/profile` | C30 | PARTIAL | Authenticated profile; TS/design checks pass, source/device compare pending |
| 34 | Profile picture | `CustomerPhoto` | C30 | PARTIAL | Private photo API; identity/privacy backend tests required |
| 35 | Privacy/GDPR | Profile / Settings | C30/C34 | PARTIAL | Server export/delete and session logout; GDPR tests required |
| 36 | Settings | `/settings` | C33/C34 | PARTIAL | Server notification settings, version/legal URLs; settings regression required |
| 37 | Support | `CustomerSupport` | C32 | PARTIAL for supported intake; BLOCKED for human/operator chat | Existing AI/ticket APIs; ticket/server reply component tests PASS |
| 38 | Notifications/push | Authenticated routes/native runtime | C27 | PARTIAL for deep-link handling; BLOCKED for inbox/history | Push API/runtime; delivery/background device QA NOT RUN |
| 39 | Offline/network errors | AuthContext and screen-local states | C36 | PARTIAL | Search/cancel/recovery/error checks PASS; physical outage scenarios NOT RUN |
| 40 | Profile setup | `/profile-setup` | supplemental auth/onboarding row | PARTIAL | Auth/profile API; first-run runtime test required |
| 41 | Wallet | `/(app)/wallet` | C31 | PARTIAL | Existing server wallet data only; never substitutes for payment authorization |
| 42 | SNAR AI/assist | `/(app)/assist` | C28/C29 | PARTIAL | Existing AI API; no autonomous booking; provider/device acceptance NOT RUN |
| 43 | Payment callbacks | `/payment/success`, `/payment/cancel` | supplemental payment callback row | PARTIAL | Canonical status recheck; uncertain response/payment tests required |

## Existing Customer routes and supporting screens outside C01–C36

These remain in scope even when the design prototype has no standalone screen for them:

| Route/file | Current function | Required state coverage | Missing design state / contract | Status | Regression/test evidence |
|---|---|---|---|---|
| `app/register.tsx` | Account registration/profile setup | field validation, submit, duplicate/account/API errors, legal | Separate registration visual not present; no unsupported OTP/enrollment contract | PARTIAL — shared Geist field and CTA tokens aligned | Customer TS/design checks pass; auth/API backend boundary required |
| `app/forgot-password.tsx`, `app/reset-password/[token].tsx` | Password reset | request sent/error, expired/used token, successful reset/session revocation | Reset screens not separately supplied; preserve one-use server token and revocation | PARTIAL — shared source geometry applied to request; native source comparison pending | Security reset tests required; no token values exposed |
| `app/legal-consent.tsx` | Required legal consent | current version, submit, failure/offline, re-auth | Consent flow is not fully represented in prototype | PARTIAL — preserve legal gate; native flow comparison pending | Legal/auth contract checks required |
| `app/saved-places.tsx` | Saved home/work/places | load, empty, add/edit/delete, validation, offline | Prototype only exposes sample Home/Work rows, not CRUD states | PARTIAL — supported CRUD preserved; source list state comparison pending | Existing saved-place identity/edit checks and Places API checks required |
| `app/payment/success.tsx`, `app/payment/cancel.tsx` | Native/payment return bridges | verify canonical reservation/trip; cancel is not assumed unpaid/failed | Prototype omits uncertain callback/return states | PARTIAL — canonical server verification retained | Payment response-loss backend tests required |
| `app/(app)/wallet.tsx` | Existing wallet/balance view | server balance, empty/loading/error; not a payment authorization substitute | No balance API may be treated as a booking-payment contract | PARTIAL — design surface retained, payment authorization stays server-driven | Payment truth tests required |

## Phase 3A acceptance gates

- Customer APIs remain on their existing routes; no backend/business behavior is changed by visual work.
- Home/map continues to use Mapbox, actual backend availability, fresh GPS, existing polling/retry and server quotes; no prototype/static cars or coordinates.
- Booking preserves quote confirmation → payment authorization/SCA → dispatch and server-authoritative trip status.
- Minimize/reopen/restart behavior remains keyed to the canonical trip, with terminal/completed state removed from active presentation.
- Receipt and payment/earnings values come from server snapshots and statuses, never UI-side calculations.
- Unsupported prototype states (generic message inbox, notifications inbox, scheduled ride, manual payment after completion, fake pickup entrances) remain visibly unsupported or use the existing supported route; they are not simulated as successful.
- The recorded gate results below are the completed code-level checks; they do not certify native/provider presentation or uncovered per-screen behavior.
- Visual status is not MATCHED until compared screen-by-screen to this source; physical viewport/screenshot QA is separate and remains NOT RUN.

## Phase 3A Customer regression gate — 2026-10-10

| Gate | Result | Scope / limitation |
|---|---|---|
| Customer TypeScript (`npx tsc --noEmit`) | PASS | Current Customer source |
| Customer design/component suite (`npm run test:design`) | PASS | Search race/offline/retry, booking/cancellation/recovery, Journey Island minimize/reopen/completion, auth/session and shared design checks |
| Customer API audit (`npm run audit:customer`) | PASS — 241 backend routes, 161 discovered Customer contracts, 0 unmapped | Audit discovery differs from Phase 2C's 83-contract method; counts are not directly comparable. Screen audit: 43 |
| Backend compile (`python -m compileall -q backend`) | PASS | Full backend tree |
| Certified Phase 2C regression boundary | PASS — 277 passed, 7 subtests passed, 0 failed, 26 test files | Includes booking/payment authorization, reservations, active-trip and uncertain-booking truth, cancellation, completion, receipt/rating, availability, dispatch and settlement coverage. Windows-only in-memory pytest hook shortened oversized parametrized node IDs; no tests/assertions were skipped or changed. |
| `git diff --check` | PASS before this documentation update | Rerun before checkpoint commit |

These results establish the requested Customer code-level gate, not device or provider QA. The route audit is source mapping rather than proof of live authenticated API behavior. Row-level `pending`/`required` wording identifies screen-specific or device checks that the aggregate gate does not prove; backend cases already executed are enumerated by the regression boundary above.
