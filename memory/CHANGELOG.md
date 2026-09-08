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
