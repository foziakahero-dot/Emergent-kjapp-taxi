# Current checkpoint — Fleet v2 source reconciliation complete; publication blocked (2026-10-14)

Read FLEET_V2_CONTINUATION_RESULT_20261014.md and CURRENT_FLEET_V2_SCREEN_INDEX_20261014.json. Current Customer/Driver studios, signature styling, real message routing and scheduled preview are saved in local commits. Source hash, both typechecks, component/controller, Assist, support and QA guards pass; web fixture evidence is separate from physical/native certification. Missing provider/contracts and native pixel acceptance remain open.

Automatic approval review requires explicit user approval to publish this exact candidate to the public foziakahero-dot/Emergent-kjapp-taxi implementation/snar-v10-screens-20261013 branch. New commits are not remote. Do not retry via an alternate public write path. Recheck remote head before publishing after approval. Preserve the supplied ZIP identity/hash; never revert to the old V10 source or claim all native states are identical. No APK.

---

# Current checkpoint — Driver 03/04 and source studios (2026-10-14)

Read DRIVER_PAIR_03_04_20261014.md. Both current source studios are implemented and checked. Driver targets are scoped to the authenticated driver and confirmed by local persistence. Continue Driver 05/06 then the remaining state/route pairs, preserving canonical trip transitions. All new checkpoint commits remain local pending the exact public-destination approval required by automatic review. No APK.

---

# Current checkpoint — Customer 35/36 reconciled (2026-10-14)

Read CUSTOMER_PAIR_35_36_20261014.md and FLEET_V2_NEW_SOURCE_20261014.md. The current Reisestudio is implemented. Scheduling is a reachable disabled preview; global states remain contextual and partial where source contracts are absent. Continue Driver 03/04 and the remaining pairs. GitHub public pushes are blocked by automatic approval review pending explicit approval of that exact destination; preserve local commits and deliver a private patch. No APK.

---

# Current checkpoint — supplied Fleet v2 ZIP retrieved and compared (2026-10-14)

The access blocker below is resolved. Read FLEET_V2_NEW_SOURCE_20261014.md and the frozen reference/fleet-v2-20261014/manifest.json. Customer 02/06 now contains the actual Reisestudio; the screen-specific source for 19–34 is unchanged. Shared Customer signature styling is ported. Continue Customer 35/36, then Driver studio and audit. Keep native/provider acceptance distinct from source/layout checks. No APK build is requested.

---

# Current source correction — Figma Make supplied by user (2026-10-14)

This section supersedes every source-completeness claim and next-pair instruction below.

Authoritative source for BOTH Customer and Driver:
https://www.figma.com/make/7947uNsMq8WNEq3eZSHmuz/SNAR-Fleet-v2-Design-System?t=RGwJIZdmnH3jirmp-0

The user requests continuous implementation, one or two screens at a time, automatically proceeding to the next screen. Finish Customer, then Driver. No APK/IPA/release/deployment/merge before the screen work is complete. Do not ask for permission to continue routine implementation.

## Why the earlier source is insufficient

The prior implementation used the older SNAR_V10_VSCode_Package.zip reference. The user's newer screenshot contains SNAR Personal / Reisestudio content absent from that archive. The current Figma Make manifest includes src/CustomerApp.tsx, src/DriverApp.tsx, src/snar10/ExperienceStudio.tsx and src/snar10/signature.css. These file names confirm the source difference, but their contents have NOT been retrieved or compared. Customer checkpoints 19–34 passed the documented type/behavior/layout checks against the older archive; they do NOT establish parity with this newer Make file. Reconcile all existing screens against the new source before claiming completeness or a final screen count.

## Concrete access blocker

Figma get_design_context, account snarapp, fileKey 7947uNsMq8WNEq3eZSHmuz, nodeId 0:1 succeeds but returns only resource_link entries. Reading file://figma/make/source/7947uNsMq8WNEq3eZSHmuz/src/App.tsx through the available codex_apps resource reader returns Unknown resource. The other connected Figma account reports no edit access. The browser cannot open this Make URL (Site Unavailable). No access permissions were changed.

The manifest also lists public/downloads/snar10-kildekode.zip. A fresh code ZIP exported from THIS Make file would unblock exact comparison. Do not substitute the old archive or infer the new studio implementation from a single screenshot.

## Saved implementation state

Latest pushed implementation commit before this correction: f778e7778cdc4ce60defbc565e64786b1cb160be, on implementation/snar-v10-screens-20261013. Customer 33/34 adds persisted accessibility controls, shared contrast palettes and opt-in real trip speech. Native/provider/pixel acceptance remains open.

Uncommitted work exists for old-source screen 35 in frontend/app/scheduled-trip.tsx and its home/booking/layout links. It is a disabled planning preview without a scheduling backend and has NOT been pushed or accepted against the new design. Preserve and reassess it once new source is available. Driver has not been advanced during the Customer 19–34 checkpoints.

## Resume action

Obtain the actual new Make source, inspect App.tsx, CustomerApp.tsx, DriverApp.tsx, ExperienceStudio.tsx, kit.tsx, signature.css and index.css, then map actual current screen IDs and compare existing implementations. Prioritize the verified SNAR Personal home/returning discrepancy, continue automatically in pairs with relevant checks and a push after each pair. Preserve actual existing FastAPI/Mongo, payment, chat and dispatch contracts; no fabricated backend behavior or new Supabase migration.

---

# Latest pair — Customer 33/34; automatic continuation (2026-10-14)

Read CUSTOMER_PAIR_33_34_20261014.md. All four accessibility controls persist; high contrast updates the shared light/dark palettes and opt-in Expo 57 Speech reads actual trip status/fresh ETA/plate with dedup/offline/cleanup guards. Source geometry, settings navigation and actual logout remain. Customer type and behavioral suites pass; light/dark layouts have no JS errors. New native speech requires a future native build; no build is requested yet. Next automatically: 35 Planlagt tur and 36 Tilstander, then Driver audit.

# Previous pair — Customer 31/32; automatic continuation (2026-10-14)

Read CUSTOMER_PAIR_31_32_20261014.md. Payment card has source entry/elevation/tabular geometry while actual Stripe verification remains. Support distinguishes canonical live versus historical trips, uses source topics and opens actual contextual chat/tickets. Next automatically: 33 Tilgjengelighet + 34 Innstillinger, then 35/36 and Driver. Native provider/device pixel acceptance remains open.

# Previous pair — Customer 29/30; automatic continuation (2026-10-14)

Read CUSTOMER_PAIR_29_30_20261014.md. Voice glyph uses actual recorder metering, source dimensions and reduced motion; voice map frames actual geometry. Profile has source entry/spacing, canonical verified-card summary and account/version-keyed private avatar cleanup. Customer type and main/Assist behavioral suites pass. Physical microphone/photo/provider/native pixel acceptance remains open. Next automatically: 31 Betalingsmåter + 32 Support, then 33 Tilgjengelighet + 34 Innstillinger and 35/36.

# Previous pair — Customer 27/28; automatic continuation (2026-10-14)

Read CUSTOMER_PAIR_27_28_20261014.md. Notifications use actual inverse action/receipt groups with accessible 210ms collapse; ended rides cannot appear active. AI suggestions/messages/result object follow source entry motion and preserve real explicit booking/consent contracts. Customer type, component/controller and Assist suites pass; light/dark notification/AI-idle web fixtures have no JS errors. Unsupported inbox/scheduling/flight/provider contracts and physical/native acceptance remain open. Next automatically: 29 Stemme + 30 Profil, then 31 Betalingsmåter + 32 Support.

# Previous pair — Customer 25/26; automatic continuation (2026-10-14)

Read CUSTOMER_PAIR_25_26_20261014.md. Trip detail has source map/journey geometry, Oslo times and direct historical receipt routing; stale trip IDs are suppressed. Messages have source bubble entry, successful-send feedback and trip-scoped private driver avatar with stale-photo guards. Existing actual chat/payments remain. Next automatically: 27 Varsler + 28 SNAR AI, then 29 Stemme + 30 Profil. Native/device acceptance remains open.

# Previous pair — Customer 23/24; automatic continuation (2026-10-14)

Read CUSTOMER_PAIR_23_24_20261014.md. Original rating-star shape/control sizes now animate selection; skip stays visible after selecting a rating, explicit submission remains canonical. Activity has entry motion and Oslo-calendar week/time display, preserving real active/history routing and global Island. Customer type and behavioral checks pass; native acceptance remains open. Next automatically: 25 Turdetalj + 26 Meldinger, then 27 Varsler + 28 SNAR AI.

# Previous pair — Customer 21/22; automatic continuation (2026-10-14)

Read CUSTOMER_PAIR_21_22_20261014.md. Source payment-check geometry/draw/pop and staggered paid content are implemented, with theme-correct positive-soft fill and real-paid-only feedback. Receipt journey slots/rows follow the source with sequential entry; factual receipt/share/payment handling remains. Customer type and both behavioral suites pass. Light/dark web fixtures for 19–22 render with actual fonts and no JS errors; native acceptance remains open. Next automatically: 23 Vurdering + 24 Aktivitet, then 25 Turdetalj + 26 Meldinger. User wants continuous pairs and no release build before Customer/Driver screens are complete.

# Previous pair — Customer 19/20; automatic continuation (2026-10-14)

Read CUSTOMER_PAIR_19_20_20261014.md. Arrival uses fresh real GPS, destination-only camera framing and once-per-trip feedback. Summary uses original pop/metrics, count-up and measured route framing, and remains visible if the initial response is already paid. No proximity event ends a ride and no reserved ride exposes a second charge. Customer typecheck and both component/controller suites pass; physical pixel/device acceptance remains open.

User explicitly instructs automatic continuation in pairs (one screen at a time where necessary), checking and pushing each pair, then continuing Customer and Driver without waiting for another prompt. Next is 21 Betaling fullført + 22 Kvittering, then 23 Vurdering + 24 Aktivitet. No signed-build/release step is requested before screens are finished.

# Previous pair — Customer 17/18; uploaded visible sequence saved (2026-10-14)

Read CUSTOMER_PAIR_17_18_20261014.md. Seven paired checkpoints cover 05–18 in the user's uploaded order: position/home, search/route, vehicle/payment, confirm/matching, driver/approach, guide/arrival, live trip/safety. Existing returning/intro/login/splash implementations remain from earlier checkpoints. All-class real supply, stale-response/route/photo guards, source panels/dock, actual consent/payment/dispatch and explicit driver start are preserved. Next pair in the original file is 19 Ankommer + 20 Tur fullført, then 21 Betaling fullført + 22 Kvittering.

Physical pixel/device acceptance and signed builds remain open. Do not claim all screens are identical or native-certified. Search-map pulse/sweep, completed-road fade and unsupported Comfort/non-card reservation/provider/scheduling contracts remain documented. Continue in Customer order, two screens per push; older Driver-next or release instructions below are historical and superseded.

# Latest pair — Customer 15/16 (2026-10-14)

Read CUSTOMER_PAIR_15_16_20261014.md. Guidance uses real pickup; arrival identity/pop/wait estimate follows source; confirmed ready message disables repeat and never starts the ride. Continue 17 Tur pågår + 18 Sikkerhet. Type, component/controller, web and offline native-bundle checks pass with physical-device limits documented. Uploaded Customer order stays authoritative; no signed app or deployment.

# Latest verified pair — Customer 13/14 (2026-10-14)

Read CUSTOMER_PAIR_13_14_20261014.md. Driver card/tag follows source and fresh real data; old route/photo state is suppressed on a changed trip reference. TypeScript, both behavioral suites, native camera checks, 22 web fixtures and offline Android/iOS exports pass. Next: 15 Henteveiledning + 16 Sjåfør har ankommet, then 17 Tur pågår + 18 Sikkerhet. Physical device/marker/haptic/photo certification and search-map sweep/pulses remain open; no new signed app.

# Latest verified pair — Customer 11/12 (2026-10-14)

Read CUSTOMER_PAIR_11_12_20261014.md. Confirmation now validates real waiting terms/token and confirmed trip ID; explicit quote refresh retains route/review and requires new consent. Matching uses source activity/journey and measured sheet entry while server state owns every attempt/assignment/end. Both behavioral suites, typecheck, 18 web fixtures and Android/iOS offline exports pass. Next source pair is 13 Sjåfør funnet + 14 Sjåfør nærmer seg, then 15 Henteveiledning + 16 Sjåfør har ankommet. The uploaded Customer index supersedes all older next-step headings below. Provider and physical-device acceptance remain open; no signed build or deployment.

# Latest pair — Customer 09/10 (2026-10-14)

Read CUSTOMER_PAIR_09_10_20261014.md. Home now fetches all qualified classes; vehicle rows use actual class ETA, source dimensions/names and original photo URLs with fallback. Payment mirrors canonical verified reservation card in the source grouped layout. Comfort and non-card reservation providers remain explicitly disabled because the real contract is absent; never relabel legacy enkelt as Comfort or imply a local choice changes the backend charge. Next pair: 11 Bekreft + 12 Søker sjåfør, then 13 Sjåfør funnet + 14 Sjåfør nærmer seg.

# Latest verified pair — Customer 07/08 (2026-10-14)

Read CUSTOMER_PAIR_07_08_20261014.md. Search/route have source motion, metrics/Oslo arrival, validated places, quote-response protection, full-road camera framing and matching route/marker styling. TypeScript, behavioral tests, web fixture inspection and Android/iOS offline exports pass. Next pair in the user's corrected order is 09 Kjøretøyvalg + 10 Betaling, then 11 Bekreft + 12 Søker sjåfør. The uploaded Customer index remains authoritative over older Driver-next instructions below. No signed build or native pixel acceptance is claimed.

# Current authoritative order — Customer 05/06 (2026-10-14)

The user's uploaded screen-index image supersedes all older next-pair instructions below. Continue Customer in pairs: 05 Posisjon + 06 Hjem/kart, then 07 Søk destinasjon + 08 Ruteforhåndsvisning, then 09 Kjøretøyvalg + 10 Betaling, then 11 Bekreft + 12 Søker sjåfør (35 Planlagt tur is an optional branch and needs its real contract). Do not jump to Driver approval/selfie. BankID is excluded; Google/Apple use existing native contracts. Push each verified pair on implementation/snar-v10-screens-20261013.

05/06 now corrects post-login navigation through permission, the native home viewport beneath the floating dock, original dock icons/pressed state/dark inverse color, measured source sheet entry, map-backed glass and actual private customer avatar. Location and photo stale responses are guarded. Read CUSTOMER_PAIR_05_06_20261014.md for checks and limits. Native map, blur, OS safe areas and provider login need device evidence; existing APKs predate these changes.

# Local native verification — three screen pairs saved (2026-10-14)

Read `SCREEN_PAIRS_NATIVE_VERIFICATION_20261014.md`. Customer and Driver Android/iOS offline Metro/Hermes exports all exit 0 with the canonical QA URL; both TypeScript and behavioral checks pass. These are not signed APK/iOS builds, and existing APKs predate the code. QA provider configuration, Driver Google iOS configuration and physical pixel/device validation remain unresolved. Next pair: Driver approval/selfie, then Customer route/vehicle selection. Continue from the saved branch and verify existing implementations before editing.

# Latest pair — introduction and permission (2026-10-14)

Read `INTRO_PERMISSION_PAIR_20261014.md`. Source 210ms staggered entrance and measured 280ms permission sheet are saved and verified, alongside the earlier auth/registration and Customer home/search pairs. Next pair in the file is Driver account approval + selfie verification (03/04), then Customer route/vehicle choice (08/09). Preserve existing source-matched implementations; document real API/physical/provider limitations. QA Google/Apple configuration and Driver Google iOS remain outstanding, and existing APKs predate all these changes.

# Latest pair — Customer home and destination search (2026-10-14)

Read `HOME_SEARCH_PAIR_20261014.md`. Home uses quiet real-supply refresh, shared nearby-car framing on web/native, source vehicle geometry, explicit camera recenter and the V10 address sheet. Tests and web layout checks pass; live QA returned zero qualified cars at the checked pickup. Physical map/GPS/pixel acceptance and QA OAuth credentials remain outstanding. Next pair: Customer introduction and location permission. BankID is excluded; work and push two screens at a time. Existing APKs predate these commits.

# Current user scope — two screens at a time (2026-10-14)

BankID is excluded. Customer registration and Driver Google/Apple presentation are saved; read `AUTH_REGISTRATION_PAIR_20261014.md` for the concrete QA OAuth and Driver iOS blockers. Continue on Customer home/live-car availability and destination search, then the next pair in the original file. Commit/push each verified pair and preserve real integrations. Existing APKs predate these changes. Do not claim complete native pixel or provider acceptance without device evidence.

# Current user scope — splash and login only (2026-10-14)

The user stopped the broad screen implementation and instructed us to finish and push Customer/Driver splash and login before moving on. Read `SPLASH_LOGIN_CHECKPOINT_20261014.md` first. Native splash/launch and password-login presentation fixes are saved in this checkpoint, but original SMS/BankID login parity and physical native verification remain outstanding. Do not claim these screens are fully pixel-certified or continue other screens. Existing QA APKs predate these fixes and need a rebuild to include native splash assets.

# Customer + Driver screen implementation — resume here

Updated 2026-10-14 (Europe/Oslo). This is an implementation checkpoint, not release certification.

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

## Seventh checkpoint — Customer completion, paid, receipt, rating and payment methods

- Replaces the generic receipt monolith with the original V10 completion bottom sheet, 88px paid check, 44px paid amount, receipt group/brand/reference/journey/rows/share/help and explicit 52px star rating sheet. Confirmed server data supplies destination, amounts, times, driver, car and fleet. No sample email delivery, fictitious service fee, VAT calculation or receipt number is introduced.
- Payment status remains canonical. Automatic reservation rides never expose a second payment CTA. Manual/native/Checkout verification and legacy paid-arrived completion are retained with duplicate-payment guarding. Failed status refresh is visible; active rides cannot be displayed as ended. Route/unmount/stale response checks protect receipt data.
- Stars only select locally. Explicit Send serializes submissions, records optional selected feedback, waits for `ok: true` and reconciles a lost response. Failed submission keeps selection for retry; unpaid rides cannot be rated.
- Payment methods use the source 180px gradient card and compact groups with real verified Stripe instruments and expiry. Primary mirrors the booking service's default/newest selection. Setup and removal share a synchronous operation lock. Removal checks the real backend `deleted: true` contract; failed or unconfirmed responses do not imply deletion. Account-scoped query keys and failed-fetch hiding prevent stale card presentation.
- Both TypeScript checks and both behavior scripts pass, including actual receipt/payment routes through reservation suppression, unconfirmed native return, canonical paid transition, explicit rating/feedback/failure/retry/duplicates and verified/unverified cards/setup/remove. Eleven Customer pickup/live-trip/post-trip/payment frames render in Chromium through React Native Web without JavaScript errors. Original and actual paid/receipt frames were inspected; this is not native pixel verification.
- **Still partial:** PDF download needs a customer-owned canonical receipt/PDF endpoint; the source-shaped action is explicitly disabled. Immutable receipt ledger exists only under admin APIs and lacks a VAT breakdown. Wallet/device availability, company billing, per-booking card selection and email receipt preference contracts are unavailable, so no working switches or ready badges are fabricated. Native payment/device and exact motion/theme validation remain required.

## Eighth checkpoint — Driver approval/selfie, settings and accessibility

- Adds the original Driver account-status screen with actual account/identity queries, missing-first document rows and truthful registered-versus-approved status. Approved accounts requiring identity now enter this screen before selfie; legal and role gates remain intact. Runtime identity gate keeps an already-open approval/selfie page instead of replacing a camera/preview every poll. No demo cockpit bypass is added.
- Driver identity uses the V10 information screen and 240×300 camera/preview oval on the dark camera surface, actual front-camera permission/readiness/capture, explicit private submission and server-confirmed manual review. Duplicate permission/capture/submit requests are guarded, failed/unconfirmed upload retains the photo, and only actual verified state allows continuation through the root account gate. No timed or automatic face-match success is simulated.
- Customer and Driver compact settings now use source groups and links. Existing account, data export, deletion, navigation and version/legal controls remain on dedicated `customer-data.tsx` / `driver-account-settings.tsx` routes. Customer notification view exposes actual active-trip context, OS/native registration gate and server-confirmed notification settings. Separate notification history/flight forecast feed is still unavailable.
- Accessibility now has the source layout. Larger text and reduced motion are **implemented globally in both apps**, persisted under separate device keys. Nested text scales once; system text scaling remains enabled; local reduced motion cannot override OS reduced motion. Persistence must succeed before UI changes; duplicate saves and failures are handled. Customer high contrast, extra spoken ETA/plate and both apps' dark/automatic appearance remain explicitly unavailable.
- Fixed a discovered contract gap: SettingsUpdate previously ignored Driver notification/sound/vibration fields. API now accepts them, stores only the authenticated user's preferences and applies optional ride/message/offer notification choices before native/web delivery. Unknown/identity-security tags retain prior delivery; QA still disables external push before preference lookup. Driver offers forward saved sound/vibration choices to Expo's existing four registered Android channels and iOS sound field. Legacy raw FCM delivery keeps its earlier default sound behavior; device/remote integration tests are still required.
- Both app typechecks and both behavior scripts pass, including actual Driver approval/camera gates, confirmed Customer/Driver settings, global typography scaling/OS motion priority, failed preference persistence and preserved account routes. Backend has 13 new actual-schema/endpoint/delivery/payload checks plus the earlier seven pickup checks; these are isolated tests, not full backend regression or live delivery certification.
- Six actual account/status/settings screens plus the camera container were web-rendered without JS errors, using permission/camera/query fixtures. This does not test a physical camera, actual push receipt, native keyboard, native safe areas or certify exact pixels. QA backend rollout, permission/camera review and combined Customer/Driver device verification remain required before builds.
- Source divergences remain explicit: password auth versus source SMS/BankID, manual identity review versus prototype auto-match, absent independent document approval/expiry, missing theme/contrast/voice/forecast/schedule/notification-history/PDF contracts or implementation. Continue remaining supported screens; full 67-numbered-screen implementation is NOT claimed.

## Ninth checkpoint — reactive light/dark/system themes, Customer sign-in and safety/arrival

- Both apps now use the exact original light/dark palette for background, surface, text, inverse actions, badges, dividers, glass and elevation. Driver defaults to the original dark cockpit. Customer has a persisted light/dark/system picker; Driver has a persisted dark-cockpit switch. OS appearance changes affect automatic mode. Writes are serialized and acknowledged before the mode changes; storage failure retains the previous mode.
- Existing color imports resolve immutable current palettes at render time; components subscribe through useSyncExternalStore. Existing makeStyles factories and formerly static styles now cache by palette. The change updates presentation without a navigation key/remount or a ride/payment state transition. Typography defaults, nested inheritance, native inputs, inverse action text and status bars follow the active palette. This is compatibility plumbing for existing screens, not an AI/provider reconfiguration.
- Customer sign-in now uses the source header, warm/dark surface, 56px neutral input rows, flat 56px action, divider, provider actions and anchored legal footer. Actual email/password/Google/Apple, password recovery and registration routes are retained; password and both SSO providers share a synchronous lock. Role/legal/2FA gates and rejection of unconfirmed auth are tested. SMS login is still missing; native Apple uses the real SDK widget, so native font/branding comparison remains required.
- Customer safety now uses the source bottom sheet/header/groups/actions with actual driver and car, confirmed reporting, actual live-share link and the existing immediate 112 dialer. No fabricated license verification, response SLA or automatic transfer of coordinates to emergency services is displayed. The prototype's 113/hold behavior is not copied over the existing validated 112 action.
- Adds the source-shaped near-destination view, driven only by valid fresh GPS during an actual active trip. Distance is explicitly approximate straight-line proximity. It cannot end the ride; driver completion and canonical receipt redirect remain the authority. Stale/offline/missing coordinates do not produce an arrival presentation.
- Both TypeScript checks and both behavior scripts pass. New checks cover actual Customer sign-in and provider serialization, theme persistence/failure/OS changes/inverse readability, retained draft and no remount, Driver dark default and Customer proximity without an end transition. Existing ride, payment, hold, queue, chat, privacy, GPS, permissions and QA build guards remain in place.
- Web rendering checks covered 11 Driver routes + 13 cockpit states under the dark palette; 14 Customer sign-in/pickup/trip/safety/post-trip/payment frames; five Customer account/activity/message/support routes; and six account/settings/status frames plus a camera container. Fixtures omit real maps/provider widgets/camera/OS chrome. Original dark and actual Driver profile/cockpit frames and Customer safety/sign-in frames were inspected. This is not native pixel certification; default map/provider/OS imagery and source motion polish remain open.
- The following checkpoint supplies the supported AI/stemme source 28–29 migration; provider and native certification remain open. No new OpenAI request/key/configuration was made in this checkpoint. Scheduled/flight/forecast/taxonomy/media/document/PDF contracts remain missing. High contrast and extra spoken ETA/plate remain disabled. **Do not claim that all 67 numbered screens are implemented or pixel-identical.**

## Tenth checkpoint — integrated AI/voice, support recovery and QA rollout

- Preserves Customer booking checkpoint `9e73af8`, AI/voice `ecf5ddd` and the complete persisted-theme/sign-in/safety work originally saved locally as `ecc8171`. The combined code passes both app typechecks, both existing behavioral suites, actual Assist and support recovery tests, 27 targeted backend tests and the 12 QA build guard fixtures.
- Actual AI/voice uses the new source layout, existing GPS/address/estimate APIs, canonical card and waiting-policy authorization, explicit serialized booking and genuine recording/ASR states. Future-time requests are refused; no source flight/SMS/previous-driver capability is invented. Closing an active recording cancels it; expired recordings are transcribed once. The composer no longer covers confirmation.
- Support chat preserves failed drafts, offers explicit retry without duplicating the customer bubble, exposes human ticket intake independently of AI, accepts only confirmed ticket IDs and prevents recreating an identical confirmed case in the open session. Removes the non-working code redemption control and uses V10/theme primitives. Failure/retry/ticket cases pass behavioral tests and four light/dark web render checks with fixture APIs. Live provider and ticket delivery are not certified by these fixtures.
- Support overview now accepts the actual array returned by trip history and hides failed cached active/history data. The selected issue and actual trip reference prefill the chat draft. Opening support does not submit a message or ticket; the customer still confirms the action. These cases pass the actual support-controller test.
- The user explicitly authorized Render QA rollout on 2026-10-14. Backend-only QA commit `1e17796b4b69a0a6a06435e0ee93b9d552906f0e` deployed as `dep-db7an8t9fdbs73dgjqqg`; Render confirms **live** since 2026-10-13 22:09:18 UTC (2026-10-14 00:09 Oslo). Startup completed, canonical URL is api-qa.snarapp.no, and no error-level app logs appeared in the inspected interval after deployment. Existing QA Mongo/Stripe/provider suppression is retained.
- QA chat previously attempted to construct the legacy AI client with an intentionally empty key, outside its error handler. It now returns explicit 503 before provider calls and catches initialization, timeout and empty replies. **AI replies/transcription remain unavailable under the existing QA provider policy.** This is not BytePlus activation.
- Direct live health/readiness and authenticated flow certification remain unverified. Terminal access timed out; the cloud browser's automatic approval review rejected the health-page action because the usage limit was reached. The review did not determine the action unsafe. No workaround or access expansion was attempted after that rejection.
- No APK has been generated. The latest verified builder obstruction is the earlier GitHub Actions billing lock; this continuation does not assert that it is still locked without a fresh account check. QA build workflow requires the QA branch, but that branch currently carries the backend rollout only; use an explicitly reviewed combined source before builds, never its old mobile screens.

## Continue next

1. Verify fresh canonical QA health/readiness and authenticated Customer/Driver/support integration when the blocked live check is available. Do not reseed users, reset credentials or recreate QA infrastructure.
2. Resolve/verify the previous Actions billing obstruction or use an existing authorized builder. Promote the reviewed combined mobile source to a QA build candidate, then generate both QA apps with exactly https://api-qa.snarapp.no and recorded source SHA.
3. Capture native screens and exercise the complete ride/payment/recovery flow. Web fixtures and source-shaped components do not certify pixel parity, native maps, OS widgets, keyboard, GPS, microphone, camera or payment providers.
4. Remaining design dependencies: scheduling/flight prediction, Driver demand forecasts, notification history, customer receipt PDF/VAT endpoint, extra document/vehicle fields, SMS/BankID, high contrast/spoken guidance and provider configuration. Preserve truthful unavailable states until their contracts exist.

Read `PHASE5_RESUME_CHECKPOINT_2026-10-12.md` for earlier infrastructure/build evidence. Full 67-numbered-screen pixel-identical completion and beta readiness are not claimed. No main merge, production deployment, store release or OTA occurred.

## Fresh continuation evidence — 2026-10-14 01:51 Oslo

The combined mobile candidate is saved as `b847dc1a5c6ed6bc285c4935b1dc8fcf2cb8c192` in draft PR #101, targeting QA, with GitHub reporting mergeable=true. Both app typechecks, all behavioral/controller suites, 27 targeted backend cases and 12 QA guard fixtures pass. The candidate backend blob matches the deployed QA source exactly (`cf449b4022e2c1757bc3760237f49876384d157f`).

A fresh PR-triggered Actions run, `38486477203`, is completed with startup_failure. Its actual GitHub annotation says the job was not started because recent account payments failed or the spending limit needs increasing. No jobs/artifacts were produced. Do not retry builds until the account billing/spending obstruction is resolved through an authorized human payment path.

The previous browser usage limit no longer blocked opening QA. The free Render instance woke up; startup completed and the application log confirms `GET /api/health` HTTP 200 at 2026-10-13 23:50:45 UTC. Reading the resulting browser page was rejected by the browser URL policy because its protocol was not allowed. No alternate-browser, raw-page, protocol or indirect workaround was attempted. The JSON body, canonical readiness and authenticated integration remain unverified. Deployment live plus HTTP 200 is not full database/Stripe/ride certification.

# Publication approved and Driver 01/02 checkpoint (2026-10-15, Oslo)

The user explicitly approved publishing the prepared candidate to `foziakahero-dot/Emergent-kjapp-taxi`, branch `implementation/snar-v10-screens-20261013`, then continuing Driver screens. Publication succeeded through the connected GitHub API because shell Git has no write credential. Remote head `d080d5d467b2581178e619d8cf5f27b47b00d9d3` has tree `135f058405b2b9d2cc88f48752e24f794d442fb8`, identical to reviewed local head `7eda7a1`. All eight original checkpoint trees were preserved; GitHub assigned new commit IDs. PR #101 remains draft. The earlier publication blocker below is resolved.

Driver 01/02 changes and measured evidence are in `DRIVER_PAIR_01_02_20261015.md`. Splash lockup/entrance and login primary shadow were corrected against the actual supplied ZIP. Driver typecheck and both screen/mobile behavior suites pass; source/native-component browser comparisons have no page errors. Actual provider/device acceptance remains open.

Continue automatically with Driver 03/04, checking and publishing each pair. Preserve existing auth/dispatch/payment contracts. Use the supplied Fleet v2 source already extracted; do not ask for it again. No new APK, merge, deployment or production change is requested.

---

# Latest Driver pair — 03/04 (2026-10-15, Oslo)

Pair 01/02 is published as `24cec6a`. Pair 03/04 evidence and limitations are in `DRIVER_PAIR_03_04_20261015.md`: source approval fade/inset outline, shared badge centering, offline header entrance/shadows and account-scoped authenticated avatar with failure fallback. Driver typecheck and both component/behavior suites pass; approval/offline/studio browser fixtures have no page errors. Continue automatically with 05/06 after publishing this pair. Existing backend and native/device limitations remain explicit; do not call all Driver screens finished or pixel-identical.

---

# Latest Driver pair — 05/06 (2026-10-15, Oslo)

Driver 01/02 and 03/04 are published as `24cec6a` and `1c1b4df`. Read `DRIVER_PAIR_05_06_20261015.md`: source-shaped pending shift card/ring and hidden old controls, canonical acknowledgement and duplicate-toggle guard, tabular online numerals. Driver typecheck and both behavioral suites pass; eight source/native-component frames have no page errors. Continue automatically with 07 and 08–09 after publishing this pair, then 10/11. Do not start another APK or call native/provider/pixel acceptance complete.

---

# Latest Driver pair — 07 and 08–09 (2026-10-15, Oslo)

05/06 is published as `b7ec067`. Read `DRIVER_PAIR_07_09_20261015.md`: offer geometry/ring/icon/price now measured against the source; pickup navigation has three source-sized actions and the fresh actual ETA, with no invented turn guidance. Typecheck and both suites pass; eight source/native-component frames have no page errors. Continue with 10/11 after publishing. Physical device, map/provider and complete pixel acceptance remain open.

---

# Latest Driver pair — 10/11 (2026-10-15, Oslo)

07 and 08–09 are published as `ab2e679`. See `DRIVER_PAIR_10_11_20261015.md` for waiting-inside source motion/shadow and actual arrival review checks. Typecheck and checkpoint suite pass; eight source/native-component frames have no page errors. Continue automatically with 12/13 after publishing. No APK; native/provider/pixel acceptance remains open.

---

# Latest Driver pair — 12/13 (2026-10-15, Oslo)

10/11 is published as `976e23e`. Read `DRIVER_PAIR_12_13_20261015.md`: waiting-ring geometry, tabular confirmation price, source hold-button shadow/tracking with all safety behavior retained. Typecheck and checkpoint suite pass; eight source/native-component frames have no page errors. Continue automatically with 14/15 after publication, then 16/17. Physical-device/provider/map/pixel acceptance remains open; no APK.

---

# Latest Driver pair — 14/15 (2026-10-15, Oslo)

12/13 is published as `0f15ff9`. Read `DRIVER_PAIR_14_15_20261015.md`: sheet remount/re-measure on actual trip/phase changes, active/arrival source checks and explicit missing navigation-data limitations. Typecheck and checkpoint suite pass; eight source/native-component frames have no page errors. Continue with 16/17 after publication. Keep actual operating/recovery controls; no false pixel acceptance or APK.

---

# Latest Driver pair — 16/17 (2026-10-15, Oslo)

14/15 is published as `9986a8f`. See `DRIVER_PAIR_16_17_20261015.md`: completion remains guarded; source summary fade/pop, tabular numerals and exact two-decimal breakdown, with unpaid/unknown data guarded. Typecheck and checkpoint suite pass; eight source/native-component frames have no page errors. Continue with 18/19 after publication. No APK or native/pixel certification.

---

# Latest Driver pair — 18/19 (2026-10-15, Oslo)

16/17 is published as `ada674e`. Read `DRIVER_PAIR_18_19_20261015.md`: earnings headline/layout corrections, real weekly data, and the source-shaped Drive Intelligence page with explicit unavailable slots and disabled guidance. Forecast/charging feature contracts remain absent. Typecheck and checkpoint suite pass; eight source/native-component frames have no page errors. Continue with 20/21 after publication. Machine-readable publication status is corrected; do not reuse the historical public-push blocker.

---

# Latest Driver pair — 20/21 (2026-10-15, Oslo)

18/19 is published as `a58ebaa`. See `DRIVER_PAIR_20_21_20261015.md` for source fade/numeric/layout corrections and retained actual income/history behavior. Typecheck and checkpoint suite pass; eight source/native-component frames have no page errors. Continue with 22/23 after publishing; native/pixel acceptance remains open.

---

