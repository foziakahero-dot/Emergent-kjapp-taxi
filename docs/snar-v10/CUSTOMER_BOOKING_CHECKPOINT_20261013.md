# SNAR 10 Customer booking continuation — 2026-10-13

Source: the user-provided SNAR_V10_VSCode_Package, reference/snar-v10-design/src/CustomerApp.tsx, kit.tsx and index.css. This implements the new Figma SNAR 10 design. It does not reuse the older prototype.

Base GitHub checkpoint: 8dd83f440f9fc92e52cf2c67a3b644ac3da5d003 on implementation/snar-v10-screens-20261013. Existing shared-workspace checkpoint is 00e823d, a local snapshot with a different commit history. Only the files listed in this checkpoint are staged and pushed.

## Concurrent activity

The prior session continued writing after its visible connection interruption. New edits were observed in DriverCockpitView.tsx, Customer booking/[tripId].tsx, V10UI.tsx and api.ts, including pickup_waiting_inside support and a V10Sheet primitive. Those changes are preserved and excluded from this checkpoint. This continuation implements Customer Home/search/route/vehicle/payment/confirmation only; active trip and post-trip migration remains with the other session. Verify the branch head and preserve concurrent changes before every further commit.

## Changes

- Home has the source's warm map-backed sheet, 60px destination field, saved-place chips, compact identity and 48px map actions. Only actual saved/recent places are shown; prototype names, arrivals and notifications are not invented.
- The real address-search controller retains debouncing, stale-response protection, clear, error/retry, empty and unmount handling. Its new source layout provides separate pickup/destination fields and the native keyboard, not a simulated keyboard.
- Separate route preview, vehicle, payment and confirmation states replace the previous combined selection page. Back/edit actions retain the actual pickup and destination. Route camera now frames the route rather than nearby cars after destination selection.
- Vehicle prices are the actual estimate options. ETA comes from actual available cars for the selected category. Source sample passenger capacities, vehicle-specific ETA and popular-category badges are omitted when not supplied.
- Payment display mirrors the backend reservation service: verified Stripe instrument with succeeded setup, default first, newest otherwise. Failed card refresh cannot keep a stale card. API responses without confirmed instruments cannot enable booking.
- Existing quote tokens/version/price, explicit waiting-policy consent, card reservation, synchronous booking lock, active-trip check, quote-change recovery and lost-response reconciliation are retained. No new backend behavior is introduced.
- Home hides the dock during booking/search; after-trip receipts and existing active-trip recovery remain on their original routes.

## Meaningful verification

- Both TypeScript checks pass on a clean local checkpoint with only this continuation's files.
- verify-figma-mobile.cjs passes its existing behavior suite, including search races, cancellation, GPS freshness and safety.
- verify-v10-screen-checkpoint.cjs exercises actual CustomerHome through saved destination -> route -> vehicle -> payment -> confirmation -> waiting consent -> request. It checks canonical card display, double-submit serialization, quote payload/version/token, route camera and suppression of a new booking while a trip is active.
- Five implementation states and the corresponding original source frames were rendered at 370x824 in Chromium through React Native Web and visually reviewed. The fixture has no live map or payment provider; it tests layout, not native pixel parity or a real ride.

## Remaining limitations

- Customer screen 10 remains partial: backend has no per-booking card-choice contract; the sheet shows the actual reservation card and links to management. Apple Pay, Google Pay, Vipps and company invoice rows are not fabricated from the Figma sample.
- Native map imagery/blur, keyboard/device safe areas, route-draw/sheet-transition polish, source photos and full Android/iOS pixel certification remain outstanding.
- Scheduling, flights, notification inbox and unsupported source data are not simulated as functional features. No APK/IPA, deployment, OTA, production update or main merge is performed by this checkpoint.

Next: reconcile this checkpoint with the active session's trip/post-trip changes, then finish remaining supported account states and native QA/build gates.
