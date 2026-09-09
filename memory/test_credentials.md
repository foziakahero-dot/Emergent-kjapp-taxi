# KJAPP — Test Credentials

> **Iter 26 (herding)**: Admin-passordet er IKKE lenger hardkodet i koden — det seedes fra `ADMIN_PASSWORD` i `backend/.env` (dev-verdi: `admin123`). I produksjon kreves sterkt passord (≥12 tegn), ellers nekter serveren å starte. Login har brute-force-beskyttelse: 5 feilforsøk per e-post / 15 min → HTTP 429. Demo-kontoene under seedes kun når `ENABLE_DEMO_DATA=true` (aldri i production).

> **Iter 27 (passordreset)**: `/forgot-password` → e-postlenke `/reset-password/{token}` (1t gyldighet, engangsbruk). Uten SENDGRID_API_KEY logges lenken til backend stdout (`grep "EMAIL/no-key" /var/log/supervisor/backend.out.log`). Vellykket reset nullstiller brute-force-låsen for kontoen.

> **Iter 35 (komplett ekte tur verifisert)**: Hele flyten kunde → sjåfør → tur → admin er kjørt gjennom de faktiske appene: kunde bestiller i kunde-UI, sjåfør får forespørselen live (polling 4 s), godtar (atomisk — 3 parallelle accepts gir 1×200 + 2×409), kjører state-maskinen, fullfører, og admin `/admin/trips` viser samme tur med kunde/sjåfør/bil/pris/inntjening/betalingsstatus + full tidslinje. Auto-avslag av turforespørsler er FJERNET; avslåtte turer skjules 5 min per sjåfør. Kundeappen viser KUN sjåførens ekte GPS (< 90 s), ellers «Venter på GPS-signal fra sjåføren…». Nytt: `GET /api/driver/demand` (gull varmekart «Travle soner») og Web Push ved ny tur. Betaling er IKKE live — `status` (tur) og `payment_status` (betaling) er tydelig skilt.

> **Iter 34 (Driver App = 100 % ekte data)**: All demo-/test-data er PURGET fra databasen (149 `TEST_`/demo-turer + 50 test-brukere slettet) og seederne er fjernet fra `server.py`. `ENABLE_DEMO_DATA` seeder nå KUN de 4 kontoene under (kunde/sjåfør/flåte/admin) — ingen turer, ingen cruise-biler. DriverHome/DriverTrip viser utelukkende autentisert sjåførs egne data + ekte GPS + ekte OSRM-ruter, ellers eksplisitt tom-/loading-/feil-state. Sjåførens GPS sendes kun mens «På vakt» er PÅ (throttlet: >25 m eller ≥15 s). Uten posisjonstilgang vises «Posisjon ikke tilgjengelig / Aktiver posisjonstilgang for å bruke KJAPP» (`data-testid="driver-gps-unavailable"`).
> E2E-regresjonsskript for hele sjåførflyten: `python3 /app/backend/scripts/e2e_driver_flow.py` (kunde bestiller → pending → accept → arrive-at-pickup → passasjer om bord → fullført → inntekt/historikk). Datainspeksjon: `python3 /app/backend/scripts/inspect_data.py`.

## Kunde (passasjer)
- URL: `/login`
- Email: `ola@kjapp.no`
- Password: `test1234`
- Role: `user`
- Alt: Google Sign In fungerer også (`/login` → Google-knapp → Emergent-managed OAuth)

## Sjåfør
- URL: `/driver/login`
- Email: `sjafor@kjapp.no`
- Password: `sjafor1234`
- Role: `driver`, approved: `true`
- Car: `Tesla Model Y · EL12345` (stored on user record)
- Fleet: tilknyttet "Oslo Nord Taxi AS" (Iter 10)
- **VIKTIG**: Sjåfør må slå på "På vakt"-toggle på DriverHome for å motta turer og for at cars/nearby skal returnere dem. Toggle sender GPS-heartbeat hvert ~5s til `/api/driver/location`.

## Flåteier (Fleet Owner)
- URL: `/login` (redirectes automatisk til `/fleet`)
- Email: `floteier1@kjapp.no`
- Password: `fleet1234`
- Role: `fleet_owner`
- Fleet: "Oslo Nord Taxi AS" (org.nr 999888777, 20% avgift)
- Tilknyttet sjåfør: `sjafor@kjapp.no`

## Admin (Superadmin — kun eier)
- URL: `/login` (redirectes automatisk til `/loyver`)
- Email: `admin@kjapp.no`
- Password: `admin123`
- Role: `superadmin` (auto-backfilt fra `admin` ved backend-oppstart, Iter 13)
- **2FA/TOTP (Iter 32)**: Valgfri per konto. Aktiveres på `/admin/settings` (2FA-kort) → skann QR i autentiserings-app → skriv 6-sifret kode → få 8 backup-koder. Når aktivert returnerer `/auth/login` `{twofa_required:true, twofa_token}` og innlogging krever et ekstra kode-steg (`POST /auth/2fa/verify-login`). Deaktiveres med passord + kode. Backup-koder er engangsbruk. TOTP-koder regnes i test med `pyotp.TOTP(secret).now()`. **Demo-superadmin skal etterlates med 2FA AV** slik at demo-innlogging ikke låses.
- Har tilgang til: `/loyver` (søknader), `/loyver/applications/:id`, `/loyver/pending-drivers`, samt alle eksisterende `/admin/*` endepunkter (require_admin aksepterer både `admin` og `superadmin`)
- I prod: pek `admin.kjappapp.no` mot samme app. Prod-eier-admin: `ADMIN_EMAIL=admin@kjappapp.no` + sterkt `ADMIN_PASSWORD` som deploy-secret.

## Demo-sjåfører (FJERNET fra kundekartet — Iter 33)
- De 6 simulerte «cruise»-sjåførene (`demo1@…demo6@kjapp.no`) seedes IKKE lenger, og
  eventuelle gamle records tvinges `online:false` + GPS-felt slettes ved oppstart.
- `/api/cars/nearby` filtrerer alltid bort `demo:true`/`is_demo:true`/`disabled:true`.
- Kundekartet viser KUN ekte, godkjente sjåfører som er på vakt med GPS-ping < 60 s.
  Ingen sjåfører på vakt ⇒ tom liste + «Ingen biler på vakt akkurat nå» i UI.
- For å se en bil på kundekartet: logg inn som `sjafor@kjapp.no`, slå på «På vakt»
  (eller `POST /api/driver/online {"online":true}` + `POST /api/driver/location {lat,lng,heading}`).

## Sosial innlogging (nøkkel-valgfri — Iter 33)
- **Google (KJAPP-eid OAuth, PKCE)**: `GET /api/auth/google/config` → `{enabled:false}` uten nøkler.
  Aktiveres ved å sette `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` i backend-miljøet.
  Callback-rute i appen: `/auth/google` (samme origin — ingen Emergent-hostet login).
- **Apple**: `GET /api/auth/apple/config` → `{enabled:false}` uten nøkler.
  Aktiveres med `APPLE_CLIENT_ID` (Services ID) + `APPLE_BUNDLE_ID` (native iOS) + Team/Key/.p8.
- Uten nøkler viser knappene grå prikk + «ikke konfigurert»-melding (`social-not-configured`).
- Full oppsettsguide: `/app/memory/OAUTH_SETUP.md`.

## DevNavigator (Iter 17)
- Flytende brass-kompass bottom-right på ALLE ruter (offentlige + private)
- Test-konti-tabell ligger nederst i modalen
- Kan skjules med `?nav=off` i URL

## Auth Endpoints
- POST /api/auth/register (kun kunde)
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/google/session (Emergent OAuth callback)
- GET /api/auth/me

## Sjåfør-registrering (kun via admin-invitasjon)
- Admin: POST /api/admin/driver-invites { car, plate, vehicle_type, note, email? } → returnerer token
- Delbar lenke: `/driver-signup/{token}`
- Sjåfør fyller ut skjema → POST /api/driver-invites/accept
- Kontoen får `approved: false` → kan logge inn, men får 403 på pending trips
- Admin godkjenner: POST /api/admin/drivers/{user_id}/approve { approved: true }

## Sjåfør-flyt (ekte GPS, ingen simulator — Iter 34)
- Sjåfør slår på «På vakt» via ONLINE-pillen oppå kartet (`data-testid="driver-online-toggle"`) → POST /api/driver/online {online:true}
- `watchPosition` sender POST /api/driver/location {lat,lng,heading,speed,accuracy} kun når online (throttle: >25 m ELLER ≥15 s)
- Turer STÅR i "searching" til en ekte sjåfør trykker «Godta tur» (POST /api/driver/accept)
- Turen går videre KUN når sjåfør trykker:
  - POST /api/driver/trip/{id}/at-pickup → status: at_pickup (ankommet hentested)
  - POST /api/driver/trip/{id}/start → status: in_trip (kunde om bord)
  - POST /api/driver/trip/{id}/arrive → status: arrived (fullført)
- `GET /api/driver/current` returnerer «arrived»-tur kun i 15 min etter fullføring (deretter historikk)
- `GET /api/driver/pending` + `/current` beriker med ekte OSRM `pickup_route` (avstand/tid fra sjåførens live-GPS til henting) og `driver_earnings` (pris minus reell plattformavgift)
- Passasjer ser bilen live på kartet via trip.driver_lat/driver_lng (oppdateres når sjåfør pinger)

## Betaling (Stripe)
- Etter turen (status=arrived), passasjer trykker "Betal med kort" på TripReceipt
- POST /api/payments/checkout {trip_id, origin_url} → returnerer Stripe checkout_url
- Testkort: `4242 4242 4242 4242`, hvilken som helst framtidig dato, hvilken som helst CVC
- Suksess: /payment/success?session_id=... → poller GET /api/payments/status/{session_id}
- Webhook: /api/stripe/webhook (Stripe → backend, oppdaterer trip.payment_status=paid)

## GDPR
- GET /api/gdpr/export → returnerer JSON med all brukerens data
- DELETE /api/gdpr/delete → sletter personlig data, anonymiserer turer

## Admin Endpoints (role=admin required)
- GET /api/admin/overview
- GET /api/admin/users
- GET /api/admin/drivers
- GET /api/admin/trips
- POST /api/admin/drivers/{id}/approve
- POST /api/admin/driver-invites { car, plate, vehicle_type, note?, email? }
- GET /api/admin/driver-invites

## Auto-routing etter login
- role=admin → `/admin`
- role=driver → `/driver`
- role=user → `/app`
