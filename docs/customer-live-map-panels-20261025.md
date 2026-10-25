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

Business target remains 12% service fee plus surge. A separate backend release makes that rate explicit for new trip snapshots; historical trips retain their recorded rate.
ChatGPT usage is enabled in v0; the zero v0 balance still blocks its platform fee.

## Illustrated icon replacement and payments (25 October)

The category selector now uses four new, original illustrated clay icons generated
here with the imagegen tool, rather than realistic car renders or remote images.
Bundled files: `frontend/assets/vehicles/{standard,enkelt,xl,premium}-illustrated.png`.
Prompt: one obviously illustrated, rounded premium toy/clay car, front three-quarter
view facing left, full car centred on transparent alpha; simplified wheels and navy
windows, matte white/navy #0B1A2C/red #FF0000; no real brand, photo, scene, text,
logo, plate, watermark or chrome. Variants: white standard hatchback/red accent,
red small city car/white roof, white XL SUV/navy roof, navy premium sedan/red trim.
The older `*-3d.png` files are retained in repository history but no longer imported
by the selector. `contentFit="contain"` preserves the whole illustrated silhouette.

Quotes refresh sequentially every 30 seconds while the app and screen are active;
active bookings are excluded. Failed refresh preserves the displayed price but
blocks confirmation. Quotes older than 60 seconds cannot be booked. Route/account
changes invalidate pending replies. Only actual price changes show "Pris oppdatert"
and a short opacity transition; reduced motion keeps the textual announcement.
The server still validates the quote/policy/version at booking and may require
confirmation of a changed quote. Empty supply and network failures have distinct
messages in the vehicle selector, including "Ingen biler tilgjengelig".

Native Apple Pay/Google Pay use Stripe confirmPlatformPaySetupIntent; no new
parallel trip-charge flow. SDK success must be independently verified by the
server before selecting the verified wallet card as the standard reservation
instrument. Cancellation is neutral, duplicate actions share a lock, stale account
operations do not update the UI, and wallet support/configuration are checked.
Web keeps the hosted card flow. The new default-card endpoint is released in the
separate backend candidate based on the deployed 18fc05c source.

Validation: frontend TypeScript; nearby-driver/panel/camera/scheduler tests; actual
React screen suite (stale SMS-first Driver test adapter corrected); native wallet
adapter tests for support, duplicates, cancellation, verification and mode/merchant
gates; exported web at 390x844, 360x640 and 844x390 including actual automatic price
change, empty/offline supply, restored panels and decoded bundled icons. All web
API data are local fixtures; native SDK acceptance on physical devices is pending.

Observed backend native config: Google Pay enabled in Stripe test mode; Apple
merchant ID absent. Apple password accepted via secure browser authentication,
but two-factor verification remains incomplete. No merchant identifier was invented,
no certificate/entitlement was claimed ready, and Stripe live mode remains disabled.
Beta approval still requires real two-device customer/driver and wallet acceptance,
paired test accounts, and resolved release blockers. Earlier APK links do not
contain these changes; use only the build linked to the final candidate commit.
