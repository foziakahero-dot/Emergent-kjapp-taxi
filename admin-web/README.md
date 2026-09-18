# KJAPP Admin (Kontrollsenter)

Separate desktop-first web app (Vite + React + TS). **Not** part of the Expo mobile app.
Consumes the existing KJAPP FastAPI `/admin/*` endpoints (one source of truth, no new DB).

## Preview (in this Emergent workspace)
The built `dist/` is served by the backend at **`/api/ops/`** (the preview ingress only routes
`/` → mobile app and `/api/*` → backend), so open:

```
https://<preview-host>/api/ops/#/
```

Login: `admin@kjapp.no` (superadmin). Only `superadmin`/`admin` roles may enter; every
`/admin/*` API is enforced server-side (401/403).

## Local dev
```
cd admin-web
yarn
yarn dev            # http://localhost:5173  (add this origin to backend CORS dev list — already done)
```
API base defaults to `window.location.origin + '/api'`. For local dev against a remote API set:
```
echo 'VITE_API_BASE=https://<api-host>/api' > .env.local
```

## Production deploy → admin.kjappapp.no
This app deploys **independently** of the backend (e.g. Vercel / Netlify / any static host).

1. Build with the production API base:
   ```
   VITE_API_BASE=https://<prod-api-host>/api yarn build
   ```
2. Deploy the `dist/` folder to the host and point the domain **admin.kjappapp.no** at it.
3. Backend CORS already whitelists `https://admin.kjappapp.no`.
4. It uses `HashRouter`, so no SPA rewrite rules are required.

## Security
- Login gated to `superadmin`/`admin`; server RBAC is the authority.
- JWT in `sessionStorage` (cleared when the tab closes); auto-logout on 401.
- 2FA: if TOTP is enabled on the account, the login asks for the 6-digit code.
- `noindex,nofollow` meta. Set a strong `ADMIN_PASSWORD` (≥12 chars) in prod.

## Pages
Dashbord, Live drift, Turer (+detalj/tidslinje), Sjåfører (godkjenn/suspender), Kunder,
Løyvehavere, Kjøretøy, Dokumenter (vurder + utløp), Økonomi (oversikt/transaksjoner/refusjoner),
Support, Audit-logg, Innstillinger. Global søk i topplinjen.


## Mandatory admin 2FA

The control center uses mandatory two-factor authentication for both `admin` and
`superadmin` roles.

- Password login never creates a normal admin session until 2FA has completed.
- Existing admins without TOTP receive a short-lived, purpose-bound enrollment
  token. It can only call the dedicated enrollment endpoints and is rejected by
  `/auth/me` and every normal admin endpoint.
- Existing admins with TOTP receive the normal short-lived verification challenge.
- A normal 7-day access token is issued only after a valid TOTP code or one-time
  backup code has been verified.
- Backup codes are stored only as password hashes and are consumed atomically.
- Disabling 2FA on a privileged account invalidates its existing sessions and the
  next login requires enrollment again.
- Customer, driver and fleet-owner login behavior is unchanged.

Admin login responses may therefore contain either
`twofa_required + twofa_token` or
`twofa_setup_required + twofa_token` instead of a normal `token`.
