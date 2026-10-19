# Controlled QA progress

## Phase 0 — completed

Baseline source `e9f3069`; report and isolated test-fixture fix checkpoint `cdc61b8`. See `CONTROLLED_QA_BASELINE_20261019.md`. Focused backend suite after fixture fix: 89 passed. Customer/Driver TypeScript and Admin/Fleet compilation pass. Driver online dependency verification remains unresolved after a proxy timeout; offline check is not equivalent evidence.

## Phase 1 — partial, waiting for fourth asset

Imported the three original 1254×1254 transparent PNGs without changing any pixels. SHA-256 provenance and dimensions are recorded in the asset manifest. New central resource configuration maps existing API IDs to Economy hatchback, Premium sedan, SUV and the existing separate XL graphic. No backend IDs, prices or seat capacities changed.

Validation: `node scripts/vehicle-assets.test.cjs`, Customer TypeScript, `git diff --check`. Three source PNGs are available. The fourth PNG containing the red live-status indicator is not attached. `map-live.png` is therefore not fabricated or falsely marked imported.

Phase 1 checkpoint: `3824c55`. The missing fourth asset does not prevent category-selector implementation; it remains an explicit gate for the supplied live-map artwork.

## Phase 2 — implemented and checked locally

The main booking selector, assistant and legacy vehicle glyph now resolve images through the central asset registry. Economy (`ai-first`/`enkelt`) uses the hatchback, Premium the sedan, SUV the SUV; seven-seat `trygg` retains its distinct XL image. Main booking labels Economy as Økonomi. No API IDs, prices, seats, ETA calculation or booking requests changed.

Category images use a clipped transparent 84×56 dp container, `contentFit="contain"` and Expo Image downscaling. Existing subtle navy selection and accessibility selection state are retained. Unknown glyph types no longer silently display an Economy car. No map visuals changed in phase 2.

Checks: supplied asset integrity test, Customer TypeScript, existing component-behaviour screen suite (extended to assert original image paths, contain scaling, bounded dimensions, selection state and distinct XL), diff whitespace check. React review: static asset imports, shared renderer, no new effects/network calls. These are local checks, not physical-device visual verification or native compilation.

Phase 2 checkpoint: `281a690`.

## Phase 3 — marker audit, new PNG artwork blocked

The existing Figma-derived SVG car is already 50 dp, separate from the customer position dot, with centre rotation and interpolated GPS movement. No full-resolution PNG is loaded as a map texture. Corrected the native available-marker anchor to the actual car centre (22 dp ETA badge + 25 dp half car), instead of two dp below it. Assigned-driver anchor is already at its actual car centre. Category PNGs are not reused as an invented marker.

Customer TypeScript and whitespace checks pass. Native Mapbox rendering, camera-relative rotation and real-device smoothness remain unverified. The supplied fourth map PNG is missing: phase 3 cannot be certified against that source. Existing SVG remains until the actual marker asset is supplied.

Phase 3 checkpoint: `51cce9d`.

## Phase 4 — real supply path checked locally, recovery bugs fixed

Audited Driver authenticated location upload (1 s requested GPS interval with original device timestamp), backend freshness/session/approval/fleet/vehicle/busy/radius checks, authenticated customer Socket.IO and REST fallback. Backend queries actual users/vehicles and excludes demo accounts. Existing backend live-car tests use isolated Mongo and real ASGI HTTP/WebSocket transport: 33 passed. This does not prove the entire deployed phone-to-phone path.

Fixed Customer REST fallback: expire markers every 200 ms while HTTP hangs; cap freshness at the same 2 s live window; remove cars beyond the current customer radius/category and exclude own ID. A late REST response cannot overwrite the resumed socket snapshot. No dummy cars added, no backend eligibility rules changed.

Regression test loads the real availability hook and feed with isolated adapters. It fails on baseline code (stale marker remains after expiry), passes after correction, and covers stalled HTTP, customer movement, own/offline/busy cars, category and late REST/socket ownership. Customer TypeScript passes. Real-device background GPS continuity and deployed end-to-end location verification remain open.

Phase 4 checkpoint: `0503a80`.

## Phase 5 — marker states implemented, local tests pass

Available marker retains original SVG; selected marker now has a subtle navy outline with accessible selection state on native and both raster maps. Assigned marker keeps its distinct red halo and its canonical API vehicle type. Corrected the same 2 dp centre offset in raster overlays. No second red location dot is added to cars.

Home and booking now share an assigned-vehicle hook that hides GPS older than the existing 30 s assigned-trip freshness window even when HTTP stalls. New GPS restores the same assigned identity; cancelled/completed trips do not produce live cars. This does not cancel the trip or change ownership. Nearby supply now returns first name and omits pre-assignment number plate; trip-specific driver details remain unchanged.

Tests: actual hook autonomous expiry/recovery/terminal-state removal; SVG 50 dp and selection/assignment precedence; Customer screen and Figma behaviour suites; Customer TypeScript; 33 backend nearby eligibility/privacy/HTTP/WebSocket tests. Device rendering, new fourth-marker source and deployed QA verification remain open. Camera-relative native rotation is not yet verified.

Phases 6–12 remain open. No APK/IPA/Expo/EAS build was started.

Recommendation: **NOT READY FOR BUILD**. This is a progress checkpoint, not the final phase 12 report.
