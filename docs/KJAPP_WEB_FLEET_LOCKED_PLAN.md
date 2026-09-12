# KJAPP Web + Fleet — Locked Plan

Status: LOCKED

This document is the source of truth for the KJAPP public website and fleet-owner portal. Do not add pages, integrations, portals, dashboards, or product ideas outside this scope without a new explicit decision.

## 1. Product structure

KJAPP has five clearly separated surfaces:

1. `kjappapp.no` — public marketing website for customers and licence holders.
2. `fleet.kjappapp.no` — private fleet/licence-holder portal.
3. `admin.kjappapp.no` — existing KJAPP internal admin/ops control center. Do not redesign or merge into the marketing site in this project.
4. KJAPP Customer app — separate native customer app.
5. KJAPP Driver — separate native driver app.

The mobile apps remain the actual ride product. The public website explains and sells KJAPP. The fleet portal manages the licence-holder business.

## 2. Public website scope — `kjappapp.no`

Build only these public routes in phase 1:

- `/` — main customer/brand page
- `/loyvehaver` — licence-holder acquisition page
- `/hjelp` — simple help/contact page
- `/personvern` — privacy
- `/vilkar` — terms

Do NOT build in phase 1:

- web ride booking
- customer web dashboard
- customer web login/account area
- public driver portal
- blog/news system
- enterprise pages
- city pages
- API/developer pages
- partner marketplace
- unnecessary integrations

## 3. Main page — `/`

### Header

Minimal navigation:

- KJAPP logo
- For løyvehavere
- Hjelp
- Last ned KJAPP

No mega-menu.

### Hero

Primary message:

**KJAPP**

**Taxi. Enklere.**

Supporting copy:

`Bestill taxi på sekunder. Norske løyvehavere. Tydelig pris. Ingen unødvendig styr.`

Primary CTA:

`Last ned KJAPP`

Secondary CTA:

`Er du løyvehaver?`

Visual:

- one high-quality phone mockup using the actual KJAPP customer UI
- dark Nordic/Fjord & Granite visual direction
- no fake activity or fake numbers

### How it works

Three steps only:

1. `Velg hvor du skal`
2. `Se pris og bil`
3. `Følg sjåføren frem til deg`

Use real product screens where possible.

### Why KJAPP

Four concise value points:

- `Lokale taxiselskaper og løyvehavere`
- `Tydelige priser`
- `Verifiserte sjåfører`
- `Norsk kundestøtte`

Do not make unsupported market-leadership claims.

### KJAPP Assist

Show only if the corresponding customer-app feature is production-ready.

If not production-ready, label it clearly as `Kommer snart`.

Example interaction may demonstrate natural-language taxi booking, but must not imply a capability that is not live.

### Licence-holder section

Headline:

`Har du løyve? Kjør med KJAPP.`

Copy:

`Behold kontrollen over virksomheten din. Få turer gjennom KJAPP og administrer sjåfører, aktivitet og oppgjør fra ett sted.`

Primary CTA:

`Bli KJAPP-partner`

Secondary CTA:

`Logg inn som løyvehaver`

### Footer

Only essential links:

- Kunder
- Løyvehavere
- Hjelp
- Personvern
- Vilkår
- Kontakt
- App Store / Google Play when live

## 4. Licence-holder acquisition page — `/loyvehaver`

### Hero

Headline:

`Ditt løyve. Din virksomhet. KJAPP gir deg flere muligheter.`

Supporting copy:

`Koble løyvet ditt til KJAPP, legg til sjåfører og få tilgang til turer gjennom vår kundeplattform.`

Primary CTA:

`Søk om å bli løyvehaver`

Secondary CTA:

`Jeg er allerede partner → Logg inn`

### Value points

Only these four in phase 1:

- `Lav og tydelig provisjon`
- `Du beholder kontrollen`
- `Eget kontrollpanel`
- `Norsk support`

### Application form

Keep the first step short. Fields:

- Navn
- Bedriftsnavn
- Organisasjonsnummer
- Telefon
- E-post
- Antall løyver
- Antall biler
- Område/by

Submit into the existing fleet-application backend/admin flow.

Do not require a full compliance-document upload in the first marketing form. Documentation belongs in onboarding after initial review.

Success state:

`Takk. Vi kontakter deg.`

## 5. Fleet portal — `fleet.kjappapp.no`

Private portal for `fleet_owner` only, using existing server-side RBAC and existing `/fleet/*` endpoints.

Navigation is locked to:

- Oversikt
- Sjåfører
- Turer
- Økonomi
- Bedrift

Do not expose KJAPP internal admin functions to fleet owners.

### 5.1 Oversikt

Purpose: immediate operational picture.

Show:

- dagens turer
- dagens omsetning
- aktive sjåfører
- påloggede biler
- live map of own active vehicles where real location data exists
- latest trips
- weekly summary: omsetning, turer, KJAPP-provisjon, netto

Use real backend data only. Use honest empty states instead of mock values.

### 5.2 Sjåfører

Table/list columns:

- Sjåfør
- Bil
- Status
- Turer i dag
- Omsetning

Primary action:

`+ Legg til sjåfør`

Use the existing invite-link/invite-code flow rather than creating a parallel onboarding system.

### 5.3 Turer

Simple fleet-scoped trip list.

Show the information required for normal operational review only:

- time/date
- driver
- pickup
- destination
- status
- fare

No global admin controls.

### 5.4 Økonomi

KJAPP must not become an accounting system.

Show only:

- Omsetning
- KJAPP provisjon
- Netto
- Utbetalinger
- Export CSV/PDF where supported

No accounting integrations in phase 1.

### 5.5 Bedrift

Simple company/account information and onboarding/compliance status required for the fleet relationship.

Do not turn this into a broad enterprise settings suite.

## 6. Design direction

All web surfaces should belong to the same KJAPP brand family as the current product.

### Customer marketing website

Feeling:

- premium
- calm
- Nordic
- cinematic
- minimal

Use:

- dark Fjord/Granite surfaces
- warm brass/gold accent
- ivory/off-white typography
- large typography
- real KJAPP product screens
- subtle motion only
- generous whitespace

Avoid:

- generic SaaS gradients
- neon-cyber styling
- excessive glassmorphism
- fake dashboards
- stock taxi imagery as the main visual identity
- crowded navigation

### Licence-holder page

Same brand, but more rational/business-focused:

- control
- earnings
- drivers
- vehicles
- simple onboarding

### Fleet portal

Same visual system, but operational:

- sidebar/navigation
- KPI cards
- tables
- live map
- filters where needed
- clear statuses

Function over decoration.

## 7. Integrations — phase 1 limit

Do not copy Uber/Bolt integration complexity.

Use only what the current KJAPP product genuinely needs:

- existing KJAPP FastAPI backend
- existing MongoDB/auth model
- existing fleet endpoints
- existing fleet-application/admin approval flow
- map/location provider already selected by the product
- existing payment infrastructure only where relevant to existing product functionality
- basic email/contact delivery only if required by the existing flow

Do NOT add CRM, marketing automation, accounting, support suites, analytics stacks, document-signing platforms, partner APIs, or automation platforms unless a real business requirement appears later.

## 8. Technical structure

Preferred public/fleet web structure:

```text
web/
├── marketing/
│   ├── /
│   ├── /loyvehaver
│   ├── /hjelp
│   ├── /personvern
│   └── /vilkar
│
└── fleet/
    ├── /oversikt
    ├── /sjaforer
    ├── /turer
    ├── /okonomi
    └── /bedrift
```

Domain routing:

- `kjappapp.no` → marketing
- `fleet.kjappapp.no` → fleet portal
- `admin.kjappapp.no` → existing separate admin-web, untouched by this project

Both marketing/fleet may share one modern web codebase and one design system, but role-gated fleet data remains protected server-side.

## 9. Build order

### Phase A — Information architecture

Status: LOCKED by this document.

Deliverable:

- exact routes
- exact page purposes
- exact CTAs
- exact fleet navigation
- explicit non-scope

### Phase B — Wireframes

Create desktop and mobile wireframes for:

1. Main page
2. Licence-holder page
3. Fleet login
4. Fleet overview
5. Fleet drivers
6. Fleet trips
7. Fleet finance
8. Fleet company

No high-fidelity visual styling until the structure is approved.

### Phase C — Visual system

Lock:

- typography
- color tokens
- spacing
- grid
- buttons
- cards
- forms
- tables
- status chips
- map treatment
- motion rules

### Phase D — High-fidelity design

Produce production-level desktop and mobile designs for the locked screens.

### Phase E — Build

Implement the approved design and connect it to existing real backend data.

No fake production data.

### Phase F — Domains/deployment

- `kjappapp.no`
- `fleet.kjappapp.no`
- leave `admin.kjappapp.no` as the existing admin deployment

### Phase G — Production validation

Validate:

- mobile/desktop responsiveness
- fleet role isolation
- real fleet data
- application submit → admin review flow
- navigation
- empty/error/loading states
- privacy/terms links
- performance

## 10. Final architecture

```text
KJAPP Customer app
    └── customer ride product

KJAPP Driver
    └── driver ride product

kjappapp.no
    └── public brand + customer acquisition + licence-holder recruitment

fleet.kjappapp.no
    └── licence-holder operations

admin.kjappapp.no
    └── KJAPP internal operations
```

This structure is intentionally small. Do not expand it merely to resemble Uber or Bolt.
