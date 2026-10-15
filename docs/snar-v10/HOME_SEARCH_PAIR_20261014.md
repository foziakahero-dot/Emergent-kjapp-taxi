# Pair 2 — Customer home/live cars and destination search, 2026-10-14

Parent: 20892fd828d6307513530db001a761ea1264ccd3. Source states: CustomerApp.tsx returning/home (02/06), search (07), kit.tsx VehicleMarker, index.css. This pair addresses the user's repeated search/no-car home presentation and maps showing only Customer location.

## Behavior and layout

Home now quietly refreshes actual supply every eight seconds while focused/foregrounded. Its compact caption reports the current count or an honest empty/offline state. It never displays dispatch-attempt numbers, countdown or repeated "searching" text while browsing. A real booked trip retains canonical persisted search progress; no booking/payment side effects are added. Polling pauses in background and is disposed when the route loses focus; one request runs at a time.

Native Mapbox already included pickup and live supply in its fit bounds. The web-specific Map export still used the older TileMap whose focus excluded available cars. Web now uses the shared InteractiveMap, including actual cars, heading and measured panel insets. "Min posisjon" explicitly resets manual camera mode; live GPS updates otherwise preserve manual panning. The home screen shows the original two right-side tools instead of duplicated native map controls. Active-trip map controls remain reachable.

Customer native and fallback maps now use the actual V10 VehicleMarker geometry: contact shadow, original gradient/body/glass/roof/headlamp/taillamp shapes. Marker coordinates and heading come from API data, never the source's simulated fleet. Native and fallback supply interpolates actual GPS fixes over the source's 1.8s linear duration; reduced motion snaps to the real fix. Assigned markers remain visually distinct. Map source/projection/provider imagery remains real geography, not the prototype's simulated map.

Home adds the source notification action and rounded-square avatar styling. Destination search follows the source's two 48px address rows, sheet handle, 30px sheet corners, saved-place chips and 56px result rows. It keeps actual address search, stale-response protection, manual pickup, clear/retry/close, real OS keyboard and voice route. Search dims the map while open. No mock suggested destinations, fake keyboard or invented journey metrics are introduced.

## Evidence

- Customer TypeScript passes.
- Extended actual-screen checkpoint tests cover quiet home status during initial/empty/live refresh and canonical progress during a real booking; existing booking/payment/controller regressions pass.
- Native Mapbox camera test passes actual pickup/cars bounds, measured card resizing, manual pan retention, explicit recenter recovery and single-point padding.
- Availability/map geometry tests pass bounded booking-style three-attempt behavior, one in-flight request, background pause, new online supply, invalid GPS rejection, actual focus points and compact/tall/landscape panel exclusion.
- Six React Native Web frames cover home with fixture supply, home empty and destination search in both themes; no page errors and geocoder fixture result renders. Fixture cars are test-only and not committed application data. External map tiles did not load in this capture environment; the captures validate layout/marker framing, not provider cartography or complete pixel parity.
- Live QA POST /api/cars/nearby returned 200 with cars=[], count=0, live/gps-freshness metadata. No qualified live driver at that test point was shown; no false car was added to make the map look populated. QA health/readiness and production health returned 200 earlier in this turn.

Physical GPS, heading, keyboard and camera checks on Android/iOS and cold-start provider maps remain pending. Existing APKs do not include this pair. Backend/API URLs, dispatch, payment and approval rules are unchanged. Next pair: Customer introduction and location permission.
