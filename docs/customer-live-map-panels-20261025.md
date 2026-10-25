# Customer: nearby drivers, collapsible panels and local 3D category artwork

Source: v0 `b14a42867cd626a400e2c291f75162e7cbc1b41e` plus the verified SDK
patches at `383195fa546f2bb74bae7e3718c577e45efa3060` used for the Customer APK.
Review branch: `fix/customer-live-map-panels-20261025`.
Continue in the existing project: https://v0.app/snar1/chat/curtin-appen-KtU9llKCkID

## Behavior

- Home shows an availability badge for actual returned drivers. Available driver
  markers carry a green LEDIG label and the returned ETA when present. The
  customer's location is a separate blue position marker, without a live badge.
- Refresh nearby supply every two seconds while the screen/app is active. Filter
  invalid, stale, duplicate, explicitly offline/busy and more-than-5-km positions.
  Timestamp comparisons use the server clock when available. Empty and offline
  responses remove previous supply and never show a positive live count.
- Host timer functions are called through wrappers. The previous object-method
  invocation produced `Illegal invocation` and an empty screen in the exported
  web app; the browser regression exercises the corrected implementation.
- Home, address search, route, vehicle, payment and confirmation panels have a
  visible minimize/restore control and vertical handle gestures. Minimizing only
  changes presentation; typed search, route and selected category remain intact.
  Address search/Home content is capped at 30% of viewport height, with scrolling;
  booking stages use up to 70%. The Home panel sits above the floating tab bar.
- Four category images are bundled PNG assets, with no remote photography or CDN
  fallback. Canonical classes are ai-first (SNAR Standard), enkelt (SNAR Enkelt),
  trygg (SNAR XL), premium (SNAR Premium). Each category requires its own valid
  quote. Comfort is no longer an unsupported placeholder. No new fare class,
  discount entitlement or pricing policy is invented.
- The current nearby-request enum omits enkelt, although quote/request/dispatch
  support it. Retrieve the existing all-class supply and filter by the booked
  class locally. This avoids a 422 without changing the backend contract.

## Verification

Passed:

1. `npx tsc --noEmit`.
2. `node scripts/customer-live-map-panels.cjs` from frontend: actual component
   behavior, tap/drag controls, keyboard dismissal, search/category preservation,
   quote guards, local assets, radius/GPS filters and correct live labeling.
3. `node scripts/car-availability-regression.cjs`: bounded search behavior,
   continuous 2-second updates, removal on empty/offline, pause/resume and framing.
4. `node scripts/map-camera-regression.cjs`: native Mapbox camera adapter checks,
   manual pan/recenter, panel insets, complete route and assigned-car ETA.
5. `npx expo export --platform web --output-dir dist`: successful web/asset bundle.
6. `node scripts/customer-web-ui.cjs`: the exported app at 390x844, 360x640 and
   844x390; Home/search/vehicle controls, retained query and category, four decoded
   3D assets, panel height and tool/status separation; no browser runtime errors.

The browser test needs Playwright available to Node and a compatible Chromium.
Optionally set CHROMIUM_EXECUTABLE_PATH, CUSTOMER_WEB_EXPORT_DIR and
CUSTOMER_SCREENSHOT_DIR. It serves the export on 127.0.0.1:8765, intercepts every
API response and blocks other external requests. All shown driver/price data in
the preview images are synthetic fixtures, not production observations.

The broader historical `scripts/verify-v10-screen-checkpoint.cjs` still stops at
an unchanged Driver login test before its Customer section. The same failure
reproduces with the original script from baseline 383195f. It is not claimed as a
passing full-suite check. Updated Customer assertions remain for the new UI.

## Runtime and release limits

No new APK, IPA, OTA update, production merge or backend deployment is included.
The already installed APK remains unchanged. Real Android GPS, Mapbox rendering,
gestures, background/resume and two-device ride testing still require a native
build/device pass; a web preview and mocked adapters do not prove those behaviors.

Render kjapp-beta-api is live at 18fc05c. The cars_nearby, reverse_geocode_endpoint,
reverse_geocode and search_places functions are identical to the v0 baseline.
Thus a missing deployment of those map endpoints does not explain these UI
issues. The integration is not a byte-for-byte copy of every v0 backend change:
the fleet shift-report endpoint is absent in the deployed source, independently
of the Customer map work. No blind redeploy of the divergent v0 branch is needed.

Internal test drivers and ordinary test customers can belong to separate supply
allowlists. These changes preserve those controls. Real map visibility still
requires an eligible online driver, fresh GPS and the correct account pairing.

Business target remains 12% service fee plus surge; no payment settings changed.
ChatGPT usage is enabled in v0; the zero v0 balance still blocks its platform fee.

## Original image provenance

Copied unchanged from the user's four 25 October 3D images:

| Asset | Original file | SHA-256 |
|---|---|---|
| standard-3d.png | image-gen-1(20261025-170406).png | 9ebead79acc294faaba1e37614373046466de8ef43abf8f3ae1bb7d90e9992bd |
| enkelt-3d.png | image-gen-2(20261025-170408).png | 46d442448d7e58e709b8e3657cab39101a0e9baaf3886baf4c3f935ffd8a9e1d |
| premium-3d.png | image-gen-3(20261025-170411).png | 1f0cb158d01c04fe63642eee56e5c47ee53a21ce962a36c22740aba24fc43639 |
| xl-3d.png | image-gen-4(20261025-170414).png | 0cf61ae4cd68d9ea0119fe8e8b508bc4fd48d39672452ebba9bc52611ce4a8fc |
