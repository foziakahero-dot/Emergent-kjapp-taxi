# SNAR Fleet v2 design-port checkpoint — 18 October 2026

Request: owner explicitly instructed implementing `Limte inn markdown(4).md` (SHA256 `44b53e6e4e4f88a51f1acb691396015beefa5aab10ee32222de964b50b5f3b2c`). Base QA commit: `a967f110098859ab227867f5bac3c6031cf2fc56`.

## Source and scope

The approved available reference is the owner-provided `SNAR Fleet v2 Design System (3)(1).zip`, archive SHA256 `5bb43ac60579f335ba72c562cde7b62bc8b74bf6ce6586c82a0f3837f9e2dabd`. Exact read-only CustomerApp, DriverApp, kit, ExperienceStudio, VehicleAssets and CSS are now retained under `reference/snar10/`, with source hashes and image provenance. The Make connector returned the expected source-resource names, but current file contents could not be read, and the cloud browser could not open the Make site. The available export is not certified as identical to a newer saved Make revision.

The request's example code is not copied blindly: its em tracking numbers were not native point values; its Dock referenced an unimported `shadows`; it hardcoded light mode, omitted the Android target, and did not preserve every existing navigation/payment state. The actual source governs dimensions, colors and component structure. No four-tab design is introduced.

## Implemented

- Both independently packaged Expo apps have matching `src/theme/snar10.ts`: source light/dark palettes, full map palette, typography with em-to-point tracking conversion, spacing, radii, source shadow strings, motion durations/curves, dock, sheet and toggle geometry. Existing theme persistence, accessibility, high contrast and system-mode subscriptions remain in place and read these tokens.
- Both apps expose `src/components/snar10/`: Dock, Glass, Sheet/SheetFrame/SheetHandle, Button, Input, Toggle, Avatar, Chip, Island, Icon, Text, Badge, TopBar, StateView and ExperienceStudio. Existing verified SVG paths, user-photo retrieval and studio save logic are retained; compatible existing V10 names delegate to the kit. Customer VehicleMarker exposes the existing native source SVG/GPS adapter.
- Actual customer and driver navigators render the same Dock component, retaining separate existing route tables, preventDefault events, long presses, selection accessibility, five source destinations and inverse AI contrast. Selected dot includes the AI tile as in the source CSS. Missing unread data does not generate a fake unread dot.
- Glass now owns exactly one blur followed by one source tint. Removed extra tint under the customer dock/tools and unified Driver's layer order. Every registered tab scene fills the canvas with the theme background. Global customer detail pages now have a real registered BlurTargetView; removed the extra blank 112-point scene margin. Unsupported/missing native blur retains the source tint; no Android native rendering claim follows from a mocked component test.
- Customer home opens the source home sheet/Reisestudio instead of defaulting to map-only mode. Its handle minimizes explicitly. The source header remains unobscured by the previous extra top-right collapse control.
- Search now uses a source-shaped full sheet, top inset/radius, 55% theme-background map veil, two separate pickup/destination rows, native keyboard accommodation, real quick places/results, original row geometry and explicit minimize handle. The debounced API search, stale-response rejection, manual pickup, coordinate validation, retry, voice entry and draft-preserving close behavior remain.
- Home, route, vehicle/payment/review, active-trip and safety sheets use the canonical sheet frame/handle; Driver cockpit sheets use it as well. Existing account, history, receipt, rating, support and Driver screen adapters inherit shared typography/buttons/fields/theme without rewriting their controllers.
- Fixed a real minimization regression: GlobalCustomerShell previously redirected every searching/booking REST result back to the booking route, undoing a customer's explicit minimize. It now leaves the view closed and reopens the same owned trip only from explicit Island interaction. Completion removes the Island. Island position uses the same dock safe-area calculation.
- Customer accessibility switches now use the source green 50x30 switch, 24-point thumb and 210ms transition, matching Driver. The source red accept action remains red.
- Reisestudio launch geometry now uses source signature.css height 34, radius 8 and label size 12, with expanded hitSlop. Existing reduced-motion and 210/280/320ms native animation adapters share the canonical motion tokens.
- Standard and Premium category slots use local JPEGs downloaded from their exact original CustomerApp CARS URLs. Nonempty files, JPEG format and 900x600 dimensions validated; hashes/URLs recorded in source-contract.json. The 84x50 source slot uses cover, white background and original radius. Backend category IDs/prices/seats are retained; the Standard display label does not create a new service.

All 36 original customer entries and 30 Driver entries (numbered 01–31, with 08–09 combined) still have their existing native paths. This is reuse and integration of existing screen adapters, not a claim that 66 layouts were newly redrawn or visually approved.

## Checks

- Customer and Driver local TypeScript `tsc --noEmit`.
- `node scripts/verify-snar10-kit.cjs`: actual both five-tab adapters, navigation cancellation, focus target mounting, one tint, light/dark AI contrast, no fabricated unread indicator, sheet/button guards; actual global minimized search and explicit owned-trip reopen/completion. Also checks the existing 66-entry adapter inventory.
- `node scripts/verify-figma-mobile.cjs`: actual theme/accessibility persistence and state retention, minimize/reopen, cancellation reconciliation, GPS freshness, safety, search race/error handling, messages/support, font inheritance, motion, Driver alerts/earnings and address identity.
- `node scripts/verify-v10-screen-checkpoint.cjs`: actual source-shaped screens/controllers, auth locks and role gates, home/search/quote/payment/booking, Driver offer/start/completion, history/receipt/rating, messaging and settings.
- `node frontend/scripts/car-availability-regression.cjs`: live supply requests, expiry, clocks, GPS validity, background/resume and map bounds.
- `node frontend/scripts/native-wallet-regression.cjs`: supported platform, explicit Apple flag, native SDK cancellation/error, verified saved wallet and server-confirmed settlement. Updated its stale fixture to the current upstream SDK/config contract; no runtime Stripe policy changed.
- `git diff --check`; downloaded source asset integrity/format checks.

The pre-change broad suites were already stale: missing socket-hook/query-cache/window/keyboard mocks and a Google-action assertion from before Driver Google was added. Test adapters were updated without deleting the behavioral cases. Core UI now renders through wrapper components, so host-node assertions avoid counting both a React component and its native host as two visual controls.

## Verification limits and next acceptance

No APK, iOS, TestFlight, store or OTA build is authorized or started. No main merge, production data/configuration, backend provider configuration, fare, dispatch, commission, payment webhook or API logic was changed in this design task. The existing native map, live-car feed, account-scoped APIs, FCM, social auth and Stripe controllers are preserved, not newly certified against QA.

Native pixel parity remains OPEN: no same-viewport Android/iOS captures are available in this session. A temporary local web preview was attempted but could not be reached from the browser; Expo's DevTools also failed to launch in this root environment. The temporary preview was stopped. These limitations do not validate or invalidate Android blur itself.

The source's variable weights 450/550 are mapped to available static Geist files; CSS blur/saturation cannot be declared numerically identical to Expo blur. Source map colors affect app palettes, but the existing real Mapbox base map is retained. Backend-only SUV/other extra classes retain existing truthful assets and contracts; unsupported Comfort stays unavailable rather than being falsely mapped to SUV. Scheduling, provider-backed replies/payments/identity and other absent contracts remain explicit unavailable states.

The attached document refers to “28 audit discrepancies” but contains no numbered list of 28 findings; this checkpoint does not invent or claim completion of that missing list. Next: inspect a later expressly authorized device build from this exact committed source, compare all mapped screens/light/dark states to the preserved original, verify native blur/keyboard/safe area and full ride recovery. Build authorization still requires the owner's final approval after that report.
