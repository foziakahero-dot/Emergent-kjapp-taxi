# SNAR Customer source and build audit — 2026-10-08

## Source selected
Use `fix/customer-search-mapbox-stripe-20261004`. Audited baseline: `b776998f36dff7e3d2df5d02e0fdc854162d7dad`.
All 106 remote branch heads were mapped. They contain 53 distinct Customer trees and 23 distinct Customer Home implementations. The complete mapping is in `SNAR_CUSTOMER_BRANCH_AUDIT_20261008.json`.
The default `main` branch and several admin/fleet/landing release branches still contain the earlier KJAPP Customer Home. They are not a safe substitute for the current SNAR Customer source.

## Verified Expo provenance
Observed in Expo's authenticated Customer build list:
- `117ede80-c644-4b38-9417-f20c843cefae`: succeeded, source `64cc8640b01934d36d8321487e921b8d680e36a9`, APK profile, same selected branch.
- `addf6c38-fc67-4938-8c3a-b1c4be01754f`: succeeded, source `426462346ddf947ad3859ebb02f643524191455e` (review deadlock fix).
- `32d82dd6-da43-4719-84ec-2db67e73e05b`: observed building from `b776998f36dff7e3d2df5d02e0fdc854162d7dad` (nearby car binding fix).
GitHub Actions startup failures did not establish that Expo builds had failed; Expo's GitHub integration also started builds independently.
The screenshot supplied by the user does not establish which APK was installed.

## Corrected defects
1. The review button previously shared the final booking gate. Waiting consent and saved payment were required before the screen offering those controls could open. Review and booking now have separate gates. Booking still requires payment and waiting-policy consent.
2. Home previously emptied the nearby-car prop after destination selection. It now retains server-supplied nearby cars until an active trip exists. The native Mapbox module actually imported by Home is `MapboxMap.native.tsx`; a separate older native map contained destination polling that was not on this import path.
3. The approved vehicle renders were present only in the landing source at `marketing-web/public/assets/snar/*-3d.svg` on `release/snar-landing-production-main-20261005`. Home's VehicleGlyph still delegated to hand-drawn VehicleAsset SVGs. The original embedded WebP bytes have been extracted unchanged, bundled locally, and connected to SNAR, SNAR XL and Premium via the already-installed expo-image package.
4. Ride-sheet minimize/restore was applied only by the install hotfix. It is now folded into Home source and covered by the same regression run. The install hotfix remains idempotent.

## Preserved behavior
Native Mapbox, selected pickup, compact search, active-trip recovery, Stripe TEST safeguards, server-confirmed paid state, backend prices, quoted waiting-policy token/pricing, receipts and API endpoint `https://api.kjappapp.no` remain in place.
No synthetic cars are introduced. The production backend's inspected nearby-car endpoint requires approved/online drivers and a fresh GPS heartbeat. A physical online-driver/Customer integration run is still required to verify real fleet visibility.

## Validation
- TypeScript: PASS on the collected exact Customer sources and existing installed dependencies.
- Rendered Home tests: review reachable before consent; review reachable without saved card; payment setup reachable; final booking blocked until requirements met; one request with quoted policy/price and selected pickup.
- Rendered map binding: real nearby cars retained after destination selection.
- Rendered artwork: all three original assets mapped to the right categories.
- Search collapse, pickup/destination selection, ride-sheet minimize/reopen, active-trip minimize/reopen and home navigation: PASS.
- Stripe TEST regression: live/disabled payments blocked, cancellation handled, successful payment requires server confirmation; payment URL callbacks/listener cleanup: PASS.
These tests use mocked API/Stripe services. They do not claim a new physical payment or online-driver end-to-end pass.

## Read-only production API checks — 2026-10-08 05:43 Oslo
- Health: API and database OK.
- Nearby endpoint around Oslo sentrum: live=true, count=0, freshness window=60 seconds. The UI cannot display real available cars when the server supplies none.
- Public estimate: returned current backend prices and a signed waiting policy for every category.
- Native Stripe config: enabled=true, test_mode=true, publishable key validated as test prefix without logging its value.
No trip or payment was created by these read-only checks.

## Build acceptance
APK profile, Customer project `3631002e-5b25-4847-b5d8-05ec2ef304b5`, Android package `no.kjapp.app`.
Use the commit containing this report and the three assets. Do not label an older successful APK as containing the restored artwork.
