# KJAPP — Test Credentials

## Test User
- Email: `ola@kjapp.no`
- Password: `test1234`
- Role: `user`

## Admin
- Email: `admin@kjapp.no`
- Password: `admin123`
- Role: `admin`

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me  (Authorization: Bearer <token>)

## Auth Flow
- Login/register returns `{ token, user }` JSON. Token also set as `access_token` httpOnly cookie.
- Frontend stores token in `localStorage.kjapp_token` and sends as `Authorization: Bearer <token>` on every request.
