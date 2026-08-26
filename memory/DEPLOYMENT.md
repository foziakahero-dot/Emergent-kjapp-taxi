# KJAPP — Production Deployment Architecture

Final production topology. **One** backend, **one** MongoDB, **one** user/auth database.
The same React codebase runs in three modes; mode is chosen at **runtime by hostname**.

```
                         ┌─────────────────────────────┐
                         │   api.kjappapp.no  (FastAPI)    │  ← ONE backend
                         │   ONE MongoDB / ONE auth DB  │
                         └──────────────┬──────────────┘
        ┌───────────────────────────────┼────────────────────────────────┐
        │                               │                                 │
┌───────────────┐            ┌───────────────────┐            ┌────────────────────┐
│ NATIVE MOBILE │            │  fleet.kjappapp.no   │            │  admin.kjappapp.no    │
│ (iOS+Android) │            │  FLEET WEB PORTAL │            │  ADMIN / OPS CENTER│
│ main mode     │            │  fleet mode       │            │  admin mode        │
│ passenger +   │            │  fleet_owner      │            │  admin + superadmin│
│ driver        │            │  (+admin/super)   │            │  landing /admin    │
│ REACT_APP_    │            │  landing /fleet   │            │  superadmin /loyver│
│ MODE=main     │            └───────────────────┘            └────────────────────┘
└───────────────┘

kjappapp.no (root)  = RESERVED for a future marketing / app-download website. NOT the app.
```

| Target | Hostname | Mode | Roles allowed | Auth landing |
|--------|----------|------|---------------|--------------|
| Native app (iOS/Android) | `localhost` (Capacitor) | **main** | passenger, driver | `/app` or `/driver` |
| Fleet portal | `fleet.kjappapp.no` | **fleet** | fleet_owner (+admin/superadmin) | `/fleet` |
| Admin / Ops | `admin.kjappapp.no` | **admin** | admin, superadmin | `/admin` (superadmin → `/loyver`) |
| Backend API | `api.kjappapp.no` | — | — | — |
| Marketing (future) | `kjappapp.no` | — | — | — |

Mode detection (`frontend/src/App.js › detectAppMode`), in priority order:
1. `?mode=fleet|admin|main` URL param (preview/testing only; stored in localStorage)
2. **Hostname prefix**: `fleet.*` → fleet, `admin.*` → admin
3. Build-time env `REACT_APP_MODE`
4. Default `main`

Because hostname wins over the env var, ONE web deploy served at both `fleet.kjappapp.no`
and `admin.kjappapp.no` automatically renders the correct portal. The native app runs at
`localhost` → main.

---

## 1. Backend — api.kjappapp.no (shared)

Deploy the FastAPI backend once. Point `api.kjappapp.no` at it (see §5 for DNS).

Production backend environment (see `/app/backend/.env.production.example`):
```
APP_ENV=production
ENABLE_DEMO_DATA=false
TRUST_PROXY=true            # behind the hosting ingress; needed for correct per-IP throttling
JWT_SECRET=<64-char random hex, NOT the dev value>
ADMIN_EMAIL=admin@kjapp.no
ADMIN_PASSWORD=<strong, >=12 chars, not a known default>
MONGO_URL=<production mongo>
DB_NAME=kjapp
FRONTEND_URL=https://admin.kjappapp.no
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=<optional>
```

Production hardening that runs automatically on startup (P0.1):
- Startup **fails fast** (RuntimeError) if `JWT_SECRET`/`ADMIN_PASSWORD` are missing/weak.
- The existing superadmin's password is **rotated** to `ADMIN_PASSWORD` → any old/legacy password stops working.
- All legacy seed/demo accounts (`ola@`, `sjafor@`, `floteier1@`, `demo1..6@`, `demo_p_*@`, and anything flagged `demo`) are **disabled** and can no longer authenticate (generic 401).
- CORS is a strict whitelist (no `*`): the three web hosts + native WebView origins.
- Demo data / demo drivers / demo trips are never seeded.

**CORS allowlist in production** (`server.compute_cors_origins`):
`https://kjappapp.no`, `https://fleet.kjappapp.no`, `https://admin.kjappapp.no`,
`capacitor://localhost`, `ionic://localhost`, `https://localhost` (native).

---

## 2. Fleet web portal — fleet.kjappapp.no

Same web build; hostname puts it in **fleet mode**. Only `/login`, `/apply`, `/fleet/*`,
`/privacy`, `/terms`, password-reset. Customer/driver/admin UI is not routed here; a wrong-role
session lands on a "Feil konto for flåteportalen" screen with a logout button. Server-side
RBAC (`require_fleet_owner`, fleet_id scoping) is the real enforcement.

---

## 3. Admin / Ops control center — admin.kjappapp.no

Same web build; hostname puts it in **admin mode**. Only `/login`, `/admin/*`, `/loyver/*`,
`/privacy`, `/terms`, password-reset. admin → `/admin`, superadmin → `/loyver`. Customer, driver
and fleet users cannot reach admin routes (client routing + `require_admin`/`require_superadmin`
server-side). Recommended extra hardening: put `admin.kjappapp.no` behind Cloudflare Access / IP allowlist.

---

## 4. Native mobile app — KJAPP (iOS + Android)

Capacitor app (`frontend/capacitor.config.json`): `appId=no.kjapp.app`, `appName=KJAPP`.
Runs the bundled web build at `localhost` → **main mode** (passenger + driver). Talks to
`https://api.kjappapp.no` via `REACT_APP_BACKEND_URL`.

Build:
```bash
cd frontend
# .env.production already sets REACT_APP_BACKEND_URL=https://api.kjappapp.no, REACT_APP_MODE=main,
# REACT_APP_ENABLE_DEMO_LOGIN=false, REACT_APP_DEV_NAV=false
yarn build
npx cap sync ios      # then open in Xcode → Archive → TestFlight
npx cap sync android  # then Android Studio → Generate Signed Bundle → Play Console
```
Fleet owners and admins use the web portals in a browser — there is no native app for them.

---

## 5. Frontend production env (`frontend/.env.production`)

Loaded automatically by `yarn build` (NOT by `yarn start` preview). Committed values:
```
REACT_APP_BACKEND_URL=https://api.kjappapp.no
REACT_APP_MODE=main
REACT_APP_ENABLE_DEMO_LOGIN=false
REACT_APP_DEV_NAV=false
```
- `REACT_APP_ENABLE_DEMO_LOGIN=false` → the one-click demo login section and its credentials are
  removed from the production bundle.
- `REACT_APP_DEV_NAV=false` → the dev navigator compass is hidden.
- Hostname detection overrides `REACT_APP_MODE` on `fleet.*`/`admin.*`, so this single file works
  for the native build (main) AND the web deploy (fleet/admin by hostname).

> If your host injects its own `REACT_APP_BACKEND_URL` at build time, that value wins. Ensure the
> web deploy ultimately reaches `https://api.kjappapp.no` (or CNAME `api.kjappapp.no` → the backend).

> **Note on `.env*` being git-ignored:** All `.env*` files are git-ignored. The **Emergent deploy**
> builds from the workspace on disk, so `/app/frontend/.env.production` IS applied automatically.
> For a **GitHub-based host (Vercel/Netlify)** the file is not in the repo — set the same four
> variables (`REACT_APP_BACKEND_URL`, `REACT_APP_MODE`, `REACT_APP_ENABLE_DEMO_LOGIN=false`,
> `REACT_APP_DEV_NAV=false`) in that platform's build-environment settings, or commit
> `.env.production` explicitly (`git add -f`). This is critical: without it the production build
> would fall back to the preview `.env` and ship demo login enabled.

---

## 6. DNS / CNAME records — DO NOT INVENT VALUES

The hosting platform (Emergent deploy, or Vercel/Netlify) gives you the exact target host/record
to point at **after** you deploy. Create these records with the **exact target values the platform
shows you** — do not guess:

```
api.kjappapp.no     CNAME (or A)  → <exact backend target from platform>
fleet.kjappapp.no   CNAME         → <exact web target from platform>
admin.kjappapp.no   CNAME         → <exact web target from platform>
kjappapp.no         (reserve for future marketing site — not the app)
```

After DNS propagates, record the exact values here for the team:
```
api.kjappapp.no     → __________________________   (fill in from platform)
fleet.kjappapp.no   → __________________________
admin.kjappapp.no   → __________________________
```

---

## 7. Post-deploy verification checklist

- [ ] `https://fleet.kjappapp.no/login` → fleet mode ("Flåte-eier innlogging"); `/app` and `/driver` not reachable
- [ ] `https://admin.kjappapp.no/login` → admin mode ("Admin innlogging"); admin → `/admin`, superadmin → `/loyver`
- [ ] Native build stays **main** mode (passenger + driver), talks to `https://api.kjappapp.no`
- [ ] All three clients hit the same `api.kjappapp.no` / same MongoDB / same auth DB
- [ ] Server-side RBAC enforced: customer/driver cannot call `/api/admin/*` or `/api/fleet/*` (403); fleet_owner scoped to own fleet
- [ ] Old/legacy superadmin password no longer works; new `ADMIN_PASSWORD` works
- [ ] Demo accounts (ola/sjafor/floteier1/demo*) cannot log in; demo login UI absent from prod bundle
- [ ] `X-Request-ID` present on responses; no secrets in logs

Preview testing without DNS: use `?mode=fleet` / `?mode=admin` / `?mode=main` on the preview URL.
