# Customer icons, navigation and payment preference

Implementation for QA review, based on `qa/mobile-preflight-maestro-20261105`
at `7712eaaf6e659453257ebdc1a2c789cfe68ee9eb`.

## Behavior

- Customer navigation keeps Home, Trips and Account and the existing router events.
  The Customer dock uses a rounded glass surface, red selected state, calendar
  icon for Trips, and minimum 48 by 58 point tab targets. Driver keeps its dock.
- SNAR and Premium selectors use transparent derivatives of the owner's new
  graphite car renders. The built-in image tool removed the backgrounds from
  the supplied sedan images while retaining their shape, angle, paint and wheels.
  The prompts requested transparent margins, no text or added branding, and
  restrained studio highlights. Original uploads and shared map markers are
  preserved. Assets: `frontend/assets/vehicles/customer-20261111/snar.png` and
  `premium.png`. SUV retains its existing class artwork; a van must not represent
  that class. No new class, seat capacity, student eligibility or fare is invented.
- Selected vehicle art lifts/scales briefly; tab selection fades in. Both respect
  system and in-app reduced-motion settings. Price emphasis still displays the
  exact server quote; the existing quote refresh and booking lock remain in use.
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
- `node --test scripts/customer-payment-preference.test.cjs scripts/customer-dock.test.cjs scripts/cash-payment-ui.test.cjs scripts/payment-screen-native-import.test.cjs scripts/quote-refresh.test.cjs`: 15 PASS.
- `node scripts/vehicle-assets.test.cjs`: PASS for original asset preservation,
  existing API class identity and shared Customer/Driver marker parity.
- New PNG files have real alpha transparency. Dependency versions and lockfile
  are unchanged. `git diff --check`: PASS.
- Expo web export: PASS, including the new bundled vehicle assets. This is a local
  compilation check, not an APK/IPA or evidence of a running app flow. The PNGs
  are downscaled to 512 pixels wide for the 86-point selector and palette-compressed
  with alpha; full-resolution generated originals remain outside the app bundle.
- The optional Expo dependency metadata lookup could not complete because its
  HTTP proxy timed out. TypeScript completed before that lookup. Dependency
  consistency from that network-dependent script is therefore unverified.

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
