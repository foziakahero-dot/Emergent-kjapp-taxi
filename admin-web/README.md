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


## SNAR Control Center v2 design revision

The design branch now uses the exported Figma typography, tokens, SVG brand/icons,
login, navigation, responsive shell, KPI cards, and shared page controls. Dashboard,
live operations, applications, support, action center and integrations have dedicated
layouts connected to the existing API. The other operational tables, detail panels
and pricing/security forms retain their existing fields and actions within the new
design system; prototype fixtures and simulated login are not included.

Authentication, 2FA, session token storage, RBAC and backend authorization remain in
place. Unknown routes use the same operations permission gate as the dashboard.
The admin gateway targets `https://api.kjappapp.no`, allows auth/admin/superadmin
routes and read-only document downloads, and forwards authorization to the backend.
Password recovery links point to SNAR Fleet. `/login` serves the SPA; internal
navigation continues to use hash routes.

Preview deployments retain API isolation unless `VITE_API_BASE` is explicitly
configured for a test backend. No preview API setting was broadened by this revision.
The original design task requested branch-only delivery, so this revision does not
merge to `main` or change the production alias.

Validation: locked dependency install, Vite production build, TypeScript check,
proxy routing/body/header/error tests, and isolated React rendering of all 19 routes,
RBAC, rejection of fleet-owner sessions, and login/2FA token sequencing. The React
checks use synthetic data and a stub map, and do not replace signed-in live acceptance
testing or a visual review of each screen. No financial, broadcast or approval action
was executed against production during these checks.
