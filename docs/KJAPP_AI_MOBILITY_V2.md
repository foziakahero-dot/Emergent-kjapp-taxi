# KJAPP AI Mobility V2 — Locked Product & Design Scope

Status: DESIGN LOCK / comparison branch
Branch: `design/kjapp-ai-mobility-v2`

This branch exists to build and evaluate the new mobile experience without replacing the current Customer or Driver apps on `main`.

## Product rule

Keep the existing shared FastAPI + MongoDB backend and preserve Customer and Driver as separate Expo applications. V2 changes the experience layer first; backend contracts are reused unless a new capability explicitly requires an extension.

## Customer V2 — locked master screens

1. Splash
2. Login
3. Home / AI Booking
4. KJAPP AI Assistant Chat / Voice
5. Vehicle Selection
6. Driver on the way
7. Active Trip
8. Trip Complete / History

Design direction: dark navy canvas, ice-white content, cyan/blue customer accents, calm Oslo navigation map, conversation-first booking, strong live-trip confidence.

## Driver V2 — locked master screens

1. Driver Splash
2. Driver Login
3. Home / Online Dashboard
4. Incoming Trip Request
5. Navigation to Pickup
6. Arrived at Pickup
7. Active Trip Navigation
8. Earnings / Trip History

Design direction: dark navy canvas, green/cyan operational accent, distraction-free decisions, navigation-first map, high-contrast accept/decline and trip controls.

## Shared design system

Typography: Outfit + Inter

Core colors:
- Canvas: #050A0F
- Navy: #091119
- Surface: #101C2D
- Elevated: #162438
- Customer cyan: #00E5F5
- Customer blue: #2F7DFF
- Driver green: #39E58C
- Danger: #FF4D6D
- Primary text: #F8FAFC
- Secondary text: #91A3B8
- Border: #20344C

## AI architecture

AI is a capability layer, not the source of truth for trips.

Voice/text flow:
1. Customer speaks or types a request.
2. Speech-to-text converts audio when voice is used.
3. LLM extracts booking intent: destination, pickup, date/time, passenger count, preferences.
4. Maps/Places resolves locations and route context.
5. KJAPP backend validates availability, pricing and booking rules.
6. Customer receives valid ride options.
7. Customer explicitly confirms.
8. Backend creates the trip.

Candidate AI provider: OpenAI API for conversational intelligence, speech-to-text and text-to-speech. Final provider/API selection is an implementation decision and must be isolated behind a KJAPP AI gateway.

## Maps / navigation

Required capabilities:
- map rendering
- Places/address autocomplete
- geocoding
- routing
- ETA/traffic
- live driver location
- turn-by-turn driver navigation

Candidate stack: Google Maps Platform or Mapbox. Keep provider access behind map/navigation services so the UI does not depend directly on one vendor.

## Realtime

Required states:
- driver online/offline
- trip offered
- trip accepted
- driver arriving
- driver arrived
- trip started
- trip completed
- trip cancelled
- live driver coordinates and ETA updates

Use existing backend trip state as source of truth; realtime transport broadcasts state changes to Customer, Driver and Admin/Fleet.

## Payments

Digital ride payments support platform fee accounting and scheduled payouts. Current commercial UI wording for Driver/Fleet uses 14% service fee and 86% retained by driver/fleet. Cash-enabled markets require ledger/settlement logic because the driver receives cash directly.

## Non-negotiable implementation rules

- Do not replace current apps until V2 is tested and compared.
- Do not fork the backend unnecessarily.
- Do not let AI create trips without backend validation and explicit user confirmation.
- Customer and Driver remain separately released applications.
- No fake operational data in production UI.
- Preserve accessibility, safe areas and reduced-motion behavior.
- Validate on iPhone and Android before merging into main.
