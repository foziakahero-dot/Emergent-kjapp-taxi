# KJAPP — Deployment Guide (3 separate apper fra ÉN deploy)

**Nyhet iter 20**: Du trenger ikke å bygge 3 separate builds lenger. Én kodebase, én Emergent-deploy — appen registrerer selv hvilket domene den serveres fra og bytter modus automatisk:

| Hostname | Modus | Ruter tilgjengelig | Roller lovlige |
|-----------|--------|--------------------|-----------------|
| `kjapp.no` (eller preview-URL) | **main** | `/`, `/login`, `/app/*`, `/driver/*`, `/apply`, `/loyver`, `/admin`, `/fleet/*` | Alle |
| `fleet.kjapp.no` | **fleet** | `/login`, `/apply`, `/fleet/*`, `/privacy`, `/terms` | fleet_owner |
| `admin.kjapp.no` | **admin** | `/login`, `/admin`, `/loyver/*`, `/privacy`, `/terms` | admin, superadmin |

Modus velges automatisk basert på (i prioritert rekkefølge):
1. `?mode=fleet` / `?mode=admin` i URL (for preview-testing) — lagres i localStorage
2. Hostname prefix (`fleet.*` → fleet, `admin.*` → admin)
3. Build-time env `REACT_APP_MODE=fleet|admin`
4. Default: `main`

---

## 1. Anbefalt vei (Emergent + DNS aliaser)

### Steg 1 — Deploy appen på Emergent
Trykk "Deploy" i Emergent-plattformen. Du får en produksjons-URL, f.eks. `kjapp-xyz.emergentagent.com`.

### Steg 2 — Legg til dine egne domener som CNAME
I DNS-panelet ditt (Cloudflare / Namecheap / Domeneshop):

```
kjapp.no          CNAME  kjapp-xyz.emergentagent.com   (proxied via Cloudflare)
fleet.kjapp.no    CNAME  kjapp-xyz.emergentagent.com   (proxied via Cloudflare)
admin.kjapp.no    CNAME  kjapp-xyz.emergentagent.com   (proxied via Cloudflare)
api.kjapp.no      CNAME  kjapp-xyz.emergentagent.com   (backend routes /api/*)
```

Alle 3 domener peker til **samme deployment**. Appen ser hostnamet og velger riktig modus.

### Steg 3 — Verifiser
- `https://fleet.kjapp.no/login` → viser "Flåte-eier innlogging" med kun fleet-demo-knapp synlig
- `https://admin.kjapp.no/login` → viser "Admin innlogging" med kun superadmin-demo-knapp synlig
- `https://kjapp.no/login` → viser vanlig login med alle 4 demo-knapper (kunde/sjåfør/flåte/admin)
- På fleet-domenet: prøv `/app` → auto-redirect til `/fleet` (irrelevante ruter blokkert)
- På admin-domenet: prøv `/fleet` → auto-redirect til `/loyver`

Om du kjører preview kan du teste modusene med URL-parameter:
- `https://<preview-url>/?mode=fleet` — bytter til fleet-modus midlertidig (lagres i localStorage)
- `https://<preview-url>/?mode=main` — tilbake til vanlig
- `https://<preview-url>/?mode=admin` — admin

---

## 2. Alternativ: 3 separate builds (Vercel / Netlify)

Om du ønsker HELT adskilte builds (mindre JS-bundle per site), bruk denne varianten:

### 2.1 Main (kjapp.no)
```bash
cd frontend
cat > .env.production << EOF
REACT_APP_BACKEND_URL=https://api.kjapp.no
REACT_APP_MODE=main
REACT_APP_DEV_NAV=false
EOF
yarn build
# Deploy build/ → kjapp.no
```

### 2.2 Fleet (fleet.kjapp.no)
```bash
cd frontend
cat > .env.production << EOF
REACT_APP_BACKEND_URL=https://api.kjapp.no
REACT_APP_MODE=fleet
REACT_APP_DEV_NAV=false
EOF
yarn build
mv build build-fleet
# Deploy build-fleet/ → fleet.kjapp.no
```

### 2.3 Admin (admin.kjapp.no)
```bash
cd frontend
cat > .env.production << EOF
REACT_APP_BACKEND_URL=https://api.kjapp.no
REACT_APP_MODE=admin
REACT_APP_DEV_NAV=false
EOF
yarn build
mv build build-admin
# Deploy build-admin/ → admin.kjapp.no
```

For Vercel: opprett 3 prosjekter med samme repo, ulik `REACT_APP_MODE` per prosjekt.
For Netlify: 3 sites, samme repo, ulik env per site.

**Merk**: Den anbefalte veien (§1) er enklere, spesielt om du bruker Emergent. Denne varianten er kun for de som vil spare 30-50KB JS per site.

---

## 3. Ekstra sikkerhet på admin.kjapp.no

Anbefalinger (ikke krav):

### 3.1 Cloudflare Access
Legg admin.kjapp.no bak Cloudflare Access → krev at kun spesifikke e-postadresser eller Google-arbeidsgruppe kan nå appen. Selv om admin-siden er offentlig (via CNAME), sees den bare av de du gir tilgang.

### 3.2 IP-hviteliste
Alternativt: I Cloudflare Firewall Rules, tillat kun IPer fra kontoret ditt for `hostname eq "admin.kjapp.no"`.

### 3.3 Security headers
Legg til på admin-domenet:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin
```

### 3.4 2FA på admin-innlogging (backlog P1)
Backend støtter foreløpig ikke 2FA. Trinn: Legg til TOTP-verifisering på `/api/auth/login` når `role === "admin" || "superadmin"`. Ta 4 timer å implementere med `pyotp`.

---

## 4. Backend (felles)

Backend er **kun én instans** på `api.kjapp.no`. Ingen endringer trengs når du deployer fleet/admin.

Env-variabler backend (`/app/backend/.env`):
```
MONGO_URL=mongodb+srv://.../kjapp
DB_NAME=kjapp
JWT_SECRET=<sterkt secret her>
EMERGENT_LLM_KEY=sk-emergent-...
STRIPE_SECRET_KEY=sk_live_...
STORAGE_KEY=<Emergent object storage key>
CORS_ORIGINS=https://kjapp.no,https://fleet.kjapp.no,https://admin.kjapp.no
```

Alle 3 domener bruker samme backend-API. CORS er allerede satt til `allow_origins=["*"]` for beta, men kan strammes til de 3 domenene i produksjon.

---

## 5. Native mobil-apper (Capacitor)

Native iOS/Android er bygget fra **main-appen** (`REACT_APP_MODE=main`). Fleet-eiere og admins bruker web-portalen fra en nettleser — ingen native app for dem.

Se `MOBILE_BUILD.md` for hvordan bygge iOS/Android av main.

---

## 6. Rask sanity-sjekk før du deployer

```bash
# 1. Verifiser at frontend bygger uten feil
cd frontend && yarn build

# 2. Verifiser at backend har alle env-vars
cd backend && python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('MONGO_URL:', bool(os.environ.get('MONGO_URL'))); print('JWT_SECRET:', bool(os.environ.get('JWT_SECRET'))); print('EMERGENT_LLM_KEY:', bool(os.environ.get('EMERGENT_LLM_KEY')));"

# 3. Kjør pytest for regresjon
cd backend && python -m pytest tests/ -x --tb=short -q
```

---

## 7. Deploy-checklist (før du trykker på knappen)

- [ ] `REACT_APP_DEV_NAV=false` i .env (skjuler kompass-knappen i prod)
- [ ] `REACT_APP_BACKEND_URL` peker til produksjons-backend
- [ ] Backend `.env` har `JWT_SECRET` som er sterkt (32+ tegn), IKKE default
- [ ] Backend `.env` har ekte `STRIPE_SECRET_KEY` (sk_live_...)
- [ ] MongoDB Atlas: hviteliste kun backend-serveren, IKKE 0.0.0.0/0
- [ ] Personvern (`/privacy`) og vilkår (`/terms`) er fylt ut på norsk
- [ ] Alle 4 test-kontoer er kastet ut / passord byttet før live launch
- [ ] SendGrid-nøkkel satt om e-post skal fungere
- [ ] Skatteetaten ARS-godkjenning på plass (kritisk for kommersiell lansering i Norge)
