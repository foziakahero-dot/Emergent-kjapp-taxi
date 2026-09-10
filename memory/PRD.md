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

## Update (2026-06) — Next-action features + security
- **Real map:** `react-native-maps` (dark-styled) on native via `src/components/Map.tsx`; web preview uses the SVG `MapCanvas` fallback (`Map.web.tsx`). Wired into home, trip tracking and driver active-trip.
- **In-trip chat:** `src/components/ChatSheet.tsx` (polls `/trips/{id}/messages`), opened from the customer "Melding" action and the driver active-trip "Melding til kunde" button.
- **Brand fonts:** Fraunces (display) + JetBrains Mono (numbers) loaded via `expo-font` (assets/fonts), gated in root layout.
- **Payment selection + Vipps:** booking shows a payment row (`booking-payment-row`); payment-methods screen supports Vipps + a real Stripe card verification button (`/payments/card/setup` via expo-web-browser).
- **GDPR:** Settings → "Personvern og data": data export (`/gdpr/export`) + permanent account deletion with typed "SLETT" confirmation (`/gdpr/delete`) → logout.
- **Security audit fixes (verified):**
  - SEC-001 password-reset link no longer built from attacker Origin header — uses server-side `FRONTEND_URL` allowlist (`server.py` forgot_password).
  - SEC-002 booking payment-gate bypass closed — manually-added cards stored `verified=false` (only Stripe-verified cards / Vipps count). Verified via curl: fake card → 402, Vipps/verified → 200, demo user still books.
  - SEC-003 GDPR erasure now blocks privileged roles (admin/superadmin/fleet_owner); regular users + drivers retain erasure rights.

## Update (2026-06) — Saved places
- **Personal saved places:** new per-user `user_places` collection + CRUD API (`GET/POST/PUT/DELETE /api/me/places`, scoped to the authenticated user). Frontend screen `app/saved-places.tsx` (search address → label as Hjem/Jobb/Annet → save/delete). Home shows the user's saved places as one-tap quick chips (falls back to global featured when empty) plus a dashed "Legg til/Rediger" chip; also linked from Profile ("Lagrede steder"). Verified via curl (CRUD) and full UI flow screenshot.

## Update (2026-06) — Live driver tracking + car icon
- **Car icon:** map markers are now a top-down car glyph (`src/components/CarMarker.tsx`: body + lighter roof + soft drop-shadow for a 3D read) instead of plain dots. Nearby cars use a graphite preset, the active driver a brass preset. Used in both the native map (`Map.tsx`) and the SVG fallback (`MapCanvas.tsx`).
- **Smooth movement:** `src/components/useSmoothPosition.ts` tweens the active driver marker toward each polled coordinate (~2.2s easeInOut via requestAnimationFrame) and derives heading from travel direction, so the car glides + rotates instead of teleporting. Trip screen polls `/trips/{id}` every 2.5s; driver streams position via `/driver/location`.
- Verified end-to-end via a scripted live scenario (driver online → accept → move): the customer trip screen renders the brass car glyph at the live driver position.


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

## Update (2026-06) — App icons / store assets
- Branded icon set generated (granite bg + brass Fraunces "K" in a ring) via /app/gen_icons.py:
  - `icon.png` 1024 opaque (App Store / iOS / general), `adaptive-icon.png` + `android-icon-foreground/background/monochrome` (Google Play adaptive + Android 13 themed), `splash-icon.png` (transparent, dark splash bg), `favicon.png` (web). app.json wired incl. monochromeImage.
  - Expo/EAS auto-derives every required resolution from these sources at build time.
  - Remaining store-listing graphics (screenshots, Play feature graphic 1024x500) are separate marketing assets, generated on request.

## Update (2026-06) — Store graphics + full booking verification
- Store assets generated from REAL app screens into /app/frontend/store-assets/: Play feature graphic (1024x500), 4 Play phone screenshots (1080x1920), 4 App Store 6.7" screenshots (1290x2796) + README. Generators: /app/gen_store.py (frames) + /app/cap.py (Playwright capture).
- testing_agent (iteration 27) verified the ENTIRE trip pipeline end-to-end with a real driver: customer books -> POST /trips/request 200 -> "Søker sjåfør" -> driver (API) online+accept+location -> customer sees "Sjåfør på vei" + driver card + live car -> at-pickup/start/arrive -> receipt + rating. Realness confirmed: /cars/nearby returns 0 with driver offline, 1 real driver online. No fake/simulated data.
- Admin/superadmin (WEB portal, not the mobile app): admin@kjapp.no / admin123 (dev). Production requires a strong ADMIN_PASSWORD (>=12 chars, non-default) or backend refuses to boot.

## Update (2026-06) — Real map + Driver app production completion
- NEW shared map: /app/frontend/src/components/TileMap.tsx renders REAL dark raster tiles (Esri Dark Gray free/no-key; auto-upgrades to MapTiler if EXPO_PUBLIC_MAPTILER_KEY is set) + SVG overlays (route, pickup/dropoff, cars, live car, user) + pan + zoom/recenter controls. Replaces the old stylized grid (MapCanvas). Map.tsx & Map.web.tsx both re-export TileMap (works on web preview, Expo Go and native builds; no react-native-maps/native module/API key needed).
- DRIVER app rebuilt to production quality (backend unchanged, all REAL data):
  - (driver)/home.tsx: map-first full-screen, live GPS car marker, online/offline toggle synced to backend (badge no longer flips on web geo-denial), today summary (turer/inntekt/timer from /driver/summary/today), incoming offer card (accept/decline), active-trip state machine (Jeg er fremme→Start→Fullfør) + chat, restart recovery via /driver/current.
  - (driver)/earnings.tsx: period tabs (I dag/Uke/Måned), net hero, gross→commission→bonus→net breakdown, 7-day bar chart (/driver/history/weekly), payout card (/driver/payouts, next_payout_date), recent trips, 'Se alle'→/driver-trips.
  - (driver)/profile.tsx: fetches /auth/me (car/plate/vehicle_type) + /driver/ratings; Kjøretøy + Personlig cards; links to Mine turer + Innstillinger; logout.
  - NEW app/driver-settings.tsx: notification + driving toggles (persist via /settings), språk, personvern (location/GDPR), hjelp, legal, version, logout, delete-account modal (SLETT).
  - NEW app/driver-trips.tsx: full history with filters (I dag/Uke/Alle) + detail sheet (gross/commission/net).
  - api.ts: added driverApi.weekly + driverApi.ratings.
- Verified via testing_agent iteration 28 (real tiles on all 3 maps; customer booking regression PASS; full driver pipeline PASS; earnings/settings/trips PASS). 2 bugs fixed + verified: driver profile vehicle fields (fetch /auth/me), online badge sync on web. Minors fixed: next_payout_date, pointerEvents→style.
- Admin (web portal, dev): admin@kjapp.no / admin123 (set strong ADMIN_PASSWORD before production).
