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
  - Seeded MongoDB collections: `users`, `drivers` (8), `places` (8), `payment_methods`
  - `POST /api/cars/nearby`, `GET /api/places`, `POST /api/trips/estimate`
  - `POST /api/trips/request` + background lifecycle simulator
  - `GET /api/trips/{id}` `/active` `/list`, complete/cancel/rate
  - `POST /api/ai/chat` + `GET /api/ai/history` (Claude Sonnet 4.5)
  - `GET/POST /api/payment-methods`, `GET/PATCH /api/settings`
  - `GET /api/summary/today`
- Frontend (13 pages) — all pixel-close to reference design, dark + mint theme, Norwegian
- PWA: manifest.json + SVG icons (192, 512) + apple-touch-icon + safe-area CSS

## Verified (testing agent iteration_1)
- 13/13 backend endpoints passing (auth, places, cars, trips, AI chat, payment, settings) — 100%
- Frontend visually verified via screenshot: login → home (map + cars + nav) → AI booking flow → receipt

## Test Credentials
- User: `ola@kjapp.no` / `test1234`
- Admin: `admin@kjapp.no` / `admin123`

## Backlog / Next
- P1: Real driver-side app (accept trip, navigation view, daily summary)
- P1: Real payment processing (Stripe/Vipps SDK)
- P1: Real ETA/routing (OpenRouteService or Mapbox Directions)
- P2: Push notifications (web-push for PWA)
- P2: Voice input (OpenAI Whisper) for AI chat
- P2: Admin dashboard (view all trips, driver management)
- P3: Native APK/IPA via Capacitor wrap
