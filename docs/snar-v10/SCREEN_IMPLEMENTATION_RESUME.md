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

## Continue next

1. Continue Driver vehicle, activity/trip-detail and earnings/detail screens from the original archive. Preserve paid-only financial values and offline/error states.
2. Continue Customer profile, messages, activity, payment methods and account views; preserve account linking, privacy, support, booking and trip recovery.
3. Continue Customer and Driver screens in original source order. Record each route/state as implemented, partially implemented, blocked by a specific contract, or not reviewed. Do not count a placeholder, an empty state, a route name or a component count as a completed design screen.
4. Render the new map/permission, messages, documents, fleet and navigation screens with loading/error/real-data states. Run meaningful interaction tests and compare typography, insets, shapes, colors and motion.
5. Finish native visual checks and the existing QA build/device gates before requesting a combined Customer + Driver build. Keep existing QA-only build profiles and deployment safeguards. No new APK, OTA, store release, production deployment or main merge has occurred in this implementation task.

Read `PHASE5_RESUME_CHECKPOINT_2026-10-12.md` for the earlier infrastructure/Stripe/build state. Those historical checks do not certify new screen changes. This checkpoint does not repeat, invalidate or claim completion of the separate blocked mobile build/device work.
