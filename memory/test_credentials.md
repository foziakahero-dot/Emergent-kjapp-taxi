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
- Role: `driver`, approved: `true`, linked to `car-1` (Tesla Model Y)

## Admin
- URL: `/login` (redirectes automatisk til `/admin`)
- Email: `admin@kjapp.no`
- Password: `admin123`
- Role: `admin`

## Auth Endpoints
- POST /api/auth/register (kun kunde)
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/google/session (Emergent OAuth callback)
- GET /api/auth/me

## Sjåfør-registrering (kun via admin-invitasjon)
- Admin: POST /api/admin/driver-invites { driver_id, note } → returnerer token
- Delbar lenke: `/driver-signup/{token}`
- Sjåfør fyller ut skjema → POST /api/driver-invites/accept
- Kontoen får `approved: false` → kan logge inn, men får 403 på pending trips
- Admin godkjenner: POST /api/admin/drivers/{user_id}/approve { approved: true }

## Admin Endpoints (role=admin required)
- GET /api/admin/overview
- GET /api/admin/users
- GET /api/admin/drivers
- GET /api/admin/trips
- POST /api/admin/drivers/{id}/approve
- POST /api/admin/driver-invites
- GET /api/admin/driver-invites

## Auto-routing etter login
- role=admin → `/admin`
- role=driver → `/driver`
- role=user → `/app`
