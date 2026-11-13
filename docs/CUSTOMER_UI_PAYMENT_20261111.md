# Customer icons, navigation and payment preference

Implementation for QA review, based on `qa/mobile-preflight-maestro-20261105`
at `7712eaaf6e659453257ebdc1a2c789cfe68ee9eb`.

## Behavior

- Customer navigation keeps Home, Trips and Account and the existing router events.
  The Customer dock uses a rounded glass surface, red selected state, calendar
  icon for Trips, and minimum 48 by 58 point tab targets. Driver keeps its dock.
- All four supplied vehicle renders are now used: graphite sedan → SNAR (`ai-first`, legacy `enkelt`), executive sedan → Premium (`premium`), green electric crossover → SUV (`suv`), passenger van → SNAR XL (`trygg`). The XL row is now visible and only selectable with its own valid backend quote. Missing/invalid prices never borrow another category's fare. Comfort/student fare contracts are not invented.
- The built-in image tool extracted the remaining crossover and van on transparent alpha, preserving vehicle geometry, camera angle, color, wheels and highlights. The background-extraction prompt required removal of the full background including the van's baked checkerboard, small safe margins, no added objects/text/branding and legibility on light/dark surfaces. The 512-pixel PNGs are bundled at `frontend/assets/vehicles/customer-20261111/{snar,premium,suv,xl}.png`; original uploads and shared map markers are preserved.
- Selection uses native-driver opacity for the highlighted row and a 260ms lift/slide/scale for every car. Rapid selection cancels prior motion. Reduced-motion settings disable transitions. Price emphasis slides/scales/fades the new exact quote briefly; it never counts through fictional prices or animates when the value stays unchanged.
- Foreground quotes refresh sequentially 30 seconds after each completed request, and immediately on return to the foreground (after any older in-flight request finishes). Route/stops/pickup changes start a new estimate. Background/resume generations discard both old responses and old failures. Prices expire after 45 seconds, block booking and vehicle selection while stale, retry after failures and never refresh over an in-flight booking.
- A changed selected price, pricing version or waiting terms exits confirmation and requires review again. Rotating signed tokens with unchanged financial terms do not interrupt confirmation. A server `quote_changed` response also returns to vehicle selection. Server tariffs, area/time/weekend rules and multipliers remain authoritative; this PR changes neither rates nor pricing policy and introduces no random price changes.
- Account > Payment methods now includes preferred Card/digital wallet or Cash.
  The preference is stored per account on the current device, not synchronized
  through the backend. The screen explains this. It stores no card credentials.
- Cash is selectable only after the existing config endpoint confirms
  `cash_enabled=true`. It does not require a verified card. Selecting a preference
  performs no Stripe action, reservation, charge or cash confirmation.
- Home uses the saved preference for the next booking. A deliberate per-trip
  choice wins over late preference loading. Overrides reset when a trip is
  accepted or the route is abandoned. Account changes cannot reuse the other
  account's preference. A saved unavailable cash preference blocks confirmation
  and asks the customer to choose; it never silently switches to charging a card.
- Existing saved-card selection and wallet selection also set the device's
  preferred method to Card. Adding a normal card alone does not replace Cash.

## Verified locally

- `cd frontend && npx tsc --noEmit`: PASS.
- `node --test scripts/customer-payment-preference.test.cjs scripts/customer-dock.test.cjs scripts/cash-payment-ui.test.cjs scripts/payment-screen-native-import.test.cjs scripts/quote-refresh.test.cjs scripts/customer-vehicle-motion.test.cjs`: 23 PASS.
- `node scripts/vehicle-assets.test.cjs`: PASS for original asset preservation,
  existing API class identity and shared Customer/Driver marker parity.
- New PNG files have real alpha transparency. Dependency versions and lockfile
  are unchanged. `git diff --check`: PASS.
- Expo web export: PASS, including all four bundled vehicle assets (1772 modules). This is a local
  compilation check, not an APK/IPA or evidence of a running app flow. The PNGs
  are downscaled to 512 pixels wide for the 86-point selector and palette-compressed
  with alpha; full-resolution generated originals remain outside the app bundle.
- The earlier optional Expo dependency metadata lookup could not complete because its
  HTTP proxy timed out. TypeScript completed before that lookup. Dependency
  consistency from that network-dependent script is therefore unverified.

- Read-only live QA estimate on 13 November returned HTTP 200, pricing_version=1, with valid prices for all four displayed API classes. Example synthetic Oslo route: SNAR 254 NOK, Premium 429 NOK, SUV 335 NOK and SNAR XL 335 NOK. These are one route/time's observations, not hardcoded fares; SUV/XL currently share the server's roomy-vehicle rate unless separately configured. No request/booking/payment was created by the estimate check.
- New selector/regression cases verify each category's exact price, missing XL support, automatic displayed price replacement, stale selection blocking, foreground races, expiry and motion cancellation/reduced motion. These are local component/logic tests, not device animation performance or full E2E.

## Remaining verification

Visual browser/device acceptance is unverified. Local headless Chromium failed
to create its process singleton socket (`Operation not permitted`); the shared
browser could not reach the local Metro address (`ERR_CONNECTION_REFUSED`).
These are test-environment limitations, not passing visual checks.

Before the next approved Customer build, check on Android and iOS at 320–430 point
widths: light/dark theme, larger text, bottom safe area, tab switching, selection
animation and reduced motion. Confirm the graphite images remain legible and
unclipped. In QA, choose cash under Account, restart, confirm the booking review
shows Cash, explicitly override with a verified card, and confirm the next trip
returns to the profile preference. Repeat with cash disabled and a failed config
request. Cash completion/receipt and full Fleet/Admin/Driver/Customer E2E remain
separate runtime acceptance tests.

No APK/IPA, OTA, TestFlight upload, backend deployment, database write, live
payment or production promotion is part of this change.
