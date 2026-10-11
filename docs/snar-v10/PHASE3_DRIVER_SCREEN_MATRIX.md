# Phase 3B — Driver screen migration matrix

## Visual source and implementation rules

The visual reference is the newest approved `SNAR_V10_VSCode_Package.zip`, specifically `reference/snar-v10-design/src/DriverApp.tsx`, `src/index.css`, and `docs/snar-v10/SNAR_Master_Integration_Matrix.xlsx`. The Phase 2C commit `a62b7ce283719771bc8aa37922fafba0abbef1f8` is the only functional authority. Prototype offer prices, trip data, staged navigation, simulated intelligence, and sample identities are not product data.

The Driver source uses Geist for its SNAR V10 mobile design system, warm-neutral surfaces, primary red `#E00000`, online green `#0D7A58`, ink `#0B1A2C`, 4/8-based spacing, 8/12/18/24/30 radii, and 150/210/280ms micro/component/sheet motion. Driver app tokens and typography now use those fonts and palette while retaining real green shift status. GPS, dispatch, offer acceptance, identity, Fleet/vehicle guards, and server-paid earnings truth are preserved; the new month-to-date presentation filters only server-confirmed paid trip history.

`MATCHED` requires screen-to-source evidence and faithful native comparison. The archive source was inspected directly, but there is no native screenshot or device comparison; therefore **no screen is currently MATCHED**. `PARTIAL` means the production flow exists and/or relevant shared tokens were migrated but visual comparison or state coverage remains. `BLOCKED` means a requested presentation depends on an API or provider capability not present in the certified contract. Physical/device/provider states are NOT RUN.

## Approved prototype inventory

| ID | Route / production screen | Source screen and state | API and functional dependencies | Missing design state / contract | Status | Regression evidence |
|---|---|---|---|---|---|---|
| D01 | `app/index.tsx`, `app/_layout.tsx` | Splash, identity restore | AuthContext, `/auth/me`, identity gate, push/runtime startup | Native cold-start motion/font comparison | PARTIAL | Driver TypeScript and shared motion/font tests; physical cold launch NOT RUN |
| D02 | `app/driver-login.tsx` | Driver login | `/auth/login`, approved role, approval, legal and identity gates | Full source screenshot comparison; prototype SMS OTP and BankID have no certified Driver auth contract | PARTIAL for supported email/password auth; BLOCKED for OTP/BankID | Existing role/approval/identity guards preserved; unsupported auth paths are not simulated |
| D03 | `app/index.tsx`, `app/driver-identity.tsx`, `app/driver-vehicles.tsx` | Approval / documents | `/auth/me`, driver identity/document and assigned-vehicle APIs | API payload document summary is not the prototype's complete status timeline | PARTIAL | Identity/vehicle backend boundary required; camera/provider device QA NOT RUN |
| D04 | `app/(driver)/home.tsx` | Offline home | Driver summary, explicit online mutation, foreground location permission | Source cockpit map visual/state comparison; offline map uses no Driver/vehicle markers until real server/device state exists | PARTIAL | Offline map and server-summary presentation added; GPS/online backend tests required |
| D05 | `app/(driver)/home.tsx` | Going online / location authorization | `driverApi.online`, fresh device GPS, server acknowledgment | Source progress animation comparison | PARTIAL | GPS and online safety guards preserved; permission/device QA NOT RUN |
| D06 | `app/(driver)/home.tsx` | Online cockpit | Server online truth, live GPS, pending offers, driver summary | Approved Driver map overlays and cockpit screenshot comparison | PARTIAL | Pending de-duplication/GPS behavior is production code; dispatch tests required |
| D07 | `app/(driver)/home.tsx` | New ride offer / countdown / accept / reject / expiry | `driverApi.pending/accept/decline`, `offer_driver_id`, `offer_seq`, `offer_expires_at`, reservation lock | Exact countdown ring/source motion comparison | PARTIAL | Backend accept race/offer generation/expiry tests required; accept remains server-confirmed |
| D08 | `app/(driver)/home.tsx` | Accepted → navigation to pickup | Canonical `driverApi.current`, pickup coordinates and external navigation preference | Turn-by-turn route instructions are delegated to installed navigation app | PARTIAL | Response-loss accept reconciliation and trip-state tests required |
| D09 | `app/(driver)/home.tsx` | Customer waiting inside | Server-provided trip notes/special needs, pickup state | No dedicated wait-inside protocol/contract beyond available trip notes | PARTIAL for supported pickup state; specific staged cue BLOCKED | Existing trip/API truth preserved; lifecycle tests required |
| D10 | `app/(driver)/home.tsx` | Arrived at pickup | Server `at_pickup` transition, current GPS | Native transition/motion comparison | PARTIAL | Backend transition and GPS guard tests required |
| D11 | `app/(driver)/home.tsx` | Wait for passenger | Server waiting policy and pickup time | Live timer/visual ring is not a client authority for no-show or fees | PARTIAL | Server validates wait/no-show; waiting fare tests required |
| D12 | `app/(driver)/home.tsx` | Start trip | Server start mutation, identity/GPS/trip guards | Hold-duration source animation comparison | PARTIAL | Slide-confirm, duplicate guard and lifecycle tests required |
| D13 | `app/(driver)/home.tsx` | Active trip / destination | Canonical current trip, server geometry, Driver GPS | Prototype map camera zoom/source route animation comparison | PARTIAL | Recovery/state/active trip tests required |
| D14 | `app/(driver)/home.tsx` | Approaching destination | Server trip state/coordinates and navigation handoff | No invented arrival-distance financial or state transition | PARTIAL | Backend arrival checks and GPS freshness tests required |
| D15 | `app/(driver)/home.tsx` | Complete trip | Server arrive/complete transition, one deliberate confirmation | Exact source hold-to-complete animation comparison | PARTIAL | Completion, payment and dispatch lifecycle tests required |
| D16 | `app/(driver)/home.tsx` | Finished-trip summary | Canonical payment status and `driver_earnings`, summary/dismissal storage | Prototype count-up animation comparison | PARTIAL | Paid/unpaid truth and finished summary component checks required |
| D17 | `app/(driver)/earnings.tsx` | Earnings | Server summary, weekly earnings, payout and history APIs | Visual chart and payment-period screenshot comparison | PARTIAL | Error state now has retry; server-paid earnings remain authoritative |
| D18 | No certified Driver Intelligence route | SNAR Drive Intelligence | No certified recommendation/dispatch-intelligence API | Driver advice/estimates are absent from the certified app contract | BLOCKED | Do not fabricate estimated income or booking recommendations |
| D19 | `app/(driver)/earnings.tsx` | Earnings detail / period selection | Server summary, weekly API and paid trip history | Source tab underline/transition comparison; month-to-date is derived from server-provided paid history | PARTIAL | Today/week/month selector is functional; calendar-month history boundary has a unit test and paid-only filter remains enforced |
| D20 | `app/driver-trips.tsx` | Driver activity/history | `driverApi.history`, status and paid earnings truth | Native detail sheet screenshot comparison | PARTIAL | History truth preserved; earnings/history tests required |
| D21 | `app/driver-trips.tsx` | Trip detail | Server trip/history snapshot | No new receipt/PDF contract inferred | PARTIAL | Backend completed-trip/history truth tests required |
| D22 | `app/driver-vehicles.tsx`, `app/(driver)/profile.tsx` | Vehicle selection | Server assigned/active vehicles, selection authorization and Fleet ownership | Source vehicle card screenshot comparison | PARTIAL | Vehicle/Fleet access tests required |
| D23 | `app/(driver)/profile.tsx` | Fleet identity | Server Driver/Fleet association and org identity | Fleet contract/provider finance details beyond current API | PARTIAL | Fleet ownership/identity tests required |
| D24 | `app/(driver)/profile.tsx`, `app/driver-profile-photo.tsx` | Profile | Authenticated Driver profile and private image API | Avatar/header source comparison | PARTIAL | Private-file and profile tests required |
| D25 | `app/(driver)/profile.tsx` | Profile details and app settings | Auth, settings, logout/session revocation | Driver dock has only Hjem/Inntjening/Profil; no approved accessible inbox route | PARTIAL | Settings/auth tests required |
| D26 | `app/driver-identity.tsx`, `app/driver-profile-photo.tsx` | Documents | Protected document references, private file fetch | Source-specific document status card comparison | PARTIAL | Identity projection/private-file tests required; physical document QA NOT RUN |
| D27 | `app/driver-identity.tsx` | ID/selfie verification | Identity verification and selfie upload/review APIs | Liveness/camera result is provider/device-only | PARTIAL for server states; physical capture BLOCKED pending QA | Identity/security tests required; no selfie/device test run |
| D28 | `src/components/ChatSheet.tsx`, `app/(driver)/home.tsx` | Messages during assigned trip | `GET/POST /trips/{trip_id}/messages`, assigned-trip membership | Generic/inbox history API absent; do not broaden trip-scoped messaging | PARTIAL in-trip; BLOCKED for standalone inbox | Chat remains tied to canonical trip; API authorization tests required |
| D29 | `app/driver-settings.tsx`, `app/(driver)/home.tsx` | Navigation preference | Server settings and native external-app handoff | External map-app behavior depends on installed apps/OS | PARTIAL | Navigation selection tests required; device handoff NOT RUN |
| D30 | `app/driver-settings.tsx` | Settings | Server notification/navigation settings and OS permission state | Complete source settings comparison | PARTIAL | Settings/push contract tests required; physical notification QA NOT RUN |
| D31 | Shared Driver screens | Global loading/error/offline/permission states | Native runtime, push, GPS, driver APIs | Device notification delivery/background GPS/offline recovery cannot be certified locally | PARTIAL; provider/device delivery BLOCKED pending QA | TypeScript and unit/design tests; physical/provider QA NOT RUN |

## Additional discovered Driver routes and preserved functional states

| Route / file | Required states and contract | Design status |
|---|---|---|
| `app/forgot-password.tsx`, `app/reset-password/[token].tsx` | Request, invalid/expired/used token, successful one-use reset and session revocation | PARTIAL; screens are not separately designed in the prototype |
| `app/driver-legal-consent.tsx` | Required legal version, accept/failure/offline, authenticated route gate | PARTIAL; keep mandatory contract |
| `app/driver-settings.tsx` | Push permission, persisted notification and navigation preferences, rollback/error | PARTIAL; no native permission result is assumed |
| `app/driver-trips.tsx` | Loading/error/empty, today/week/all, completed/cancelled, pending/unpaid earnings and trip detail | PARTIAL; all amounts remain server-derived |
| `app/driver-vehicles.tsx` | Assigned vehicle, active/selected/parked, access denied and request failure | PARTIAL; server selection is authoritative |
| `app/driver-profile-photo.tsx` | Protected upload, preview, retry, cancellation/error | PARTIAL; native camera/gallery acceptance NOT RUN |
| `app/driver-identity.tsx` | Not submitted, pending review, verified, retry/recheck, deferred check, denied permission, upload error | PARTIAL; physical selfie/liveness verification NOT RUN |
| `src/components/ChatSheet.tsx` | Assigned-trip open/send/received/closed/error/offline states | PARTIAL; generic inbox is BLOCKED by contract |
| `app/(driver)/home.tsx` | Network loss/reconnect, stale GPS force-offline, queued critical state reconciliation, unseen offer, expiry/stale response, accept response loss, minimized/reopened trip, paid/unpaid completion | PARTIAL; preserve state machine and test backend outcomes |

## Regression guardrails

- Preserve `offer_driver_id`, `offer_seq`, `offer_expires_at`, reservation locks, trip assignment CAS and active-trip locks. An expired/stale offer is never accepted locally.
- Only present an accepted offer after the backend response or `/driver/current` reconciliation confirms assignment. Do not alter Driver accept/decline or dispatch routes for presentation.
- Keep GPS freshness, push deduplication, native background safeguards, Fleet ownership, assigned-vehicle access and identity verification gates intact.
- Earnings and trip detail use backend paid/completed values. A local fare calculation is never substituted for `driver_earnings`.
- Chat remains assigned-trip scoped. The prototype's standalone Messages destination is BLOCKED without an inbox/history contract; current-trip chat remains available through the real active-trip controls.
- No backend changes, physical QA, native builds, deployment, provider transaction, or production operation are part of this visual migration.

## Phase 3B Driver regression gate

| Gate | Result | Scope / limitation |
|---|---|---|
| Driver TypeScript (`npx tsc --noEmit`) | PASS | Current Driver source |
| Shared design and unit suite (`frontend`: `npm run test:design`) | PASS | Driver fonts/weight inheritance, gradient geometry, reduced motion/toggle behavior, server-confirmed push preference, serialized trip confirmation, and month-to-date history boundary |
| Driver API wrapper audit (`python -X utf8 scripts/driver-contract-audit.py`) | PASS — 241 backend routes, 61/61 wrappers mapped, 0 unmapped | Static source mapping, not proof of authenticated runtime behavior |
| Backend dispatch/identity/reservation/payment/earnings boundary | Final Phase 3 gate PASS: 277 passed, 7 subtests passed, 0 failed across 26 files | Covers accept concurrency/offer generation, reservation locks, identity projection, Driver state, paid earnings, and completed trips; no Backend source was changed |
| Device/provider QA | NOT RUN | GPS, push delivery/background, camera/liveness, navigation handoff, and physical rides require later QA |

No screen is upgraded to MATCHED by these code-level checks; all Driver prototype screens remain PARTIAL or explicitly BLOCKED pending source-to-native comparison or missing contracts.
