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

## What's Been Implemented (2026-08)
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

## Verified (testing agent iteration_1 + iteration_2 + iteration_3)
- **iter_1**: 13/13 basis-endepunkter — 100%
- **iter_2**: 10/10 sjåfør + push + OSRM — 100%
- **iter_3**: 10/10 real prices + admin + driver-invite + Google session — 100%
- Total: **33/33 backend-tester passert** uten bugs

## Test Credentials
- Kunde: `ola@kjapp.no` / `test1234` → `/app`
- Sjåfør: `sjafor@kjapp.no` / `sjafor1234` → `/driver`
- Admin: `admin@kjapp.no` / `admin123` → `/admin`
- Se `/app/memory/test_credentials.md` for detaljer

## APK / iOS publisering
- Se `/app/memory/PUBLISHING_AUDIT.md` for komplett 6-ukers roadmap
- Nøkkelinnsikt: **Skatteetatens ARS-godkjenning** er lengste kritiske vei for norsk drosje-lansering

## Backlog / Next
- P1: Ekte betaling (Stripe/Vipps SDK) ved kvittering
- P1: Ekte Apple Sign In (krever Apple Developer $99/år + egne nøkler)
- P1: Norsk personvernerklæring + brukervilkår (påkrevd for App Store/Play)
- P2: Voice input (OpenAI Whisper) for AI chat
- P2: Trip receipts sent via email (SendGrid/Resend)
- P2: SendGrid-integrasjon for å sende sjåfør-invitasjoner via ekte e-post
- P3: Capacitor wrap for native iOS/Android
- P3: Skatteetaten ARS-godkjenning
