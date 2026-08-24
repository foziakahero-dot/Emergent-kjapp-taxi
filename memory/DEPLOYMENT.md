# KJAPP — Deployment Guide (3 separate apps)

KJAPP er bygget som **én kodebase** som kan bygges og deployes som **3 separate apper** på tre domener:

| App | Rolle | Domene | Build-flag |
|-----|-------|--------|------------|
| **Main** (kunde + sjåfør) | user / driver | `kjapp.no` | `REACT_APP_MODE=main` (eller ikke satt) |
| **Fleet Portal** | fleet_owner | `fleet.kjapp.no` | `REACT_APP_MODE=fleet` |
| **Admin Console** | admin / superadmin | `admin.kjapp.no` | `REACT_APP_MODE=admin` |

Backend (`api.kjapp.no`) er felles for alle tre.

---

## 1. Hvorfor separere?

- **Bruker-forvirring**: Kundens PWA skal ikke ha admin- eller flåte-lenker
- **App Store review**: Enklere godkjenning når kun kunde/sjåfør-flyten synlig
- **Sikkerhet**: Reduserer angrepsflaten — admin.kjapp.no kan for eksempel IP-låses eller VPN-låses
- **Ytelse**: Mindre JS-bundle per app (kun de rutene som trengs)

Ved `REACT_APP_MODE=fleet` blir kun `/login`, `/apply`, `/fleet/*`, `/privacy`, `/terms` bygget. Alt annet (kundeflyt, sjåfør, admin, kart, betaling) er skjult.

---

## 2. Bygge de tre appene

### 2.1 Main (kunde + sjåfør) — kjapp.no

```bash
cd frontend
echo "REACT_APP_BACKEND_URL=https://api.kjapp.no" > .env.production
echo "REACT_APP_MODE=main" >> .env.production
echo "REACT_APP_DEV_NAV=false" >> .env.production
yarn build
# Deploy: build/ → kjapp.no (samme sti som PWA + native Capacitor)
```

### 2.2 Fleet Portal — fleet.kjapp.no

```bash
cd frontend
echo "REACT_APP_BACKEND_URL=https://api.kjapp.no" > .env.production
echo "REACT_APP_MODE=fleet" >> .env.production
echo "REACT_APP_DEV_NAV=false" >> .env.production
yarn build
mv build build-fleet
# Deploy: build-fleet/ → fleet.kjapp.no
```

### 2.3 Admin Console — admin.kjapp.no

```bash
cd frontend
echo "REACT_APP_BACKEND_URL=https://api.kjapp.no" > .env.production
echo "REACT_APP_MODE=admin" >> .env.production
echo "REACT_APP_DEV_NAV=false" >> .env.production
yarn build
mv build build-admin
# Deploy: build-admin/ → admin.kjapp.no
```

---

## 3. Emergent-plattformen (raskest)

Hvis du bruker Emergent-deploy, kjør 3 separate deploy-runder — én per subdomene. Send inn `REACT_APP_MODE` som miljøvariabel før hvert build.

Eller bruk **Vercel/Netlify multi-site setup**:
- Site 1: `kjapp.no`, env `REACT_APP_MODE=main`
- Site 2: `fleet.kjapp.no`, env `REACT_APP_MODE=fleet`
- Site 3: `admin.kjapp.no`, env `REACT_APP_MODE=admin`
- Alle sitene peker til **samme Git-repo, samme `frontend/`-mappe**

---

## 4. Backend (felles)

Backend endres IKKE. Ett backend på `api.kjapp.no` serverer alle tre apper via samme JWT-auth-flyt. CORS er åpen (`allow_origins=["*"]`).

Env-variabler backend (`/app/backend/.env`):
```
MONGO_URL=mongodb+srv://.../kjapp
DB_NAME=kjapp
JWT_SECRET=<sterkt secret her>
EMERGENT_LLM_KEY=sk-emergent-...
STRIPE_SECRET_KEY=sk_live_...
```

---

## 5. DNS-oppsett

I DNS-en din (Cloudflare / Namecheap / etc.):
- `kjapp.no` → A/AAAA → main-appens hostingtjener
- `fleet.kjapp.no` → CNAME/A → fleet-buildens hosting
- `admin.kjapp.no` → CNAME/A → admin-buildens hosting
- `api.kjapp.no` → CNAME/A → backend

Alle må ha gyldig HTTPS-sertifikat (Let's Encrypt via Cloudflare eller auto-managed på Emergent/Vercel/Netlify).

---

## 6. Ekstra sikkerhet på admin.kjapp.no

Anbefaling (ikke krav):
- Legg admin bak Cloudflare Access eller IP-hviteliste
- Sett `Strict-Transport-Security`, `X-Frame-Options DENY` headers
- Legg til 2FA i backend for admin-innlogging (backlog)

---

## 7. Native mobil-apper (Capacitor)

Native iOS/Android er bygget fra **main-appen** (`REACT_APP_MODE=main`). Fleet-eiere og admins bruker web-portalen kjapp/fleet/admin.kjapp.no fra en nettleser — ingen native app for dem.

Se `MOBILE_BUILD.md` for hvordan bygge iOS/Android av main.

---

## 8. Test-flyt for hvert domene

**kjapp.no** (main):
- `/` → onboarding
- `/login` → kunde/sjåfør velger rolle via demo-knapper
- `/app` → kart, booking (bruker: user)
- `/driver` → sjåfør-hjem (bruker: driver)

**fleet.kjapp.no** (fleet):
- `/login` → kun fleet_owner
- `/fleet` → oversikt (drivers online, dagens brutto)
- `/fleet/drivers` → sjåfør-liste
- `/fleet/payouts` → Excel-eksport + utbetalinger

**admin.kjapp.no** (admin):
- `/login` → kun admin/superadmin
- `/loyver` → løyvehaver-søknader (superadmin)
- `/loyver/applications/:id` → detaljert dokumentgjennomgang
- `/loyver/pending-drivers` → godkjenn sjåfører
- `/admin` → global dashboard (users, drivers, trips)

Feil rolle på feil app → auto-redirect til `/login` på det domenet.
