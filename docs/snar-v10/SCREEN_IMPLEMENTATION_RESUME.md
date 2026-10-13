# Customer + Driver screen implementation — resume here

Updated 2026-10-13 (Europe/Oslo). This is an implementation checkpoint, not release certification.

## Current task and persistence

Complete the remaining Customer and Driver screens against the original SNAR V10 / Fleet V2 design, screen by screen; preserve implementations that already match. The user explicitly requested code implementation and, on 2026-10-13, saving and pushing every new change so interruptions do not cause a restart.

Continue on `implementation/snar-v10-screens-20261013` in `foziakahero-dot/Emergent-kjapp-taxi`. The branch starts from QA commit `6955bc48a9284e780f8a4746a1a64273a2c7a801` (`qa/snar-v10-phase5-staging-e2e`). Commit and push each coherent implementation step and update this file before handoff. Read this branch's latest commit before editing. Preserve concurrent changes; do not force-push. Main, the existing QA branch and production are not the checkpoint destination.

The latest locally described Claude changes were not found on GitHub. The user does not know their location. Do not claim that this checkpoint contains or supersedes unavailable Claude code. If that work appears, compare it before replacing overlapping files.

## Exact design source

Use the original user-provided `SNAR_V10_VSCode_Package.zip`, containing `SNAR_V10_VSCode_Package/reference/snar-v10-design/`. The persistent file ID is `libfile_9f140149f1d08191a09e2143a6c61b96`. The other supplied archive is `SNAR Fleet v2 Design System (1)(1).zip`. No canonical Figma file URL was located; do not substitute the older 18-screen prototype.

The authoritative screen lists and layout are `src/CustomerApp.tsx`, `src/DriverApp.tsx`, `src/snar10/kit.tsx`, and `src/index.css` inside the original archive. Customer has 36 numbered screens. Driver numbering spans 01–31; `navPickup` combines 08–09 in one prototype state. Use state IDs as well as display numbers. Prototype names, prices, vehicles, forecasts, approval badges, timer transitions and GPS movement are examples, not production data.

## Code saved in this checkpoint

| Area | Implemented changes | Remaining verification or limitation |
|---|---|---|
| Both apps: mark and startup | Original SVG chevron paths, gradient geometry, 96px startup mark, SNAR wordmark, dark startup, one light-trace animation respecting reduced motion | React screen only; native OS launch assets/config not updated; Android/iOS comparison outstanding |
| Both apps: V10 primitives | Original icon paths; reusable native headers, rows, groups, badges, actions, empty/error states and typography | Only migrated routes use them; not a declaration that all screens match |
| Customer `index.tsx` | V10 onboarding spacing, typography, benefits and flat actions | Source AI-flight marketing was not copied as an unsupported capability; CTA keeps current permission/login flow |
| Customer `permissions.tsx` | V10 map-backed bottom sheet, real location request, explicit manual-address choice, denied/error states, duplicate-request guard, login/legal routing preserved | Real map imagery differs from prototype simulation; native capture outstanding; notifications remain handled by existing runtime/settings |
| Customer home location | Initial mount checks existing permission; only explicit location actions open the OS permission prompt | Avoids immediately undoing the manual-address choice; device GPS checks outstanding |
| Driver dock | Five tabs: drive, earnings, intelligence, messages, profile; V10 dimensions/icons/selection marker | Native blur, safe areas and trip-mode visibility still require device checks |
| Driver `messages.tsx` | Active-trip customer conversation, actual messages, four quick replies, call action, focused polling, double-send guard, failure/retry and empty states | No generic inbox/history API; native keyboard/device/chat lifecycle testing remains |
| Driver `driver-fleet.tsx` | Fleet card and navigation using account/vehicle data | No fabricated commission, contract, payout date or contact number |
| Driver `driver-documents.tsx` | Document presence and real identity status; links to identity/profile photo | A stored file means received, not approved; expiry/police certificate/general document upload contract not available |
| Driver `driver-navigation.tsx` | Google/Waze and Apple on iOS; server-confirmed setting, per-account storage, concurrent-save guard and errors | No fake in-app navigation, toll avoidance, route night mode or voice preferences |
| Driver `intel.tsx` | Linked route and honest empty state | Normal intelligence/forecast screen is NOT implemented; API contract unavailable |
| Driver profile/root layout | Links and routes to the added screens | Profile itself still needs the full compact V10 layout; login not changed in this checkpoint |

## Checks completed for this checkpoint

- Customer and Driver: `node node_modules/typescript/bin/tsc --noEmit` — PASS.
- `node scripts/verify-figma-mobile.cjs` — PASS. These are behavioral/component checks, not native pixel certification.
- `node scripts/verify-v10-screen-checkpoint.cjs` — PASS. Exercises manual address without OS prompt; location success/denial/failure; authenticated/legal routes; duplicate prompts; unconfirmed versus confirmed navigation writes; concurrent navigation saves; completed versus active trip messaging; incoming messages; duplicate quick replies; send failure.
- `node --test scripts/phase5-qa-build-guard.test.cjs scripts/phase5-qa-backend-preflight.test.cjs` — 12 PASS, 0 FAIL. Local guard fixtures, not a new live backend certification.
- `git diff --check` — PASS.
- Original prototype and actual Customer onboarding/startup components were rendered in Chromium at 370×824 through React Native Web with auth/router/safe-area fixtures. This checks web layout only. It is not an Android/iOS screenshot or a complete pixel match. Actual local image captures were reviewed; no 67-screen native comparison exists.

## Second checkpoint — Driver login and compact profile

- Driver login now uses the source's warm surface, 110px safe top anchor, 24px horizontal padding, 32/38 headline, 60px input rows, flat 58px primary action and footer anchoring. It retains real password auth and role/approval/2FA/legal/identity gates. Blank and duplicate submissions are guarded. Prototype SMS/BankID remain unavailable.
- Driver profile now uses the source's 72px avatar with 0.34× radius, header, grouped document/vehicle/fleet/activity rows and navigation/settings rows. Real rating counts are not falsely labelled as total trips; a required identity recheck does not show verified.
- The existing full account functionality is preserved in `driver-account.tsx`, reached from Driver settings. This includes notifications, vehicle selection, identity, profile photo, earnings links, password and logout. The existing notification tests now exercise that route.
- Shared rows match the original prototype's computed clickable-row padding, 56px minimum height, 2px subtitle margin and inset dividers; static rows retain their source padding.
- New fleet/documents/profile account queries include user identity in their cache keys. Navigation exposes its confirmed checked state for radio accessibility.
- Both existing behavioral scripts pass; the checkpoint script additionally tests all Driver login gates, blank/offline/duplicate submissions, compact profile routing and truthful status/counts. Driver TypeScript passes. Six actual Driver screens (login/profile/documents/fleet/navigation/messages) were web-rendered without JS errors; profile navigation and server-confirmed Waze selection were checked in Chromium.
- Saved visual evidence is in `evidence/2026-10-13/`. The comparison currently covers the original light variant. The prototype's default dark Driver theme, native captures and full parity remain outstanding.

## Third checkpoint — Driver vehicle, activity, trip detail and earnings

- `driver-vehicles.tsx` now uses the source's vehicle card, plate treatment and assigned-vehicle radio list. Vehicle busy/parked states are respected; duplicate requests are guarded; the selected car changes only after canonical server confirmation. The API does not supply images, year/color, inspection status or real seat count, so no stock vehicle or fictitious inspection badge is shown.
- `driver-trips.tsx` now groups available history by Oslo calendar date and links to the new `driver-trip/[tripId].tsx`. Trip detail uses backend-provided coarse areas, timing, payment status, receipt/trip reference and confirmed earnings. Backend intentionally removes exact customer addresses/coordinates after the trip, so the detailed map and passenger identity/rating rows are not fabricated. A support action opens the existing help page with the trip reference.
- Driver earnings overview and `driver-earnings-detail.tsx` now use the source's hierarchy, KPIs, graph, period switch, payout section and trip rows. Totals come from authoritative summary/weekly APIs, not a limited history page. Trip income is displayed only after paid status plus finite confirmed earnings. Missing/errored data does not become a zero income or a made-up payout date.
- Existing detailed/monthly reports remain reachable in `driver-earnings-report.tsx`; the monthly view explicitly states that its calculation uses available history (the current endpoint returns only a limited page). The current backend supplies daily totals for seven days, not an hourly shift graph, personalized growth baseline or forecasts. Overview graph labels and intelligence card stay truthful about this difference.
- Both apps now use Norwegian thousands separators for money and suppress non-finite amounts.
- Driver TypeScript and both behavioral scripts pass. Extended tests cover busy/parked vehicles, unconfirmed selection responses, duplicate selection, paid-only history/detail earnings, Oslo dates, missing history, authoritative financial totals, errored totals and absent payout dates.
- Eleven actual Driver routes have been rendered through React Native Web without JavaScript errors. New vehicle/activity/trip-detail/earnings/detail frames were inspected against source layout; native validation and backend-limited content differences remain open.

## Fourth checkpoint — Customer profile, messages, activity, trip detail and support

- Customer profile now uses the source's compact header, rounded-square avatar, separate saved Home/Work rows and payment/accessibility/settings/support group. Places and payment methods are loaded under account-scoped query keys. The existing full account view (Google linking, safety/privacy, deletion and logout) is preserved as `customer-account.tsx`, reached from settings. CustomerPhoto supports the original avatar radius and a hidden caption without removing upload/delete behavior.
- Customer messages now render the source-style active-trip conversation, driver name/plate, call action, real message bubbles, quick replies and composer. Uses the actual `passenger` sender role, a 500-character limit, focused polling and a synchronous duplicate-send guard. A failed send preserves the draft and warns that delivery was not confirmed; failed trip refresh hides the stale conversation. The prototype's unimplemented 24-hour retention promise is not displayed.
- Customer activity now uses the source hierarchy, active-trip card, grouped past rows and cancelled styling, linking to the new `customer-trip/[tripId].tsx`. Detail uses real customer-owned route coordinates when available, actual journey/driver/car/payment data, receipt and support links. Active rides reopen booking rather than being routed as completed receipts.
- Added the source-shaped support overview, with real active/latest trip context and links to the preserved working AI/human-ticket interface at `support-chat.tsx`. Accessibility is a reachable wrapper around the existing system-settings/unsupported-feature view; this is still **partial**, not a completed source accessibility screen.
- Five actual Customer routes (profile/messages/activity/trip detail/support) were rendered in Chromium through React Native Web without JS errors. Source and implementation frames were inspected. Native keyboard, device imagery, platform payments and full pixel parity remain outstanding.
- Customer TypeScript and both behavioral scripts pass. New tests cover saved profile data/routes, assigned-active versus closed/searching-trip chat, passenger bubble alignment, duplicate sends, preserved failed drafts, stale-status errors, activity/current-trip/detail/receipt routing and missing map data.

## Fifth checkpoint — Driver cockpit and complete trip presentation

- `DriverCockpitView.tsx` now presents source-style offline/online cockpit, server-pending shift transition, offer/countdown, pickup navigation, explicit inside note, arrival review, pickup waiting, passenger/start review, active trip, arrival/completion review and summary. UI review steps do not manufacture server transitions. Actual names/addresses, route metrics, offer deadline and accepted waiting policy drive the content; no fixed five-minute wait, turn directions, battery level, demand forecast or successful-online claim is invented.
- `V10HoldAction.tsx` implements the original red 58px hold button and **actual 900ms hold**. Early release, disable and unmount cancel the timer. Reduced motion retains the safety duration. Concurrent confirmation is guarded, failed actions are handled, and explicit accessible activation is supported.
- DriverHome's existing canonical API/state/GPS/permission/identity/queue/finished-trip logic remains in place and is wired to the new presentation. Minimize/reopen now has reachable controls and persisted state. Accept and decline share a synchronous lock; decline failures are visible rather than silently removed. Summary continuation/pause is guarded and persists dismissal before leaving.
- Driver-to-pickup map uses actual `pickup_route.geometry`; it no longer displays the passenger's complete driving route before pickup. The active ride switches to the actual passenger route. Exact historic coordinates remain excluded from driver history.
- Tests exercise **actual DriverHome** through arrival API, held start API, route switching, preserved final confirmation, completion API and pending-payment summary. Also test minimize/reopen persistence, semantic rejection versus offline queueing, server recovery, concurrent accept/decline, hold timing/release/unmount/reduced motion, UI-only reviews, missing wait policy, hidden in-trip financial data and paid-only summary amounts.
- Both TypeScript checks, the existing component/behavior checks and the extended checkpoint behavior script pass. Thirteen cockpit state frames were rendered through React Native Web without JS errors; source/implementation start, offline and summary frames were inspected. This is not native GPS/device/pixel certification.
- The presentation uses the approved light variant. Default dark theme, native map styling/blur, source motion polish, physical safe areas, provider prerequisites and native pixel parity remain open. Source sample map/person/car/media/forecast content is not production data. Full 67-numbered-screen completion is NOT claimed.

## Sixth checkpoint — Customer booking and pickup/live trip

- Preserves the concurrent GitHub Customer Home/booking checkpoint `9e73af8f71783a517652e8f82ddac89860ed750d`: actual home/search, route preview, vehicle selection, canonical reservation-card display and confirmation. See `CUSTOMER_BOOKING_CHECKPOINT_20261013.md` for its checks and contract limitations. No overlapping work was replaced.
- `CustomerTripView.tsx` now presents payment authorization, matching/actual search rounds, no-driver/cancellation recovery, driver-on-way, confirmed inside preference, walking guide, actual pickup plate and in-trip/minimized actions in the original V10 layout. Existing cancellation preview/reconciliation, safety dialer, sharing, messaging, GPS freshness and canonical receipt navigation remain in the controller.
- Customer readiness sends a real, confirmed trip message; it does not start the ride. Driver remains the only start authority. Inside preference changes only after server acknowledgement and is guarded against duplicates and route changes. Bank authorization keeps the actual server status rather than implying success.
- Backend adds a customer-owned pickup preference PATCH limited atomically to assigned pickup states and publishes real OSRM driver-to-pickup geometry through the existing accept/ETA refresh. No extra route calls or simulated route/GPS are introduced. Driver respects explicit true/false preference before legacy note text. Customer uses this geometry only while fresh and en route to pickup; passenger route appears during the ride.
- Backend `server.py` was byte-for-byte verified against the QA baseline before these targeted changes. Seven isolated stdlib unittest cases execute the actual endpoint/helpers and check ownership/state restrictions, repeat/clear preference, no route after end, existing throttling and absent-road handling. This is not full backend regression or live deployment certification.
- Both TypeScript checks and both behavior scripts pass. Actual Customer booking wiring additionally checks preference confirmation/failure/serialization, route geometry, walking link, readiness without a manufactured start and bank-state authorization. Five home/booking layouts were web-rendered by the concurrent checkpoint; pickup/live-trip native comparison is outstanding.
- **Deployment prerequisite:** this backend contract is committed only. Install it on the QA backend and exercise authenticated Customer/Driver integration before the combined builds. No deployment or build was triggered.

## Continue next

1. Continue core Customer booking/search/route/vehicle/payment/confirmation/trip/receipt/rating and payment-method views with existing reservation, retry, cancellation, location, payment and safety guards.
2. Complete theme, motion, Driver approval/identity, Customer accessibility/settings/notifications and remaining supported states. Scheduling/flight prediction, provider auth, forecasts and several document/vehicle data fields still lack supported contracts; record those precisely.
3. Continue Customer and Driver screens in original source order. Record each route/state as implemented, partially implemented, blocked by a specific contract, or not reviewed. Do not count a placeholder, an empty state, a route name or a component count as a completed design screen.
4. Render the new map/permission, messages, documents, fleet and navigation screens with loading/error/real-data states. Run meaningful interaction tests and compare typography, insets, shapes, colors and motion.
5. Finish native visual checks and the existing QA build/device gates before requesting a combined Customer + Driver build. Keep existing QA-only build profiles and deployment safeguards. No new APK, OTA, store release, production deployment or main merge has occurred in this implementation task.

Read `PHASE5_RESUME_CHECKPOINT_2026-10-12.md` for the earlier infrastructure/Stripe/build state. Those historical checks do not certify new screen changes. This checkpoint does not repeat, invalidate or claim completion of the separate blocked mobile build/device work.
