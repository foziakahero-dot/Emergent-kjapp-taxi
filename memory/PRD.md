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

## What's Been Implemented (2026-08 — Iter 17: Beta polish, live cars, DevNavigator, softer wording)

### Iter 17 — final pass før iOS/APK

**Kontekst**: Bruker rapporterte data-ord/robotisk språk, sheet ikke minimerbar, ingen kart-zoom, hamburger-menu uten funksjon, ønsket screen-navigator, ville ha surge-chip + amateur "Legg til kort" fjernet, og live biler faktisk synlige.

**Nye komponenter**:
- **`DevNavigator`** (`/app/frontend/src/components/DevNavigator.jsx`) — flytende brass-kompass bottom-right på ALLE ruter. Modal med 5 grupper: Kunde / Sjåfør / Flåteeier / Superadmin / Offentlig. Test-konti listet nederst. Kan skjules med `?nav=off`.
- **`CustomerMenu`** (inline i Home.jsx) — sliding drawer fra venstre når hamburger-ikonet trykkes. Avatar, Turhistorikk, Bankkort, Profil, Innstillinger, Hjelp, Logg ut.
- **6 demo-sjåfører** som cruiser Oslo (backend simulator, real DB records, real API): `demo1@…demo6@kjapp.no`, kjører med `asyncio.create_task(cruise_demo_drivers)` som oppdaterer posisjon+heading hvert 6. sekund. Heading normaliseres nå `% 360` (bugfix fra testing agent i iter17).

**Endringer i Home.jsx**:
- Meny-ikonet åpner CustomerMenu-drawer
- Bunn-sheet minimerbar via `sheet-toggle` → viser oppsummeringsrad
- Surge-chip fjernet helt
- Amateur "Legg til betalingskort først"-blokk fjernet (booking-add-card slettet)
- PaymentRow er nå ett kompakt kort med "Verifisert"-pill eller "Ingen kort lagret"
- Softer ord: "Hentes fra" / "Kjøres til", "biler i nærheten", "Nærmeste bil er X min unna", "Ca. pris", "sjåfør kan hente deg om X min"
- CTA-labels: "Legg til bankkort for å bestille" → "Fullfør kortverifisering" → "Bestill bilen · X kr"

**Endringer i PremiumMap.jsx**:
- Zoom +/- brass-knapper på høyre side (data-testid `map-zoom-in`, `map-zoom-out`)
- Markers rendrer umiddelbart (ready-gate fjernet)
- Fallback-timer clearer på `load` event

**Iter 17 tests**
- **iter_17**: 73/73 backend grønn (inkludert bug-fix for heading normalisering) + 100% frontend UI-verifisering
- Ingen data-testid `surge-chip` eller `booking-add-card` i DOM (grep = 0)
- E2E-flyt verifisert: login → 6 biler synlige → Jobb → "Bestill bilen · 203 kr" → redirect til /app/booking/{tripId}
- DevNav testet på 6 ruter, alle 5 grupper klikker OK
- Admin @ admin@kjapp.no auto-router til /loyver, Løyvehaver-panelet rendrer med 5 søknader + 12 sjåfører venter
- **Total: 386/386 backend-tester grønne (etter iter17 bug-fix)**

## What's Been Implemented (2026-08 — Iter 16: Emoji removal, brass Onboarding, live cars simulator)

### Iter 14 — visuell premium-oppgradering på kunde-siden

**Kontekst**: Bruker rapporterte at kart-navigasjonen var "smsyørlig" (amatør), ba om 3D-biler på kartet, krevet at kort skal være verifisert (ikke bare lagret), bilkategori-UI så amatør ut, og etterlyste synlig sjåfør-inngang.

**Nye komponenter**:

- **`PremiumMap`** (`/app/frontend/src/components/PremiumMap.jsx`) — MapLibre GL JS-wrapper med:
  - Pitch 45–50° for 3D-effekt (ingen API-nøkkel)
  - Primary: OpenFreeMap Liberty vektor-stil m/ 3D-bygninger extrusion
  - Fallback: CartoDB Voyager raster (4s timeout, robust)
  - Brass polyline i 3 lag (glow + line + kremhvit shimmer-dash)
  - Custom HTML markers: brass droplet pickup, sjakkflagg dropoff, isometrisk sedan-silhuett med halo (aktiv bil bruker større scale + brass glow)
  - `followActive`-modus følger bilen med `easeTo` under `in_trip`
- **Kort-verifisering**:
  - Backend: `verified` flag på `payment_methods`. `POST /api/trips/request` returnerer nå 402 med "Kortet ditt må verifiseres" dersom ingen metoder har `verified: true`. Stripe SetupIntent-callback setter `verified = (setup_status === "succeeded")`.
  - Frontend: 3-tilstands `PaymentRow` (mangler kort → Legg til / uverifisert → Kortet må verifiseres / verifisert → grønn "Verifisert"-pill). CTA-knappen viser rett tekst per tilstand.
- **Premium Vehicle Picker** (`BookingReview`):
  - Horisontal snap-scroll med 4 kort (Standard/Sparsom/Komfort/Premium)
  - Unik isometrisk SVG-glyf per kategori (sedan, kompakt m/ løvblad, minivan m/ 3 vinduer, luksus-sedan)
  - Tagline-chip (RASK / SPAR / FAMILIE / SIGNATURE), kapasitetsikon, pris i tabular-nums
  - Valgt-tilstand: brass gradient + brass border + brass sjekkmark-badge topphøyre + brass glow
- **Sjåfør-inngang + Bli løyvehaver** synlige:
  - Onboarding: nye lenker `onboarding-driver-link` + `onboarding-loyver-link` i footer
  - Login: eksisterende sjåfør-link + ny `link-loyver-apply` + demo-fill-knapp `login-demo-fill` (autofyller `ola@kjapp.no`/`test1234`)
- **Sjåfør-app polish**: `DriverHome` online-toggle bruker theme-variabler (rgba white) i stedet for hardkodede tech-blå (`#17222a`/`#263038`). Mint-aksent bevart.

### Iter 14 tests
- **iter_14**: 59/59 backend grønn (8 nye + 26 iter13 + 25 iter10 regresjon) i 36.6s
- Full frontend-verifisering på mobil (390×844):
  - PremiumMap canvas renderer korrekt (Voyager fallback engagerer som designet)
  - Vehicle picker snap-scroll m/ alle 4 test-ids
  - PaymentRow 3-tilstands-flyt verifisert ende-til-ende
  - 0-height-bug på MapLibre fikset (inline `height:100dvh` + `position:absolute inset:0`)
  - Onboarding + Login lenker verifisert
- **Total: 373/373 backend-tester grønne**
- Post-test polish: `defaultMethodVerified`-prop lagt til så "Verifisert"-pill reflekterer FAKTISK default-kort (ikke bare "en verifisert et sted"). Fallback-timer clearer nå på `load`-event (unngår sen swap).

## What's Been Implemented (2026-08 — Iter 13: Superadmin panel + Løyvehaver-søknader + Object Storage)

### Iter 13 (nåværende sesjon, del 8) — kun-for-eier admin med subdomain-strategi

**Kontekst**: Bruker ba om et super-admin-panel «kun for meg» som kan nås via subdomen (`admin.kjapp.no` i prod), for å motta løyvehaver-søknader med dokumenter, og for å godkjenne sjåfører som løyvehavere inviterer.

**Nye komponenter**:

- **Ny rolle `superadmin`** — kun tildelt `admin@kjapp.no` (auto-backfilt fra `admin` ved oppstart). Backend `require_superadmin`-dependency for eksklusive endepunkter. `require_admin` og `require_fleet_owner` aksepterer nå også `superadmin` for bakover-kompatibilitet.
- **Route-vakt (frontend)**: `Protected superadminOnly` returnerer `/app`-redirect for alle andre roller. I prod peker `admin.kjapp.no` mot samme app; vakten sørger for isolering. Ingen egen React-app trengs.
- **Emergent Object Storage** integrert (via `INTEGRATION_PROXY_URL` + `EMERGENT_LLM_KEY`):
  - `init_storage()`, `storage_put()`, `storage_get()` med force-reinit ved 404
  - Paths: `kjapp/{scope}/{subject_id}/{uuid}.{ext}`
  - MIME whitelist: image/jpeg|png|webp|heic|heif + application/pdf. Max 8 MB.
  - `/api/upload` (auth), `/api/upload/public` (via application_token), `/api/upload/driver-doc` (via invite_token)
  - `/api/files/{path:path}` (auth-gated download; superadmin ser alt, eier ser egne, flåte-eier ser sine sjåførers dokumenter)
- **Løyvehaver-søknad (offentlig)**:
  - `POST /api/fleet-applications/draft` → oppretter draft, returnerer `upload_token`
  - 5x `POST /api/upload/public` (firmaattest, løyvebevis, vognkort, forsikring, bank)
  - `POST /api/fleet-applications/submit` → status=pending, sender e-post til alle superadmin-brukere (SendGrid graceful fallback)
  - Frontend: `/apply/fleet` (2-stegs skjema)
- **Superadmin-panel** `/loyver`:
  - Statistikk-kort: Nye søknader, Godkjente flåter, Sjåfører som venter
  - Faneblad: Venter/Godkjent/Avslått
  - Detaljside `/loyver/applications/:id`: iframe-forhåndsvisning av PDF/bilder via blob-URL fra `/api/files/{path}`, beslutning-blokk (godkjenn med kommisjonsrate, eller avslå), notat til søker
  - `/loyver/pending-drivers`: se førerkort/kjøreseddel/profilbilde per sjåfør, Godkjenn/Avvis
- **Fleet-eier kan invitere sjåfører direkte**:
  - `POST /api/fleet/driver-invites` (scoped til deres `fleet_id`), `GET /api/fleet/driver-invites`
  - Invite lagrer `fleet_id`, sjåfør blir automatisk tilknyttet ved akseptert invitasjon
- **Sjåfør-signup krever dokumenter**:
  - Nye felter i `DriverSignupRequest`: `drivers_license_path`, `taxi_license_path`, `profile_photo_path` (alle påkrevd)
  - `POST /api/driver-invites/accept` returnerer 400 uten alle 3 dokumenter, ellers oppretter driver med `approved: false`, kobler til fleet, og re-tilordner `uploaded_files.owner_user_id` til den nye brukeren
  - Frontend: `/driver-signup/{token}` er nå 2-stegs: kontodetaljer → dokumentopplasting → send til godkjenning

### Iter 13 tests
- **iter_13**: 26/26 nye + 25/25 iter10-regresjon = **51/51 grønn**
- Object Storage E2E verifisert (upload → storage_path → auth-gated download)
- Superadmin auto-backfill verifisert (admin@kjapp.no returnerer `role='superadmin'`)
- Route-vakt verifisert (ola@kjapp.no → /loyver → /app redirect)
- Alle 5 fleet-doc-typer + 3 driver-doc-typer enforced
- **Total: 314/314 backend-tester grønne**

## What's Been Implemented (2026-08 — Iter 12: Kunde-app Nordic Premium polish)

### Iter 12 (nåværende sesjon, del 7) — fullstendig utrulling av passasjer-visuell identitet

**Kontekst**: Brukeren rapporterte at kunde-appen «så amatør ut» sammenlignet med sjåfør-appen etter Iter 11. Årsak: Nordic Premium-paletten var kun halvveis rullet ut — CSS-variabler + Login/Onboarding, men Home, BookingFlow og karttegn brukte fortsatt gammel `#131a1f` tech-blå bakgrunn og `#2fe08c` neon-mint aksent (feil rolle-farge).

**Endringer (kun frontend, ingen backend-berøring)**:

- **Karttegn full-rewrite** (`lib/mapAssets.js`):
  - Pickup: brass droplet-pin med gradient (`#e0b876 → #a8834a`) + kremhvit inner dot
  - Dropoff: mørk fjordsvart-pin med brass sjakkbrettflagg-detalj
  - Bil (sedan-silhuett fra toppen): brass utline + halo, taillights terrakotta
  - Ny eksport `carIconRotatedDriver()` for sjåfør-siden (mint variant)
- **Polyline**: mint `#2fe08c` (weight 4) → brass `#c9a15b` (weight 5–6) + kremhvit dashet shimmer-overlay via `.polyline-shimmer` (dashShift 22s animasjon)
- **Home.jsx**:
  - Fjernet alle `bg-[#131a1f]` (tech-blå) → theme vars `var(--bg-base)` + rgba glassmorph
  - Emoji `💳 ⚡ ⚠` → lucide `CreditCard`, `Zap`, `AlertTriangle`, `ChevronRight`
  - Surge-chip: gul → varm terrakotta med brass typografi
  - Bottom sheet: nytt `.sheet-handle` (44×4 pill) på toppen
- **BookingFlow.jsx** helt strukturert på nytt:
  - `SearchingState` med tre pulserende radar-ringer i brass + animerte punkter
  - `SafetyModal` med tel:112 nødrad, KJAPP-support, «Del turen med en du stoler på» copy-link
  - `CallModal` med formatert sjåfør-nummer + brass «Ring nå» tel:-knapp
  - `PremiumLoader` (3 brass dots med pulse) — erstatter tidligere «giant orb blob»
  - Brass ETA-sirkel med tabular-nums «{min} MIN» + editorial uppercase label
  - `MetricCell`-rader for Avstand / Tid / Betaling (dynamisk viser «Vipps» eller «Kort» basert på `trip.payment_method`)
  - Alle `alert()`-dialoger fjernet — Ring/Sikkerhet/Meld åpner premium modaler
- **UIKit.jsx**: `ProgressRing` stroke hardkodet `#2fe08c` → `var(--accent)` (respekterer rolle-theme)
- **index.css**:
  - `.leaflet-control-attribution` + `.leaflet-control-zoom` → `display: none` (kunde-visning)
  - `.leaflet-tile-container` filter saturate(0.72) — dempet karttegn-farger
  - `.sheet-handle` utility + `.polyline-shimmer` keyframe

### Iter 12 tests
- **iter_12**: 25/25 backend regresjon (uendret) + full frontend design-verifisering:
  - Polyline `#c9a15b` bekreftet
  - Leaflet zoom/attribution `display:none` bekreftet
  - Nye test-ids `searching-cancel`, `safety-close`, `call-do`, `call-close` FOUND + interactive
  - INGEN emoji 💳⚡⚠⭐ på Home / BookingReview / BookingFlow
  - INGEN `alert()`-dialoger fyres
  - Sjåfør-tema mint fortsatt korrekt isolert via `body.driver-theme`
- **Total: 263/263 backend-tester grønne**

## What's Been Implemented (2026-08 — Iter 11: Nordic Premium redesign + rolle-basert visuell identitet)

### Iter 11 (nåværende sesjon, del 6)
**BAKGRUNN**: Full designoverhalering fra "mint neon tech-startup" til "Nordisk premium editorial".

**Ny palett** (kunde-side default):
- Bakgrunn: `#0c1216` fjordsvart (var: kald midnattsblå)
- Accent: `#c9a15b` varm messing (var: neon mint)
- Sekundær accent: `#7ba69e` dempet sjøgrønn
- Tekst: `#e8e0d0` matt kremhvit (var: perlehvit)
- Muted: `#7a827a` tåkegrå
- Linjer: `rgba(232,224,208,0.08)` nesten usynlig

**Sjåfør-side** (aktiveres via `body.driver-theme` klasse i Shell):
- Bakgrunn: `#050708` rent svart (dashbord)
- Accent: `#2fe08c` skarp mint (HUD-signatur)
- Card border-radius: 12px stramere (kunde 20px)
- Ingen backdrop-blur — verktøy, ikke kunst
- Info-tett layout

**Typografi**:
- Headlines: **Instrument Serif** (editorial, som Aftenposten)
- Body: **Inter** 300-700
- Tall: **JetBrains Mono** (tabnum)

**Navigasjon**:
- **Kunde**: Erstattet 4-tabs bottom-nav med **Floating Command Bar** — kun én hamburger-knapp nederst-venstre + glidende ark. Airbnb 2023 / Revolut-følelse. Ingen visuell støy på hjem-siden.
- **Sjåfør**: Redusert fra 4 tabs → **2 tabs** (Kjør + Konto). Verktøy-fokus.

**Papir-tekstur**: Kunde-siden får subtil noise/paper overlay via SVG turbulens. Sjåfør-siden får rent svart uten tekstur.

**Ingen backend-endring** — kun `.jsx`/`.css`/`.js` frontend. Global sed-swap av gamle hex-koder.

### Iter 11 tests
- **iter_11**: 25/25 backend regresjon + full frontend design-verifisering (Instrument Serif applied, FloatingCommand testids OK, driver 2-tab nav OK, body.driver-theme class toggles per rolle)
- **Total: 238/238 backend-tester grønne**

## What's Been Implemented (2026-08 — Iter 10: Flåteier-portal)

### Iter 10 (nåværende sesjon, del 5)
- **Lys nordisk kart** (Voyager tile) på kunde-siden i Home + BookingFlow — mye mer imøtekommende enn den mørke Uber-lignende Dark_all
- **Sjåfør P0**:
  - **Utbetalings-side** `/driver/payouts`: brutto+netto med 20% KJAPP-provisjon, neste utbetaling (neste mandag), historikk
  - **Ratings-kort** på DriverHistory med snitt + antall vurderinger + brutt-ned per stjerne (backend `/api/driver/ratings`)
  - **Uleses-badge** rød sirkel på "Melding"-knappen i DriverTrip når kunden har sendt melding (backend `/api/messages/unread-count` + `mark-seen`)
- **Flåteier-portal** (`/fleet`) — helt ny rolle:
  - Ny `fleet_owner`-rolle i users, ny `fleets`-kolleksjon, `fleet_id` på sjåfører
  - Backend: `/api/fleet/me`, `/api/fleet/overview`, `/api/fleet/drivers`, `/api/fleet/payouts`, `/api/admin/fleets` (POST+GET), `/api/admin/fleets/attach-driver`
  - Frontend: `FleetOverview` (uke-netto, sjåfører online/total, turer i dag), `FleetDrivers` (liste + søk), `FleetPayouts` (utbetalinger)
  - RBAC: `fleet_owner`/`admin` for `/fleet/*`, kun `admin` for `/admin/fleets/*`
  - Admin får ny "Flåter"-tab med opprettelses-skjema (navn, org.nr, eier-e-post, provisjon)
- **Seedet test-flåte**: "Oslo Nord Taxi AS" (org.nr 999888777, 20% avgift, eier `floteier1@kjapp.no` / `fleet1234`), sjafor tilknyttet

### Iter 10 tests
- **iter_10**: 25/25 · nye endepunkter + fleet-RBAC + regresjon
- **Total: 213/213 backend-tester grønne**

## What's Been Implemented (2026-08 — Iter 9: Betalingsgate + ekte Stripe-kort)

### Iter 9 (nåværende sesjon, del 4)
- **Betalingsgate**: `POST /api/trips/request` returnerer nå 402 hvis brukeren ikke har et betalingskort. Frontend redirect til `/app/payment-methods?required=1` med gul banner
- **Ekte Stripe-kort-oppsett**: Nye endepunkter `POST /api/payments/card/setup` (SetupIntent Checkout — ingen forhåndstrekk) + `GET /api/payments/card/setup/{session_id}` (henter kortdata fra Stripe etter redirect og lagrer med `stripe_payment_method_id`, `last4`, `exp_month`, `exp_year`). Reuser Stripe-kunde-ID (idempotent)
- **Slett kort**: `DELETE /api/payment-methods/{id}` med eier-sjekk
- **Vipps stub**: `GET /api/payments/vipps/config` returnerer `{enabled: false}` — UI viser "Kommer snart"-badge til `VIPPS_CLIENT_ID` er satt i .env
- **Nye bil-kategorier** i UI (backend `vehicle_type`-ID uendret for bakover-kompatibilitet):
  - AI-First → **Standard** (Rask og pålitelig)
  - Enkelt → **Sparsom** (Beste pris)
  - Trygg → **Komfort** (Rommelig / familie)
  - Premium → **Premium** (Business)
- **Surge-chip**: skjuler prosent (25% osv.) fra kunden — viser kun "Helgetillegg" / "Natt-tillegg" + "Litt høyere pris akkurat nå"
- **Kart-oppførsel bekreftet**: Home viser alle online biler i nærheten før booking. Etter booking navigeres kunden til BookingFlow som viser KUN tildelte sjåfør (via `computeDriverPosition(trip)` som leser `trip.driver_lat/driver_lng`)
- **Bestillings-kort** viser nå kunde standard-kort (label + last4) med "Endre"-knapp. Hvis ingen kort: stor gul CTA "Legg til betalingskort først"
- **PaymentMethods-siden** helt bygd om: real Stripe-integrasjon, sletting av kort, Vipps-badge, "Sikker hos Stripe. Ingen forhåndstrekk"-fottekst

### Iter 9 tests
- **iter_9**: 44/44 · betalingsgate, Stripe SetupIntent, DELETE kort, Vipps stub, alle iter6+7+8-regresjoner
- **Total: 182/182 backend-tester grønne**

## What's Been Implemented (2026-08 — Iter 8: Bug fixes + Driver oppgradering)

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

## Iter 19 — Fjerne login-friksjon + AI-chat fungerer via touch (2026-02-24)

**Bruker rapporterte**: "Går ikke logge seg på verken sjåfør eller kunde, hvor er admin og fleet, AI-chat funker ikke, hvordan laster jeg opp fleet+admin parallelt på nettet — hold disse separate fra selve appen."

### Fikset
- **4 demo-knapper på /login** (data-testid `demo-passenger/driver/fleet/admin`) med **ett-trykks auto-login** — fyller inn credentials OG sender skjemaet, redirect til riktig panel per rolle
- **Admin/Fleet-paneler synliggjort**: Route-mappet 4 roller → 4 destinasjoner (`/app`, `/driver`, `/fleet`, `/loyver`), demo-knappen tar deg dit i én klikk
- **REACT_APP_MODE flagg** i App.js — samme kodebase kan bygges som 3 separate apper: `main` (kjapp.no), `fleet` (fleet.kjapp.no), `admin` (admin.kjapp.no). Standalone-modus skjuler alle irrelevante ruter og redirecter feil rolle tilbake til /login
- **DEPLOYMENT.md** — komplett guide for hvordan deploye 3 separate builds med DNS, env-vars og Vercel/Netlify multi-site
- **AI-chat backend fix**: Fjernet history-replay-loop i `/api/ai/chat` som re-sendte hele samtalen til LLM per kall (5-30s → 2-3s per svar). Satt `asyncio.wait_for(25s)` timeout og differensierte 504/502 feilmeldinger
- **AI-chat frontend fix**: Byttet `/app/ai` fra `Shell` til `Shell withNav={false}` — fjerner BottomNav "Til hjem"-pill som dekket send-knappen (touch-brukere trykket "back" i stedet for "send"). Deretter oppdaget iter19b at DevNavigator kompass også overlappet → skjult på `/app/ai`, `/app/booking`, `/app/receipt`. Nå fungerer chat-send via touch.
- **Spesifikke feilmeldinger** i AIChat.jsx: status 504/502/401 gir målrettede norske feiltekster i stedet for generisk "hikk"
- **Bankkort i Innstillinger**: Ny "Bankkort og betaling"-rad (`settings-payment-methods`) i /app/settings som lenker rett til /app/payment-methods

### Iter 19+19b test
- **Backend**: 15/15 pytest grønn (test_iter19.py) — alle 4 login-flyter, AI-chat responderer i 2.2-2.8s per tur, translate NO→PL cached, alle regresjons-endepunkter grønne
- **Frontend E2E**: (iter19b) chat-send via touch verifisert, dev-nav-open ikke synlig på /app/ai, alle 4 demo-login-knapper redirect korrekt til `/app | /driver | /fleet | /loyver`

### Nye env-flagg
```
REACT_APP_MODE=main|fleet|admin  (default: main)
REACT_APP_DEV_NAV=true|false     (default: false i prod)
```


## Iter 21 — Sjåfør-audit + Iter 22 Nordic Mobility Redesign (2026-02-24)

### Iter 21 — Full sjåfør + kunde audit fikset
- **Test-sjåfør er nå ekte**: `sjafor@kjapp.no` seeder Ola Sjåfør med Tesla Model Y EL12345 AI-FIRST, rating 4.9, approved=True
- **Oslo-kartet vises**: Byttet fra cartocdn til `cartodb-basemaps-{s}.global.ssl.fastly.net` (fastly-CDN, stabil)
- **Kunde-info på turer**: Backend `/driver/pending` og `/driver/current` beriket med `customer: {name, phone, rating, initials, trip_count}`. Frontend viser avatar-chip + rating + ring-knapp (`tel:` ekte) på hver pending trip
- **Signaler ved ny tur**: Trippel piping + vibrasjon + **browser Notification API** ved nye turer. Toggle "Lyd-signal ved ny tur" i DriverProfile
- **Demo-trip seeder**: Backend background task holder alltid 1-2 demo-pending-trips (fra ekte demo-passasjer-kontoer med rating og trip_count) så sjåfør-flyten aldri er tom under beta-demo
- **DriverProfile omskrevet**: 6 nye funksjonelle knapper (Utbetalinger, Turhistorikk, Push-varsler, Lyd-signal, Auto-Google Maps, Personvern, Kontakt support). Kjøretøy-seksjonen viser Tesla Model Y · EL12345 · AI-FIRST
- **DriverTrip customer strip**: Ekstremt synlig kunde med avatar, navn, rating, trip_count. Ring-knapp bruker `tel:` når nummer finnes. Support-knapp bruker `mailto:`

### Iter 22 — Nordic Mobility Redesign (design_agent_full_stack)
Design blueprint på `/app/design_guidelines.json` — bygget mot brukers verbatim visjon: "Apple + premium bil + nordisk design".

- **Nordic palett**: `#0B1013` graphite bakgrunn, `#F4F4F0` ivory tekst, `#CBA365` champagne gull (kun for CTA — kontrollert). `#8A9198` sekundær grå.
- **Typografi**: Fraunces (display, italic subtitles) + Inter Tight (UI body)
- **Mørkt Nordic-kart**: PremiumMap forced til dark raster style — mørk graphite base (#06090A) med desaturert cartodb-fastly kart. Rute-glow #CBA365 opacity 0.22 blur 8px, shimmer i #F4F4F0
- **Elegant bil-glyph**: Alle biler har subtil gullhalo (identity marker), aktiv bil får sterkere glow
- **Pulserende bruker-ring**: `userPosEl()` — 3-lags gull-ring (0.28 halo, 0.55 kjerne, ivory core) med `kjapp-pulse-1` 2.6s animasjon. Erstatter pickup-pinnen i "utforsker"-modus
- **Smart hjem-panel**: "God ettermiddag, Ola." (tid-basert hilsen) + "På vei et sted? Nærmeste bil er 8 min unna." (personalisert)
- **"Hvor vil du?"** (ikke "Hvor skal du?") + 3 quick-chips: Hjem · Jobb · Flyplass (fly-ikon)
- **Minimalistisk splash**: "KJAPP" (A får gullshimmer 3.6s loop) + "NORDIC TAXI" tracking-0.42em + "Enklere. Tryggere. Kjappere."
- **Fjernet papirtekstur**: Ren graphite (design guidelines krevde ren luksus, ikke rustikk)



## Iter 23 — Full Nordic-utrulling: Assist FAB + 3-tier + Rich Menu + Sjåfør-tema (2026-02-24)

- **Signatur søkekort**: Kompakt kort med "GOD ETTERMIDDAG, OLA" overline i gull + "Hvor vil du?" Fraunces + gull-søk-bubble. Hele kortet er tappable. Erstattet 2 separate elementer (greeting + button) med 1 elegant identity-kort. Løser bruker-feedback "man må klare å nå søkebaren".
- **3-tier vehicle preview**: KJAPP / KJAPP+ / KJAPP XL vises som horisontale bil-kort i tomstate (før destinasjon) — brand-identitet før man har valgt tur.
- **KJAPP Assist FAB**: Gull-gradient orb (56×56) med Sparkles-ikon + 3s halo-pulse animasjon, alltid synlig nederst-høyre i kunde-hjem. Navigerer til /app/ai.
- **Rikt side-panel (CustomerMenu)**: 3 grupper — "Din reise" (Profil, Mine turer, Favoritter, Betaling), "KJAPP-medlem" (Rewards m/ NY-badge, Sikkerhet, Tilgjengelighet), "Verktøy" (KJAPP Assist m/ gull-ramme, Innstillinger, Hjelp). Nederst: "Bli KJAPP-sjåfør →" og "Bli løyvehaver →" gull-CTAer + Logg ut. Fraunces header med "KJAPP-MEDLEM" tracking-widest.
- **Sjåfør-app Nordic-tema**: Driver-theme CSS oppdatert — samme graphite bakgrunn (#05090B), samme ivory tekst (#F4F4F0), samme KJAPP-gull (#CBA365) som kunde-app. Tailwind `mint` alias mappet til gull for automatisk cascade. Mint (grønn) beholdt via `--status-online` for online-status og GPS-punkt.
- **Tailwind + fonts oppdatert**: Fraunces (display) + Inter Tight (body) satt som primær. Alle brass-hex (#c9a15b, #f4ecd8, #0c1216) migrert til Nordic-palett.

### Verifisert (screenshots + testids)
- 9 nye testids på hjem: home-greeting, home-where-to, quick-{Hjem,Jobb,Flyplass}, tier-preview-{ai-first,premium,trygg}, home-kjapp-assist
- 9 menu-testids: menu--app-{profile,favorites,rewards,safety,accessibility,ai}, menu-become-{driver,loyver}, customer-menu
- Backend 40/40 regresjon grønn


## Iter 20 — Deploy-klar for 3 separate apper via runtime-detection (2026-02-24)

**Bruker ba om**: Deploy fleet.kjapp.no og admin.kjapp.no som separate apper.

### Runtime app-mode detection
- App.js `detectAppMode()` med 3 kilder: (1) `?mode=fleet|admin|main` URL-param (lagres i localStorage), (2) hostname prefix (`fleet.*` → fleet, `admin.*` → admin), (3) build-time env `REACT_APP_MODE`. Default: main
- `window.__KJAPP_MODE` eksponert for debug/QA
- **Én Emergent-deploy kan servere alle 3 domener** via CNAME-records

### Login polerert per modus
- fleet-modus: "Flåte-eier innlogging" + kun `demo-fleet` + "Søk om løyve"-lenke
- admin-modus: "Admin innlogging" + kun `demo-admin`
- main-modus: "Velkommen tilbake" med alle 4 demo-knapper
- Feil rolle på feil modus → auto-redirect til /login

### Deployment guide (DEPLOYMENT.md oppdatert)
- **Anbefalt**: Én Emergent-deploy + 3 CNAMEs (kjapp.no, fleet.kjapp.no, admin.kjapp.no → samme app)
- Alternativ: 3 separate builds med Vercel/Netlify multi-site
- Cloudflare Access-anbefaling for admin.kjapp.no, deploy-checklist, backend CORS-tuning

### Verifisert
- `?mode=admin` → MODE=admin, kun demo-admin, /fleet blokkert → /loyver ✅
- `?mode=fleet` → MODE=fleet, kun demo-fleet, "Søk om løyve" synlig ✅
- `?mode=main` → alle 4 knapper synlige ✅

## Backlog / Next
- P0: Ekte betaling (Stripe/Vipps SDK) ved kvittering — første steg mot inntekt
- P1: Sett `APPLE_CLIENT_ID` i backend .env for å aktivere Apple Sign In (krever Apple Developer $99/år)
- P1: Sett `SENDGRID_API_KEY` for ekte e-post-utsending
- P2: Voice input (OpenAI Whisper) for AI chat
- P2: Trip receipts via e-post
- P3: Capacitor wrap for native iOS/Android
- P3: Skatteetaten ARS-godkjenning

---

## Iter 18 — Siste innspurt: Native Mobile + AI Vekstpakke (2026-02-23)

**Kontekst**: Bruker sa "Mobil appen skal være ekte ikke mockup. Kjør alt som mangler m dette er siste innspurt." + spurte om Supabase (svart NEI, beholder MongoDB+FastAPI+Emergent).

### Native mobil (Capacitor v8)
- ✅ Oppgradert Node.js fra 20 til 22 (Capacitor 8 krever ≥22)
- ✅ Installert Capacitor v8 core + CLI + iOS + Android + 9 plugins: `@capacitor/{app,device,geolocation,haptics,network,preferences,push-notifications,splash-screen,status-bar}`
- ✅ `/app/frontend/ios/App/App.xcworkspace` — komplett Xcode-prosjekt, klar til å åpne på Mac
- ✅ `/app/frontend/android/` — komplett Android Studio-prosjekt, klar til gradle assembleDebug
- ✅ `capacitor.config.json` med `appId=no.kjapp.app`, splash, statusbar, backgroundColor
- ✅ `Info.plist` fylt ut med NSLocation*UsageDescription (norsk tekst), UIBackgroundModes (location+fetch+remote-notification), ITSAppUsesNonExemptEncryption=false
- ✅ `AndroidManifest.xml` med ACCESS_FINE/COARSE/BACKGROUND_LOCATION, POST_NOTIFICATIONS, FOREGROUND_SERVICE_LOCATION, WAKE_LOCK, VIBRATE
- ✅ **Isomorf `/app/frontend/src/lib/native.js`**: `initNativeShell()`, `watchLocation()`, `registerNativePush()`, `haptic()`, `getDeviceInfo()`, `nativeStore` — automatisk fall-back til web-API når ikke native
- ✅ `DriverHome.jsx` bruker `watchLocation()` (ekte native GPS på native, `navigator.geolocation` på web)
- ✅ `App.js` kaller `initNativeShell()` + `registerNativePush()` på boot når native
- ✅ Safe-area CSS (`env(safe-area-inset-*)`) for notch-tilpasning

### Bakcend nye endepunkter
- ✅ `GET /api/health` — {app, status, db, time} for mobile-monitoring + uptime-poll
- ✅ `POST /api/push/native-subscribe` — {platform: ios|android|web, token, device_id?} → lagrer APNs/FCM token med composite key (user_id, platform, device_id) så multi-device fungerer
- ✅ `POST /api/ai/translate` — {text, target_lang} → GPT-5.6-luna via Emergent LLM Key, 22 språk støttet (no/en/pl/ur/ar/so/ti/fa/tr/ru/uk/vi/th/zh/hi/…), 30-dagers cache i `translation_cache`
- ✅ `POST /api/ai/transcribe` — {audio_base64, mime_type, language?} → OpenAI Whisper via `OpenAISpeechToText`, dedikert 400/429/502-differentiering
- ✅ `GET /api/fleet/export/monthly?year&month` — Skatte-klar Excel-rapport (3 ark: Sammendrag, Sjåfører-brekke, Turer) via openpyxl, kun for fleet_owner

### Frontend nye komponenter
- ✅ **FleetPayouts** — nytt "Månedsrapport (Excel)" kort med måned/år-velger + `data-testid="fleet-export-download"` som streamer .xlsx
- ✅ **ChatModal** — språk-velger i header (NO/EN/PL/UR/AR/SO/RU/TR/DE/ES), "Oversett til XX"-knapp under hver innkommende melding, italic sub-boble med oversettelsen
- ✅ **AIChat** — mikrofon-knapp (data-testid `chat-mic`) når input er tom, MediaRecorder → base64 → `/api/ai/transcribe`, auto-send etter 400ms hvis transkribering fungerer, 15s max-recording
- ✅ **DevNavigator** env-gated: `REACT_APP_DEV_NAV=true` for beta, ikke synlig i produksjon (App Store review-safe)

### Iter 18 tester (100%)
- **backend**: 25/25 pytest grønn (`test_iter18.py`) — health, translate (401/400/lang/cache/no→en/no→pl), transcribe (401/400 short+invalid), native-subscribe (401/422/200 ios+android), fleet-export (200 xlsx + magic PK, 403 passenger, 400 invalid), regresjon på alle roller/endepunkter
- **frontend**: 100% E2E — passenger login+DevNav+is-native-class, AI chat mic/send/typing states, fleet_owner auto-redirect, fleet-export card+dropdowns+ekte .xlsx-nedlasting verifisert via `page.expect_download()`
- **regresjon**: 44 av iter 7-17 tester består (1 timeout var nettverksfeil, ikke kode)

### Deferred
- 🟡 Vipps checkout — venter på VIPPS_CLIENT_ID/CLIENT_SECRET/SUBSCRIPTION_KEY/MSN fra bruker
- 🟡 Apple Sign-In aktivering — venter på APPLE_CLIENT_ID
- 🟡 APNs .p8-nøkkel + FCM google-services.json for faktisk push-sending (endepunktet lagrer tokens, sender ikke fysisk)
- 🟢 server.py refactor til `routes/*.py` — skippet i sluttspurt (2999 linjer, høy regresjonsrisiko). Backlog P2.

### Backlog etter iter 18
- P0: APNs + FCM native push sender (8-16t etter nøkler)
- P0: Vipps checkout (4-8t etter nøkler)
- P1: Apple Sign-In finalisering
- P1: Skatteetaten ARS-godkjenning (2-6 uker saksbehandling, START NÅ)
- P2: server.py refactor → `/app/backend/routes/{auth,trips,driver,fleet,admin,ai,payments}.py`
- P2: Rate-limiting på `/ai/translate` og `/ai/transcribe` (nå ubegrenset)
- P3: Trip receipts via e-post (SendGrid, allerede stubbed)
