# KJAPP — Test Credentials

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
- Har tilgang til: `/loyver` (søknader), `/loyver/applications/:id`, `/loyver/pending-drivers`, samt alle eksisterende `/admin/*` endepunkter (require_admin aksepterer både `admin` og `superadmin`)
- I prod: pek `admin.kjapp.no` mot samme app. Route-vakt `superadminOnly` gjør at ingen andre roller kommer inn på `/loyver`.

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

## Sjåfør-flyt (NY: ekte GPS, ingen simulator)
- Sjåfør slår på "På vakt" → POST /api/driver/online {online:true}
- Frontend `navigator.geolocation.watchPosition` sender POST /api/driver/location {lat,lng,heading} ~hvert 5. sekund
- Turer STÅR i "searching" til en ekte sjåfør trykker "Godta tur" (POST /api/driver/accept)
- Turen går videre KUN når sjåfør trykker:
  - POST /api/driver/trip/{id}/start → status: in_trip
  - POST /api/driver/trip/{id}/arrive → status: arrived
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
