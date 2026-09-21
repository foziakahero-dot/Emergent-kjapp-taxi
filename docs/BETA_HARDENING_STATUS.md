# KJAPP Beta Hardening — kanonisk status

Oppdatert: 2026-09-21

Denne filen er fasit for beta-hardening. Ikke bruk gamle Codex-/mobilgrener som sannhetskilde.
Arbeidet i denne pakken er basert direkte på `main@66d85b847b4054c3eb9d118f92f6bd750fbfbc91`
og ligger i `hardening/beta-p0-p1-p2-20260921` / PR #42.

## Branch / build-fakta

- Canonical base: `main@66d85b84`
- Hardening branch er opprettet direkte fra denne main-SHA-en.
- Gamle grener som `codex/kjapp-signature-mainline`, `Nyeste-mobil-klar-`,
  `Apk-iOS-`, `fix/mobile-final-hardening` og `fix/mobile-production-recovery`
  skal ikke merges wholesale.
- Web-previewene (Admin, Fleet, Home, Netlify) er grønne på hardening-grenen.
- GitHub Actions har separat `startup_failure` før runner/job opprettes. Dette er ikke
  dokumentasjon på TypeScript-/Gradle-feil.
- Driver sitt eget Expo/GitHub-root har historisk ikke sendt build-checks. Canonical Customer
  EAS-workflow inneholder derfor en Driver bridge som validerer og bygger `../driver-app`.
- En grønn EAS-build er ikke bevis på at startup-crashen er løst. Fysisk cold launch må passere.

---

## 🔴 P0 — kritisk før beta

### 1. Driver startup hardening — IMPLEMENTERT
Filer:
- `driver-app/app/_layout.tsx`
- `driver-app/src/lib/nativeRuntime.ts`
- `driver-app/src/context/AuthContext.tsx`

Status:
- Notification response init etter autentisert driver.
- Native init er try/catch-beskyttet.
- Background location starter kun når driver er eksplisitt godkjent og backend sier online.
- `TaskManager.defineTask` forblir globalt, men starter ikke location updates ved import.
- Pending driver får push/compliance-status, men ingen GPS/tur-runtime.

### 1B. Customer startup hardening — IMPLEMENTERT / FYSISK TEST GJENSTÅR
Filer:
- `frontend/index.js`
- `frontend/app/_layout.tsx`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/lib/nativeRuntime.ts`

Status:
- Push-init auth-gatet.
- Auth bootstrap fail-safe.
- Sentry lastes ikke uten DSN og kan ikke blokkere startup.
- Expo Router root ErrorBoundary lagt inn.
- Før innlogging/onboarding gjøres ingen kart-/backend-/GPS-kall.
- Må fortsatt bekreftes med ny fysisk APK. Hvis prosessen lukkes: bruk `adb logcat`.

### 2. Trip state machine — IMPLEMENTERT
Backend:
- `TRIP_ALLOWED_TRANSITIONS`
- `_transition_trip(...)`

Sikret:
- `arrived -> completed` kun atomisk.
- customer cancel er atomisk og kan ikke race mot trip start.
- driver at-pickup/start/arrive/no-show/cancel bruker state guards.
- passenger rating normaliserer `arrived -> completed -> rated`.
- driver rating er blokkert før turen er ferdig.
- Stripe kan ikke tvinge aktiv/rated tur til `completed`.

### 3. Driver approval krever validerte dokumenter — IMPLEMENTERT
Påkrevde typer:
- `drivers_license`
- `taxi_license`
- `police_certificate`
- `profile_photo`

Både `/admin/drivers/{id}/approve` og `/set-status` returnerer 409 med konkret mangelliste.
`require_driver()` krever eksplisitt `approved is True`.

### 4. Android FCM — KODE FERDIG, CREDENTIALS EKSTERNT GJENSTÅR
Filer:
- `frontend/app.config.js`
- `driver-app/app.config.js`
- `docs/FCM_SETUP.md`
- `backend/.env.example`

Krav før native push kan verifiseres:
- Firebase Android app `no.kjapp.app`
- Firebase Android app `no.kjapp.driver`
- app-spesifikke `google-services.json`
- EAS file variable `GOOGLE_SERVICES_JSON`
- FCM V1 service account
- backend `FCM_PROJECT_ID` må matche service account project_id.

Private credentials skal aldri committes.

### 5. Politiattest — IMPLEMENTERT
Driver signup, backend upload, brukerrecord, admin review og approval-gate støtter
`police_certificate`.

### 6. JWT -> SecureStore — IMPLEMENTERT
- Auth-token `kjapp_token` ligger i Expo SecureStore på native.
- Gammel AsyncStorage-token migreres én gang.
- Ikke-sensitive verdier forblir i AsyncStorage.

---

## 🟠 P1 — tidlig beta

### 7. Prisvisning / misvisende serviceavgift — IMPLEMENTERT
Backend skiller:
- `customer_total`
- `service_fee_amount`
- `fleet_net`
- `platform_fee_rate`

Customer sier at plattformandelen er inkludert og at ingen ekstra avgift legges oppå totalen.

### 8. Ventetidspris — IMPLEMENTERT
- Default gratis ventetid: 2 min.
- Venting måles server-side fra `at_pickup_at` til `trip_started_at`.
- `waiting_minutes * waiting_per_minute` legges på sluttpris.
- Klienten bestemmer aldri betalbar ventetid.

### 9. Admin live-map alle biler — IMPLEMENTERT
`GET /admin/live` returnerer:
- `fresh_online`
- `stale_online`
- `offline_with_last_location`
- `never_seen`

Admin-kartet viser de tre første med ulik stil. `never_seen` listes, men kan naturlig nok ikke plasseres uten koordinater.

### 10. Manuell driver-onboarding — IMPLEMENTERT
Admin kan prefill:
- navn
- e-post
- telefon
- førerkortnummer
- løyve/kjøreseddelnummer
- bil
- registreringsnummer
- kjøretøytype
- notat

Driver kan kontrollere/redigere data før innsending.

### 11. Varsel ved dokumentreview — IMPLEMENTERT
- Push ved valid/rejected/pending.
- E-post ved avslag med begrunnelse.
- Driver har egen `/driver-status`-skjerm med fire dokumentstatuser.
- Pending driver får ikke GPS/turer før approval.

### 12. KJAPP_PUBLIC_URL / invite smoke — IMPLEMENTERT
Default:
`https://fleet.kjappapp.no`

Filer:
- `backend/scripts/smoke_driver_invite_url.py`
- `.github/workflows/driver-invite-url-smoke.yml`

### 13. Vipps skjult — IMPLEMENTERT
Backend returnerer `enabled:false` til hele Vipps payment-lifecycle er implementert.
Customer filtrerer bort Vipps når disabled.

### 14. Passord >= 10 + obligatorisk 2FA — IMPLEMENTERT
10 tegn:
- backend auth
- Customer signup
- Driver signup
- Fleet reset

2FA obligatorisk:
- admin
- superadmin
- fleet_owner

Fleet Partner støtter både:
- 2FA login challenge
- obligatorisk førstegangs QR-setup + backup codes

---

## 🟡 P2

### 15. Sentry — IMPLEMENTERT, DSN/ORG/PROJECT EKSTERNT
- `@sentry/react-native`
- custom `index.js` før Expo Router
- Sentry lastes bare når DSN finnes
- init fail-open
- Metro config finnes
- source map credentials må settes i deploy/EAS.

### 16. Release gate — IMPLEMENTERT
`scripts/release_gate.sh`

Default:
- Customer Expo config + tsc
- Driver Expo config + tsc
- Admin build
- Fleet build
- deterministiske backend unit-regresjoner

Med `RUN_STAGING_E2E=1`:
- ekte staging ride flow gjennom `backend/scripts/e2e_driver_flow.py`

Fysisk device-gate kan ikke simuleres bort og må kjøres etter APK/IPA installasjon.

### 17. Auth bootstrap fail-safe — IMPLEMENTERT
Begge mobilapper:
- outer try/catch/finally
- Linking-init beskyttet
- SecureStore-feil kan ikke henge splash
- logout er best-effort server revoke + alltid lokal cleanup.

### 18. NetInfo — IMPLEMENTERT
Begge mobilapper:
- `@react-native-community/netinfo`
- banner ved offline
- eksisterende polling/retry fortsetter når nett kommer tilbake.

### 19. Standardisert state transitions — IMPLEMENTERT FOR KJERNEFLYT
Felles state map brukes på kritiske ride transitions og alle farlige bypass funnet i audit er lukket.
Payment-state holdes separat fra ride-state.

---

## Database-migrasjon

KJAPP bruker MongoDB, ikke Supabase/Postgres, i dette systemet.
Derfor er riktig migrasjon et Mongo-script — ikke SQL:

`backend/scripts/migrate_driver_compliance.py`

Dry-run:
```bash
python backend/scripts/migrate_driver_compliance.py
```

Apply:
```bash
python backend/scripts/migrate_driver_compliance.py --apply
```

---

## Final beta gate

Før merge/release:

1. Canonical mobile validation må være grønn.
2. Customer APK cold-launch på fysisk Android.
3. Driver APK cold-launch på fysisk Android.
4. Customer login/GPS/estimate/booking.
5. Driver pending account -> document status.
6. Godkjent Driver -> online -> offer -> accept -> pickup -> start -> arrive.
7. Payment/receipt/rating.
8. Locked-screen push etter ekte FCM credential setup.
9. Background/foreground recovery.
10. Ingen `FATAL EXCEPTION` i logcat.

Hvis Customer fortsatt lukker seg:
```bat
adb logcat -c
:: start KJAPP og la den krasje
adb logcat -v time | findstr /I "FATAL EXCEPTION AndroidRuntime ReactNativeJS ExpoModulesCore no.kjapp.app"
```

Runtime-crashen skal aldri erklæres løst kun fordi EAS/Gradle er grønn.
