# KJAPP — Product Requirements (living doc)

## Original problem statement
Import the existing "KJAPP" app from the connected GitHub repo (`foziakahero-dot/Emergent-kjapp-taxi`) and continue building the **mobile app**. User decision: **port the app to Expo React Native** (to enable Emergent Publish → App Store / Play Store), get it running in the preview, and fix issues. Scope: the whole app. Language: Norwegian.

## Architecture
- **Backend (reused, unchanged):** FastAPI + MongoDB (`/app/backend/server.py`, ~120 endpoints). Auth (JWT + 2FA), trips, dispatch, drivers, fleets, payments (Stripe), places/geocoding (MapTiler/Photon/Nominatim), OSRM routing, push, admin/superadmin. Demo data seeds when `ENABLE_DEMO_DATA=true`.
- **Frontend (new):** Expo Router app (SDK 57, React 19, RN 0.86) in `/app/frontend`. Reuses backend via `EXPO_PUBLIC_BACKEND_URL`. Dark "Nordic Precision / Understated Luxury" theme in `src/theme.ts` (granite + brass + ivory; driver mint HUD accent). Custom SVG icon set + stylised SVG map canvas (works on web preview, Expo Go, native).
- **Out of scope for mobile:** admin / fleet / superadmin dashboards remain the existing **web portal** (admin.kjappapp.no). The original React/Capacitor web app is preserved in `/app/_legacy_web/`.

## Personas
- **Passenger (customer):** books rides, tracks driver, pays, rates.
- **Driver:** goes online, receives/accepts ride offers, runs the trip lifecycle, sees earnings.

## Implemented (2026-06)
- Onboarding/splash with brand mark; role-aware redirect.
- Customer auth: login (`ola@kjapp.no`), register; driver login (`sjafor@kjapp.no`).
- Customer home: live location (graceful fallback + permission handling), nearby cars polling, greeting, quick places, destination search (debounced backend geocoding), route review with 4 vehicle tiers + real OSRM distance/price, booking creation.
- Trip tracking: 2.5s polling, status lifecycle, driver card, live car on map, call/message/safety, cancel.
- Receipt screen with 1–5 star rating.
- Trip history, Profile, Payment methods (list/add/remove), Settings (toggles).
- Driver app: online toggle + live GPS streaming, today summary, ride offers (accept/decline), active-trip lifecycle controls, earnings tab, profile.
- Full E2E tested (13 flows PASS) on the Expo web preview.

## Known limitations
- Browser preview denies geolocation → driver "go online" needs a device/Expo Go build; customer app falls back to Oslo centre.
- Map is a stylised SVG canvas (not tiled vector map) — reliable everywhere; real tiled maps are a future enhancement.
- Cosmetic: RN-Web `shadow*` deprecation warning (non-blocking).

## Backlog (prioritised)
- **P1:** Real tiled map (react-native-maps native + web fallback) with 3D route styling.
- **P1:** In-trip chat (backend `/trips/{id}/messages` exists).
- **P1:** Brand fonts (Fraunces / Inter Tight / JetBrains Mono) via expo-font.
- **P2:** Google/Apple social login, 2FA UI, forgot/reset password screens.
- **P2:** Stripe card setup + Vipps; scheduled rides; saved places management.
- **P2:** Push notifications (Emergent-managed) — build-only feature.
