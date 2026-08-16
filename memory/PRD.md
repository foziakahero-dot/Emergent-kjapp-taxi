# KJAPP — Smart AI Taxi (PRD)

## Original Problem Statement
Build a mobile app for a Norwegian AI-driven taxi service ("KJAPP - Smart AI Taxi"), based on a user-provided design mockup with dark theme + mint accent. Pixel-close, mobile-first PWA (installable on iOS + Android). "Everything real" — real login, real backend, real AI, real navigation on map.

## Tech Stack
- Backend: FastAPI + Motor (async MongoDB) + JWT (bcrypt + PyJWT)
- Frontend: React 18 + React Router + TailwindCSS + Framer Motion + React-Leaflet
- Map: Leaflet with CartoDB Dark Matter tiles (free, no API key)
- AI: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `emergentintegrations` + Emergent LLM Universal Key
- PWA: manifest + apple-touch-icon + viewport safe-area handling

## User Personas
1. **Passenger** — books taxi via map or AI chat, tracks driver, pays, rates.
2. **Admin (seed)** — has admin role for potential dashboard (backlog).

## Core Requirements (delivered)
- Onboarding (3 screens) → Login / Register → Home (map + booking)
- Dynamic map centered on user's real GPS location (with fallback to Oslo)
- 8 available drivers visible as markers on map (fetched from MongoDB)
- Booking flow: pick destination → select vehicle category → confirm → track trip → receipt → rate
- Full trip lifecycle simulator: searching → booking → driver on way → in trip → arrived (~25s total)
- AI chat with Claude Sonnet 4.5 in Norwegian — supports full booking flow inside chat (place picker → category → price → confirm → book)
- Payment methods (Vipps, Visa, Mastercard) — CRUD
- Settings (AI voice, notifications, language, theme) — CRUD
- Trip history with running total
- Profile + Help & Support
- Bottom navigation on primary screens; back button on all secondary screens
- Norwegian language throughout

## What's Been Implemented (2026-08 — Iteration 8: Bug fixes + Driver oppgradering)

### Iter 8 (nåværende sesjon, del 3)
- **BUG FIX**: SearchSheet lot bare velge forhåndsdefinerte steder. Ny endpoint `GET /api/places/search?q=` bruker Nominatim (OpenStreetMap) med Norge-filter → kunden kan skrive hvilken som helst norsk adresse ("Storgata 15 Oslo") og få treff med lat/lng. 350ms debounce på frontend
- **BUG FIX**: Booking-flyten hang på "AI finner din posisjon" fordi trip stod i "searching" til en ekte sjåfør aksepterer. Statustekst er nå endret til "Venter på sjåfør — vi varsler alle ledige sjåfører nær deg" så det er tydelig hva som skjer
- **BUG FIX**: Kunde kunne ikke endre henteadresse. Ny "Endre"-knapp åpner samme adressesøk-modal for pickup
- **AI-modell byttet fra Claude Sonnet 4.5 → GPT-5.6-sol** (svar på "ekte ChatGPT"-spørsmålet). Guardrails fungerer fortsatt
- **Live-kart på DriverHome**: 220px Leaflet-kart med sjåførens egen GPS-marker + "LIVE POSISJON"-badge, kun synlig når "På vakt"
- **Trippel-ping + vibrasjon** ved ny tur (3 ping i rekkefølge + `navigator.vibrate([200,100,200,100,200])`)
- **Sjåfør-profilbilde** synlig i hero (avatar med initialer eller `user.photo`), viser bil + skilt-etikett
- **Turhistorikk-side** `/driver/history`: siste 30 turer + 7-dagers inntektsgraf (`GET /driver/history` + `/driver/history/weekly`)
- **Avbryt tur som sjåfør**: "Kunden dukket ikke opp"-knapp på DriverTrip (`POST /driver/trip/{id}/cancel`) → status "cancelled_by_driver", push til kunde
- **Surge-priser**: `+25% helg (fre 18–søn 23)` og `+15% natt (22–06)`. Nordisk-taxi-modell (stackes ikke, tar max). Ny `GET /api/pricing/surge` viser aktive årsaker. Kunde ser synlig gul chip på Home
- **Rute-info på pending trip-kort**: viser sjåførens avstand til henting live basert på sjåførens GPS

### Iter 8 tests
- **iter_8**: 31/31 · adresse-søk, GPT-5.6-sol, surge, cancel, history, alle regresjonstester
- **Total: 138/138 backend-tester grønne**

## What's Been Implemented (2026-08 — Iteration 6+7)

### Iter 7 tillegg (nåværende sesjon, del 2)
- **Nordisk theme**: `index.css` og `tailwind.config.js` byttet fra kold svart (#050708) til varm midnattsblå (#0a1220) med perlehvit tekst (#f4f1e8). Alle `.card` bruker nå ekte glassmorphism (backdrop-blur 24px + rgba(255,255,255,0.045) + rgba(244,241,232,0.09) border). Mint (#2fe08c) reservert for CTA. `sed`-swap på tvers av 17 filer erstattet 43 hardkodede hex-referanser.
- **Push-lyd for sjåfør**: `lib/sound.js` bruker WebAudio for å synthesizere en to-tone (E5→A5) "ping" når nye turer dukker opp i pending. Låser opp audio-context ved første touch/click (Safari/Chrome autoplay-restriksjon).
- **Native wrapping-oppsett**: `/app/mobile/capacitor.config.json` (klar til `cp` til frontend), `/app/memory/MOBILE_BUILD.md` med komplett steg-for-steg iOS/Android build-guide inkl. plugins, Info.plist-nøkler, AndroidManifest permissions, signing, TestFlight/Play Console-submission, og tidsestimat.

### Iter 6 (nåværende sesjon, del 1)
- **REMOVED**: `_simulate_trip_lifecycle` asyncio.sleep-based fake trip progression. Trips now progress ONLY when real drivers act.
- **REMOVED**: 8 fake seed drivers in `db.drivers` collection. Legacy collection is dropped on startup.
- **NEW**: Real driver GPS heartbeat — `POST /api/driver/location {lat,lng,heading?,speed?}` sent every ~5s from `DriverHome` via `navigator.geolocation.watchPosition` while driver is online. Also updates active trip's `driver_lat/driver_lng` for live passenger view.
- **NEW**: Driver "På vakt"-toggle — `POST /api/driver/online {online:true|false}`. `/api/cars/nearby` only returns drivers with `online:true` AND last GPS ping <60s old.
- **NEW**: Real Stripe payment via Emergent claimable sandbox — keys already in backend/.env. Endpoints: `POST /api/payments/checkout {trip_id, origin_url}`, `GET /api/payments/status/{session_id}`, `POST /api/stripe/webhook`. TripReceipt now has "Betal med kort"-knapp; success/cancel pages at `/payment/success` and `/payment/cancel`.
- **NEW**: GDPR endpoints — `GET /api/gdpr/export` (full JSON export), `DELETE /api/gdpr/delete` (personal data deleted, trips anonymized per norsk bokføringslov).
- **NEW**: Cookie consent banner (`CookieConsent.jsx`) on first visit — "Kun nødvendige" / "Godta alle".
- **NEW**: AI guardrails — system prompt strictly rejects non-taxi questions ("Beklager, det kan jeg dessverre ikke hjelpe med…").
- **UPDATED**: Onboarding redesigned with humble Nordic tone. Slide 1: "Enkel og trygg transport, hvor du enn skal." Slide 2: Route/map SVG (no robotic AI orb). Slide 3: Professional top-down taxi SVG (matches map marker) — "Snille priser. Vennlige sjåfører."
- **UPDATED**: Driver invite schema from `{driver_id}` → `{car, plate, vehicle_type, note?, email?}`. Driver info now lives on user record (car/plate/vehicle_type/rating/online/last_lat/last_lng).
- **PLACEHOLDER**: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` added to backend/.env (empty). Emergent-managed Google Auth still works as fallback.

### Iteration 6 tests
- **iter_6**: 29/29 · beta-readiness overhaul (real GPS, no simulator, Stripe, GDPR, AI guardrails)
- **Total: 107/107 backend-tester grønne**

## What's Been Implemented (2026-08 — earlier)
- Backend `/app/backend/server.py`
  - JWT auth (register, login, logout, me) with bcrypt hashing, Bearer-token header
  - Seeded MongoDB collections: `users`, `drivers` (8), `places` (8), `payment_methods`, `vapid`
  - `POST /api/cars/nearby`, `GET /api/places`, `POST /api/trips/estimate` (uses OSRM real routing)
  - `POST /api/trips/request` + background lifecycle simulator (with 12s wait for a driver to accept, auto-assign fallback)
  - `GET /api/trips/{id}` `/active` `/list`, complete/cancel/rate
  - `POST /api/ai/chat` + `GET /api/ai/history` (Claude Sonnet 4.5)
  - `GET/POST /api/payment-methods`, `GET/PATCH /api/settings`
  - **Driver endpoints** (role=driver): `/api/driver/pending`, `/api/driver/accept`, `/api/driver/current`, `/api/driver/trip/{id}/start` `/arrive`, `/api/driver/summary/today`
  - **Push notifications**: VAPID keys auto-generated on startup, `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `POST /api/push/test` — sends web-push on driver-on-way, trip-started, arrived
  - **Real OSRM routing**: `osrm_route()` calls public OSRM demo; returns real driving distance, duration, and GeoJSON LineString polyline (with graceful haversine fallback)
- Frontend
  - 13 passenger pages (Onboarding, Login, Register, VoiceSignIn, Home, BookingFlow, TripReceipt, AIChat, Profile, PaymentMethods, Settings, TripHistory, HelpSupport)
  - **4 driver pages** (DriverHome, DriverTrip with map+navigation, DriverSummary, DriverProfile)
  - Auto-routing by role: drivers → `/driver`, passengers → `/app`
  - Real OSRM polyline rendered on map (both passenger booking view + driver navigation)
  - **Service worker** `/sw.js` for push notifications when app is closed
  - Push subscribe UI in both Profile (passenger) and DriverProfile
- PWA: manifest.json + SVG icons (192, 512) + apple-touch-icon + safe-area CSS + service worker

## Verified (testing agent iter 1–5)
- **iter_1**: 13/13 · basis
- **iter_2**: 10/10 · sjåfør + push + OSRM
- **iter_3**: 10/10 · admin + driver-invite + Google + ekte priser
- **iter_4**: 17/17 · SendGrid + Apple Sign In + regresjon
- **iter_5**: 28/28 · live-posisjon + chat + regresjon
- **Total: 78/78 backend-tester grønne** — ingen bugs

## Sanntid + kommunikasjon
- **Bilen kjører på kartet**: Ny `lib/tripAnimation.js` computeDriverPosition() beregner sanntid-posisjon basert på tidspunkt for status-endring
  - `driver_on_way`: interpolerer fra `driver_start` → pickup over `eta_min` minutter
  - `in_trip`: går langs OSRM-polyline fra pickup → dropoff over `duration_min` minutter
  - Roterer bilikonet til bevegelsesretning (bearing beregnes)
  - Oppdateres hver sekund på både passasjer- og sjåfør-siden
- **Trip-chat**: Nytt `components/ChatModal.jsx` med sikker tilkobling
  - Passasjer og sjåfør kan sende korte meldinger (maks 500 tegn)
  - 4 hurtigsvar per rolle ("Jeg står utenfor", "Kommer ned nå", "3 minutter unna", osv.)
  - Poller hvert 2.5s for nye meldinger
  - Push-varsler til motparten ved ny melding
  - Backend: `POST /api/trips/{id}/messages` + `GET /api/trips/{id}/messages` med rolle-basert tilgang

## Nye legal og integrasjonsflater
- `/privacy` — Norsk personvernerklæring (12 seksjoner, GDPR-konform, Datatilsynet-referanse)
- `/terms` — Brukervilkår (12 seksjoner, norsk drosjerett, Oslo tingrett verneting)
- Apple Sign In: fullverdig JWT-verifisering mot Apple ID public keys. Aktivering ved å sette `APPLE_CLIENT_ID` i backend .env (krever Apple Developer $99/år)
- SendGrid: graceful fallback — sender invitasjons-e-post når `SENDGRID_API_KEY` er satt, ellers logger til stdout
- Fake status-bar (klokke/wifi/batteri) fjernet fra alle skjermer. Bruker nå ekte device safe-area for iPhone-notch og Android status bar

## Backlog / Next
- P1: Ekte betaling (Stripe/Vipps SDK) ved kvittering
- P1: Skaff Apple Developer + generer APPLE_CLIENT_ID for iOS-lansering
- P1: Skaff SendGrid API-nøkkel for ekte e-post
- P2: Voice input (OpenAI Whisper) for AI chat
- P2: Trip receipts sent via email
- P3: Capacitor wrap for native iOS/Android

## Test Credentials
- Kunde: `ola@kjapp.no` / `test1234` → `/app`
- Sjåfør: `sjafor@kjapp.no` / `sjafor1234` → `/driver`
- Admin: `admin@kjapp.no` / `admin123` → `/admin`
- Se `/app/memory/test_credentials.md` for detaljer

## APK / iOS publisering
- Se `/app/memory/PUBLISHING_AUDIT.md` for komplett 6-ukers roadmap
- Nøkkelinnsikt: **Skatteetatens ARS-godkjenning** er lengste kritiske vei for norsk drosje-lansering

## Backlog / Next
- P0: Ekte betaling (Stripe/Vipps SDK) ved kvittering — første steg mot inntekt
- P1: Sett `APPLE_CLIENT_ID` i backend .env for å aktivere Apple Sign In (krever Apple Developer $99/år)
- P1: Sett `SENDGRID_API_KEY` for ekte e-post-utsending
- P2: Voice input (OpenAI Whisper) for AI chat
- P2: Trip receipts via e-post
- P3: Capacitor wrap for native iOS/Android
- P3: Skatteetaten ARS-godkjenning
