# KJAPP — Test Credentials

## Passasjer (bruker)
- Email: `ola@kjapp.no`
- Password: `test1234`
- Role: `user`

## Sjåfør
- Email: `sjafor@kjapp.no`
- Password: `sjafor1234`
- Role: `driver`  (linked to `car-1` — Tesla Model Y)

## Admin
- Email: `admin@kjapp.no`
- Password: `admin123`
- Role: `admin`

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login  (returns `{ token, user: { id, email, fullName, phone, role, driver_id } }`)
- POST /api/auth/logout
- GET /api/auth/me  (Authorization: Bearer <token>)

## Driver Endpoints (role=driver required)
- GET /api/driver/pending
- POST /api/driver/accept { trip_id }
- GET /api/driver/current
- POST /api/driver/trip/{trip_id}/start
- POST /api/driver/trip/{trip_id}/arrive
- GET /api/driver/summary/today

## Push Endpoints
- GET /api/push/vapid-public-key
- POST /api/push/subscribe { subscription }
- POST /api/push/test

## Auth Flow
- Login/register returns `{ token, user }` JSON. Token also set as `access_token` httpOnly cookie.
- Frontend stores token in `localStorage.kjapp_token` and sends as `Authorization: Bearer <token>` on every request.
- Drivers are auto-routed to `/driver`, passengers to `/app`.
