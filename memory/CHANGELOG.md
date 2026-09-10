# KJAPP — CHANGELOG

> PRD.md (statisk problemformulering + iter 1–32) ble 672 linjer. Fra Iter 33 logges alt her.

## Iter 33 — Kundekart uten demo-biler, premium bil-renders, nøkkel-valgfri OAuth (2026-09-08)

- **Demo-«cruise»-sjåfører fjernet helt** fra kundekartet. Seederen er borte; gamle records tvinges `online:false` + GPS slettes ved oppstart. `/api/cars/nearby` filtrerer bort `demo/is_demo/disabled` og krever GPS-ping < 60 s. Ingen på vakt ⇒ tom liste + «Ingen biler på vakt akkurat nå».
- **Premium bil-illustrasjoner** generert (Standard/Sparsom/Komfort/Premium + kart-ikon) i `/app/frontend/public/vehicles/`, vist via ny `VehicleArt.jsx` i `Home.jsx`.
- **Google OAuth (KJAPP-eid, PKCE) + Sign in with Apple — nøkkel-valgfritt**: `GET /api/auth/google/config` og `/auth/apple/config` returnerer `{enabled:false}` uten nøkler; knappene viser «ikke konfigurert». Callback-rute `/auth/google` (`GoogleCallback.jsx`, `lib/googleAuth.js`). Full oppsettsguide: `/app/memory/OAUTH_SETUP.md`. **GJENSTÅR (bruker)**: opprette Google Cloud OAuth-klient + Apple Services ID og sette secrets i deploy-env.

## Iter 34 — Driver App: 100 % ekte data + ekte live-kart (2026-09-08)

**Brukerkrav**: «REMOVE ALL DEMO DATA + IMPLEMENT REAL LIVE DRIVER EXPERIENCE» — ingen fake/mock/placeholder i sjåfør-appen, ekte GPS-kart med online-status som overlay, ekte turflyt/inntekter, uendret premium design.

### Backend (`server.py`)
- **Alle demo-seedere fjernet** (demo-turer, demo-sjåfører, simulert cruise). `ENABLE_DEMO_DATA` seeder nå KUN de 4 rollekontoene — ingen turer.
- **Engangs-purge ved oppstart** (idempotent): slettet 149 `TEST_`/demo-turer + 50 `test_*`-brukere fra preview-DB (207→58 turer, 64→14 brukere). Ekte kontoer urørt.
- `GET /driver/pending` + `GET /driver/current`: beriket med **ekte OSRM `pickup_route`** (avstand/tid fra sjåførens live-GPS til hentested) og `driver_earnings` = pris − reell plattformavgift (`_platform_commission()`).
- **Ny status `at_pickup`**: `POST /driver/trip/{id}/arrive-at-pickup` → state-maskin `driver_on_way → at_pickup → in_trip → arrived`.
- `GET /driver/current` returnerer «arrived»-tur kun i **15 min** etter fullføring (deretter historikk, ikke «aktiv tur» for evig).
- `GET /driver/summary/today`: ekte `income`/`trips`/`online_minutes`/`acceptance_rate` (null når ingen forespørsler — aldri fabrikkert %).
- **Geokoding reparert (var helt nede)**: Nominatim ga HTTP 429 fra pod-IP ⇒ både `/places/reverse` og `/places/search` bruker nå **Photon (komoot, nøkkelfri, egen User-Agent)** som primær med Nominatim som fallback, og reverse-treff caches per ~110 m rutenett i `db.geocache`. Dette fikset også kundens adressesøk.

### Frontend
- **`DriverHome.jsx` skrevet på nytt**: ekte live-kart (`PremiumMap`, egen bil sentrert) med overlay slik brukeren spesifiserte — «KJAPP DRIVER» øverst venstre, ONLINE/OFFLINE-pill øverst høyre (tapbar), faktisk gate/sted nederst — som glir ned i «God natt, Ola» + ekte dagstall. Skeleton-loading, feilstate m/ retry, og ærlige tomstater («Ingen aktiv tur», «Ingen kommende turer», «0 kr», «Ingen turer i dag ennå»).
- **GPS**: `watchPosition` via `lib/native`; posisjon sendes til backend **kun når online**, throttlet (>25 m ELLER ≥15 s). Uten tilgang: `driver-gps-unavailable` → «Posisjon ikke tilgjengelig / Aktiver posisjonstilgang for å bruke KJAPP» + «Prøv igjen». Reverse-geocode gir ekte gatenavn; faller tilbake til ekte koordinater (aldri oppdiktet sted).
- **`DriverTrip.jsx`**: rute per etappe (sjåfør→henting via `pickup_route`, henting→destinasjon via `trip.geometry`), statusetiketter fra faktisk backend-status, CTA «Ankommet hentested» → «Kunde om bord» → «Fullfør tur», inntjening fra `driver_earnings` + reell avgift. Ingen hardkodet 4.9-rating («Ny kunde» når kunden er ny).
- **`DriverProfile.jsx` / `DriverSummary.jsx`**: fabrikkert «Tilfredshet 98 %» erstattet med ekte `/driver/ratings` (snitt + antall) / `acceptance_rate`.
- **Én sjåfør-nav**: ny delt `DriverBottomNav.jsx` (4 faner: `dnav-home/earn/trips/account`) brukes av Shell; gammel 2-fane `DriverNav.jsx` slettet (dobbel nav-bar borte). DevNavigator-kompasset flyttet opp (`bottom-24`) så det ikke dekker «Konto»-fanen.

### Testing
- `python3 /app/backend/scripts/e2e_driver_flow.py` — **26/26 grønne** (kunde bestiller → pending m/ ekte OSRM → accept → at_pickup → in_trip → arrived → inntekt/historikk oppdatert → offline fjerner bilen fra `cars/nearby`).
- Testing-agent iter 34 (`/app/test_reports/iteration_24.json`): backend 100 %, frontend alle flyter OK. Rapporterte testid-navn + DevNavigator-overlapp er rettet etterpå og re-verifisert med Playwright.
- Datainspeksjon: `python3 /app/backend/scripts/inspect_data.py` (0 demo, 0 `TEST_`).

### Backlog etter Iter 34
- **P1**: Push-varsler ved ny turforespørsel til sjåfør (i dag polling hvert 4. s).
- **P1**: Sjåfør-tilgjengelighet: pause/kø-styring + skift-oppsummering.
- **P2**: MapTiler-nøkkel i deploy-env (bedre kartstil/geokoding-rate enn Photon/OpenFreeMap).
- **P2**: OAuth-nøkler (Google/Apple) i deploy-env — se `/app/memory/OAUTH_SETUP.md`.


## Iter 35 — Første komplette EKTE tur: kunde → sjåfør → tur → admin (2026-09-09)

**Brukerkrav**: én komplett KJAPP-tur skal fungere ende-til-ende gjennom de faktiske appene, uten mock eller simulert suksess.

### Ny funksjonalitet
- **Travle soner (gullfarget varmekart)** — `GET /api/driver/demand`: aggregerer FAKTISKE turer (siste 90 min = live, samme ukedag ±1 time siste 4 uker = normalt) i ~1 km celler, straffer celler der det alt står online sjåfører, og gir topp 3 soner med ekte reverse-geokodet navn + snittinntjening etter plattformavgift. Kartlag `demand-core` + `demand-heat` i `PremiumMap` (ny `heat`-prop), pill `driver-heat-toggle` på kartet, panel `driver-demand-panel` med ærlig tomstate «Ingen etterspørselsdata ennå».
- **Push ved turforespørsel**: `POST /trips/request` sender nå Web Push til alle godkjente online sjåfører med «Ny tur · X kr til deg» (tag `kjapp-new-trip`, `requireInteraction`, sterk vibrasjon, «Se turen»-action i `sw.js`). DriverHome har banner `driver-push-enable` («Få turer på låst skjerm») og re-abonnerer stille når tillatelse allerede er gitt.

### Kritiske feil funnet og rettet under E2E-verifiseringen
1. **`/driver/current` maskerte den aktive turen**: en nylig fullført tur (nyere `created_at`) ble returnert i stedet for turen sjåføren nettopp godtok → sjåføren fikk feil tur på skjermen. Nå prioriteres aktive statuser, og fullført tur vises kun 15 min (inkl. `completed`/`rated` slik at oppsummeringen ikke forsvinner når kundeappen lukker turen).
2. **Auto-avslag ødela godta-raten**: kortet avslo turen automatisk etter 15 s, men turen ble tilbudt på nytt hvert 4. sekund → 52 falske avslag og 3 % godta-rate. Auto-avslag er FJERNET (kun manuelt avslag), avslåtte turer skjules i 5 min per sjåfør (`/driver/pending`), og de 52 feil-genererte avslagene er slettet. Godta-rate er nå 100 % (ekte).
3. **Feil ble svelget stille**: «Godta tur» viste ingen feilmelding ved 409. Nå `sonner`-toast (Toaster manglet helt i `App.js` — lagt inn).
4. **Tomtilstand vistes ikke** etter at kort forsvant (AnimatePresence uten keyed motion-element).
5. **Kundeappen viste SIMULERT bil**: `computeDriverPosition` interpolerte posisjon når GPS manglet. Nå brukes KUN sjåførens ekte GPS (< 90 s), ellers ingen bil + «Venter på GPS-signal fra sjåføren…».
6. **Kunden manglet `at_pickup`-tilstand** → egen blokk «Sjåføren er fremme / Kom ut når du er klar» (`customer-at-pickup`).
7. **Sjåfør-GPS ble ikke skrevet til turen i `at_pickup`** → status lagt til i location-oppdateringen.
8. **Pickup-adressen var «Din posisjon»** (ubrukelig for sjåfør/admin) → kundens GPS reverse-geokodes til ekte gatenavn.
9. **Admin manglet kjøretøy/betaling/inntjening** på turlisten → `/admin/trips-full` returnerer nå `driver_car`, `driver_plate`, `driver_earnings`, `payment_status`, `accepted_at`, `completed_at`, og `AdminTrips.jsx` viser dem.

### Godkjenningstest — kjørt gjennom de faktiske appene (ikke mock)
Kunde `ola@kjapp.no` bestilte via kunde-UI (Aker Brygge, 186 kr) → tur `1e52bdb1` opprettet i `db.trips` → sjåfør `sjafor@kjapp.no` fikk forespørselen live uten refresh (ekte kundenavn, OSRM-avstand til henting, 167 kr inntjening) → «Godta tur» → kunde fikk «Sjåfør på vei» + ekte sjåfør/bil + ekte GPS-bil → «Jeg er fremme» → kunde «Sjåføren er fremme» → «Kunde om bord» → kunde «Turen din» → «Fullfør tur» → kunde havnet på kvittering «Venter på betaling 186 kr» → sjåfør: 186 kr / 1 tur / godta-rate 100 % + historikk → admin `/admin/trips` viser SAMME tur med kunde, sjåfør, Tesla Model Y (EL12345), rute, 173/186 kr, «167 kr til flåten», «Ubetalt» og full tidslinje (Bestilt 00:19:48 → Sjåfør aksepterte → Fremme hos kunde → Tur startet → Ankommet 00:21:10).
- **Atomisk aksept verifisert**: 3 parallelle `POST /driver/accept` på samme tur → nøyaktig 1× 200, 2× 409.
- `python3 /app/backend/scripts/e2e_driver_flow.py` → ALL PASSED etter alle endringene.

### Dokumenterte mangler (IKKE erstattet med mock)
- **Ingen Supabase i dette prosjektet** — backend er FastAPI + MongoDB, ett kanonisk tursystem (`db.trips`).
- **Betaling er ikke live**: turfullføring og betaling er tydelig skilt (`status` vs `payment_status`). Stripe Checkout finnes (testnøkkel), men automatisk trekk av lagret kort ved fullføring (off-session PaymentIntent) er IKKE implementert. Kvittering/admin viser «Venter på betaling»/«Ubetalt».
- **Realtime = polling** (kunde 2 s, sjåfør 4 s). Ingen WebSocket/SSE ennå — men ingen manuell refresh kreves.
- **Native push mangler sender**: Web Push (VAPID) fungerer; APNs/FCM-tokens lagres i `db.native_push_tokens`, men ingen native sender er implementert (krever FCM-server-nøkkel/APNs .p8).
- **Tilbudsmodell**: turer broadcastes til alle online sjåfører (først-til-å-godta vinner, atomisk). Sekvensielt tilbud til nærmeste sjåfør med per-sjåfør timeout og videresending er ikke implementert.
- **Flåte-dashboard** viser aggregater, ikke en tur-for-tur-liste (admin har full turliste).
- **Statusnavn** (kanonisk backend-kilde): `searching` → `driver_on_way` → `at_pickup` → `in_trip` → `arrived` → (`completed` når kundeappen lukker turen) → `rated`, samt `cancelled` / `cancelled_by_driver`. Dette tilsvarer brukerens requested/accepted/driver_en_route/driver_arrived/passenger_onboard/in_progress/completed.


## Iter 36 — Native push (nøkkel-valgfri) + «nærmeste sjåfør først» (2026-09-09)

### Nærmeste sjåfør først (sekvensiell dispatch)
- Ny dispatch-motor i `server.py`: `_dispatch_candidates()` (godkjent + online + GPS < 90 s + ikke på tur, sortert på FAKTISK avstand til hentestedet), `offer_trip_to_next_driver()` og `dispatch_loop()` (bakgrunnstask, sjekker hvert 3. sekund).
- Turen tilbys **kun** nærmeste sjåfør i `DISPATCH_OFFER_SECONDS` (20 s, satt i `backend/.env`). Uten svar sendes den automatisk videre til neste nærmeste. Når alle har hatt sjansen åpnes turen for alle (`dispatch_mode: broadcast`) slik at ingen tur blir borte.
- `POST /driver/decline` sender turen videre umiddelbart. `GET /driver/pending` viser kun turer som er tilbudt deg (eller broadcast) og **ingenting når du er offline**. `POST /driver/accept` avviser forsøk på å ta en tur som er tilbudt en annen (409 «Turen er tilbudt en annen sjåfør akkurat nå») og claim-en er fortsatt atomisk.
- Sjåfør-UI viser ekte nedtelling fra backend: «Sendes videre om X sek» (`driver-offer-countdown`), eller «Åpen for alle sjåfører» når turen er broadcast. Auto-avslag finnes ikke — backend flytter turen, sjåføren straffes ikke.
- Aktiv-tur-kortet skiller nå ekte tilstand: «Nylig fullført / Se oppsummering» i 15-minutters-vinduet, «Aktiv tur / Åpne aktiv tur» ellers.

### Native push (låst skjerm) — klar, nøkkel-valgfri
- `firebase-admin` installert. Ny sender i `server.py`: `_fcm_app()` (lazy init fra `FCM_SERVICE_ACCOUNT_JSON` eller `FCM_SERVICE_ACCOUNT_FILE`), `_fcm_send()` (høy prioritet, kanal `kjapp_trips`, APNs alert-payload, sletter døde tokens) og `send_native_push()`. `send_push_to_user()` sender nå til BÅDE mobilapp (FCM/APNs) og web push.
- `GET /api/push/native-config` → `{"enabled": false, "message": "Native push er ikke konfigurert ennå …"}` til nøkkelen finnes. Verifisert med en dummy service-account: init OK, sendefeil håndteres uten å krasje.
- Android: høy-prioritetskanal `kjapp_trips` (lyd + vibrasjon + lys) opprettes i `lib/native.js`; `google-services`-pluginen er allerede betinget aktivert i Gradle. iOS: `App.entitlements` (aps-environment) opprettet, `UIBackgroundModes` inkluderer `remote-notification`.
- Sjåfør-banner «Få turer på låst skjerm» bruker native registrering i mobilappen (`registerNativePush`) og Web Push i nettleser.
- **Full guide**: `/app/MOBILE_BUILD.md` (Firebase-prosjekt, `google-services.json`, `GoogleService-Info.plist`, APNs `.p8` → Firebase, `FCM_SERVICE_ACCOUNT_JSON` i backend-miljø, test på ekte telefon, Android/iOS-bygg). `.gitignore` dekker service-account-JSON, `.p8`, keystore.
- **Publisering**: Emergents direkte APK/iOS-publisering gjelder kun Expo/React Native. KJAPP er Capacitor → APK/IPA bygges lokalt (Node 22+) eller i Xcode Cloud/CI. Alt annet er ferdig konfigurert.

### Testing
- Nytt regresjonsskript `python3 /app/backend/scripts/e2e_dispatch.py` — **ALLE PASSED** med to ekte sjåførkontoer: nærmeste får tilbudet, fjern sjåfør ser den ikke, kan ikke snike, ubesvart tilbud videresendes etter 20 s, neste sjåfør godtar, state-maskin kjøres, inntekt havner hos den som kjørte, native-config svarer nøkkel-valgfritt.
- UI verifisert med Playwright: nedtelling/broadcast-tekst, offline gir 0 forespørsler + tomstate, online gir dem tilbake, «Nylig fullført»-merking.
- Lint-blokkering (`WorkerGlobalScope` i MapLibre-vendorfil) løst via `.oxlintrc.json` i både `/app` og `/app/frontend` (ignorePatterns + globals) — verifisert med `npx oxlint`.

### Gjenstår (krever bruker/eksterne kontoer)
- Firebase-prosjekt + `google-services.json` + `GoogleService-Info.plist` + APNs `.p8` og `FCM_SERVICE_ACCOUNT_JSON` — se `/app/MOBILE_BUILD.md`.
- Automatisk kortbelastning ved fullført tur (Stripe off-session) er fortsatt ikke implementert.
- Når alle sjåfører har avslått, er turen skjult 5 min per sjåfør; kunden får ennå ikke «ingen sjåfør tilgjengelig»-melding.


## Iter 37 — Sjåførbonus i travle timer: oppdrag styrt fra admin (2026-09-10)

Brukeren valgte mekanikken «fullfør visse turer innen et tidsvindu» og at admin skal styre den.
**KJAPP betaler bonusen av sin egen provisjon — kundens pris røres ikke** (ingen skjulte påslag).

### Backend (`server.py`)
- Ny samling `bonus_campaigns`: `name`, `trips_required`, `bonus_kr`, `start_hour`/`end_hour` (Oslo-tid via `zoneinfo`), `max_per_driver_per_day`, `active`.
- `_campaign_progress()` teller sjåførens FAKTISKE fullførte turer (`arrived_at` innenfor dagens vindu) — ingen fabrikkerte tall. `award_driver_bonuses()` kalles i `POST /driver/trip/{id}/arrive` og utbetaler i det målet nås (én gang per kampanje per dag, styrt av `max_per_driver_per_day`), logger i `bonus_payouts` og sender push «Bonus opptjent · +X kr».
- `GET /api/driver/bonus` → aktive oppdrag med ekte fremdrift, `earned_today`.
- `GET /api/driver/summary/today` → `income` = turinntekt + bonus, med `trip_income` og `bonus` separat.
- `GET /api/driver/payouts` → `pending_bonus`, `bonuses[]` og reell provisjon (`_platform_commission()` i stedet for hardkodet 20 %).
- Admin: `GET/POST/PATCH/DELETE /api/admin/bonus-campaigns` + `GET /api/admin/bonus-payouts` (med sjåførnavn og totalsum). Kun admin; sjåfør/kunde får 403.

### Frontend
- Ny admin-side `AdminBonus.jsx` (`/admin/bonus`, «Bonus» i admin-menyen): opprett oppdrag (navn, turer, kr, tidsvindu, maks per sjåfør/dag), skru av/på, slett, se ekte forbruk per kampanje og utbetalingslogg.
- Sjåfør: bonuskort på Driver Home (`driver-bonus-card`) rett over/ved varmekartet med gull-fremdriftslinje, «X av Y turer · kl 18–22», «+250 kr» og ekte status «Fullført i dag — +250 kr lagt til utbetalingen». «I dag»-inntekten viser «inkl. +X kr bonus», og utbetalingssiden viser bonusandelen.
- `DriverTrip`: fullført tur viser toast «Bonus opptjent · +X kr» når målet nås (fra `arrive`-responsen).

### Testing
- Nytt skript `python3 /app/backend/scripts/e2e_bonus.py` — **ALLE 18 PASSED**: admin oppretter oppdrag → sjåfør ser ekte fremdrift → 2 ekte turer kjøres → bonus utbetales nøyaktig én gang → dagsinntekt = turinntekt + bonus → bonus i ventende utbetaling → ingen dobbeltutbetaling (cap) → admin ser utbetaling med sjåførnavn og forbruk → av/på fungerer → 403 for kunde/sjåfør på admin-endepunkter.
- UI verifisert: oppdrag opprettet gjennom den ekte admin-siden, og sjåførkortet viste «Kveldsoppdrag Oslo · 3 av 3 turer · +250 kr» med «inkl. +400 kr bonus» i dagsinntekten.
- Regresjon etter endringene: `e2e_driver_flow.py` og `e2e_dispatch.py` fortsatt grønne.
- Lint: MapLibre-vendorfilen bruker nå `globalThis.WorkerGlobalScope` (identisk oppførsel, ingen `no-undef`) — kartet verifisert `loaded/styleLoaded/tiles = true` etterpå.

### Gjenstår
- Bonus utbetales som del av ukentlig utbetaling (`bonus_payouts.paid_out` settes når utbetalingen faktisk kjøres — utbetalingsjobben er ikke automatisert ennå).
- Sonebasert bonus (kun turer i travle soner) er bevisst IKKE bygget: å vurdere gamle turer mot dagens varmekart ville gitt upålitelige tall.
