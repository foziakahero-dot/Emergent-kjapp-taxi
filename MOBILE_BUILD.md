# KJAPP mobile — build og release

KJAPP mobile består nå av **to separate Expo / React Native-apper**. Den gamle Capacitor-buildflyten er historisk og skal ikke brukes for nye builds.

## Apper

| App | Mappe | Android | iOS | Expo project |
| --- | --- | --- | --- | --- |
| KJAPP Customer | `frontend/` | `no.kjapp.app` | `no.kjapp.app` | `3631002e-5b25-4847-b5d8-05ec2ef304b5` |
| KJAPP Driver | `driver-app/` | `no.kjapp.driver` | `no.kjapp.driver` | `1dec8949-0423-4fbf-a080-0703f93519d7` |

Den kontrollerte **betaen/TestFlight** bruker fortsatt den kjente Emergent-backenden:

`https://github-app-builder-28.emergent.host/api`

Den langsiktige produksjonsprofilen er allerede konfigurert mot KJAPPs permanente API-navn:

`https://api.kjappapp.no`

`api.kjappapp.no` skal først peke til en verifisert backend før offentlig store-release. Selve backend-migreringen bort fra Emergent gjøres separat etter beta-stabilisering.

Admin, Fleet og backend er separate systemer og skal ikke pakkes inn i mobilappene.

## Forutsetninger

- Node 22+
- Expo / EAS-konto med tilgang til de to project ID-ene over
- Apple Developer-konto for signert iOS/TestFlight
- Google Play-konto for Play Store
- Firebase-konfigurasjon for FCM dersom direkte native push skal brukes på Android

## Lokal kontroll

Customer:

```bash
cd frontend
npm install
npx expo config --type public
npx tsc --noEmit
npx expo start
```

Driver:

```bash
cd driver-app
npm install
npx expo config --type public
npx tsc --noEmit
npx expo start
```

Bakgrunnsposisjon og native push må testes i en development build / installert APK eller IPA, ikke bare Expo Go.

## Lokal full beta-gate på Windows

Når GitHub Actions ikke starter jobs, kan den samme kildekodekontrollen kjøres lokalt fra repo-roten uten å deploye eller endre produksjonsdata:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\beta_local_gate.ps1
```

Scriptet krever at aktiv branch er `beta/oslo-production-ready` og kjører:
- `git diff --check`
- Python compile
- fokuserte sikkerhets-unit-tester
- Admin build
- Marketing build
- Customer TypeScript + Expo Doctor + Expo config
- Driver TypeScript + Expo Doctor + Expo config

Det gjør **ikke** merge, deploy, Stripe-trekk eller produksjonsendringer.

## Android test-APK

Customer:

```bash
cd frontend
eas build --platform android --profile apk
```

Driver:

```bash
cd driver-app
eas build --platform android --profile apk
```

Begge appene har også EAS workflows under `.eas/workflows/build-apk.yml` som kan bygge APK fra `main`.

## Produksjonsbuild

Customer:

```bash
cd frontend
eas build --platform android --profile production
eas build --platform ios --profile production
```

Driver:

```bash
cd driver-app
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Native push

Mobilklientene bruker `expo-notifications` og registrerer **Expo Push tokens** mot:

`POST /api/push/native-subscribe`

Dette gir ekte native varsler: Expo Push leverer videre via **APNs på iOS** og **FCM på Android**. Backenden kan fortsatt sende til eldre direkte FCM-tokens, men nye Customer/Driver-builds bruker Expo-token slik at iOS ikke feilaktig behandles som et FCM-token.

På iOS må APNs/push-capability være knyttet til riktige bundle-ID-er og EAS/Apple credentials. På Android må FCM være konfigurert for riktig Expo/Firebase-prosjekt før butikk-release.

Driver har i tillegg en on-shift fallback: mens bakgrunnsposisjon kjører, kontrolleres ekte pending trips og en lokal varsling kan vises ved nytt tilbud. Native push er fortsatt primær kanal.

## Apple Developer / TestFlight

Kontoen skal ha to eksplisitte App IDs:

- Customer: `no.kjapp.app`
- Driver: `no.kjapp.driver`

Aktiver capabilities slik:

**Customer**
- Push Notifications
- Sign in with Apple

**Driver**
- Push Notifications
- Background Modes / Location (genereres av Expo config)
- Background remote notifications

Customer-appen har `ios.usesAppleSignIn=true` og bruker Apples native Sign in with Apple-komponent. Backenden godtar native Apple-token med `aud=no.kjapp.app` når følgende finnes i backend-miljøet:

```
APPLE_BUNDLE_ID=no.kjapp.app
```

For web-basert Apple-innlogging senere kan `APPLE_CLIENT_ID` (Services ID) legges til separat.

En APNs auth key (.p8) kan brukes gjennom EAS credentials for begge appene dersom Apple-kontoen/Teamet tillater det. Ikke legg .p8-filen i Git.

### Første Apple/EAS-kobling

Kjør dette separat i hver appmappe med din egen Expo/Apple-innlogging:

```bash
cd frontend
npx eas-cli@latest credentials -p ios

cd ../driver-app
npx eas-cli@latest credentials -p ios
```

La EAS knytte riktige distribution/provisioning/APNs-credentials til bundle-ID-en for den aktuelle appen. Apple-passord, .p8-fil og private nøkler skal aldri limes inn i kode, chat eller Git.

Når credentials er klare kan kontrollert TestFlight-build kjøres:

```bash
cd frontend
npx eas-cli@latest build --platform ios --profile testflight-beta

cd ../driver-app
npx eas-cli@latest build --platform ios --profile testflight-beta
```

Etter en vellykket signert build:

```bash
npx eas-cli@latest submit --platform ios --profile production --latest
```

Alternativt kan den manuelle GitHub-workflowen `KJAPP signed iOS EAS build` bygge Customer, Driver eller begge. Den krever GitHub-secret `EXPO_TOKEN`; selve Apple-signeringen må allerede være konfigurert i EAS.

### Direkte EAS Workflows — anbefalt før merge

Fordi de nye GitHub `workflow_dispatch`-filene først er fullt tilgjengelige fra default branch og GitHub Actions for tiden har et startup-problem, kan signert beta bygges **direkte i EAS** fra denne branchen etter at Apple/EAS credentials er konfigurert.

Customer -> build + TestFlight:

```bash
cd frontend
npx eas-cli@latest workflow:run .eas/workflows/testflight-beta.yml
```

Driver -> build + TestFlight:

```bash
cd driver-app
npx eas-cli@latest workflow:run .eas/workflows/testflight-beta.yml
```

Disse workflowene bruker `testflight-beta`-profilen og den nåværende Emergent beta-API-en. De merger eller deployer ikke backend.

Android APK kan på samme måte kjøres direkte i EAS:

```bash
cd frontend
npx eas-cli@latest workflow:run .eas/workflows/customer-apk.yml

cd ../driver-app
npx eas-cli@latest workflow:run .eas/workflows/build-apk.yml
```

## Automatisk betaling etter tur

Kodebanen for Bolt/Uber-lignende automatisk kortbetaling er implementert, men er **av som standard**.

Aktiver først etter Stripe test-E2E og eksplisitt beta-beslutning:

```
KJAPP_AUTO_CHARGE_ENABLED=true
```

Flyt:
- bruker legger til/verifiserer kort via Stripe Setup
- turen avsluttes
- backend forsøker en idempotent off-session PaymentIntent mot det lagrede kortet
- ved success: turens `payment_status=paid`, kvittering/push sendes
- ved bank/3DS-krav eller feil: forsøket fullføres ikke, og kunden faller tilbake til eksisterende sikre Stripe Checkout fra kvitteringen
- ride lifecycle `status` endres aldri av betalingshendelsen

Ikke aktiver dette med live Stripe-nøkler før testkort/Connect/webhook/idempotency er verifisert.

## Driver pickup / no-show sikkerhetsgrenser

Backend håndhever disse grensene selv; UI-knapper kan ikke omgå dem:

```
KJAPP_PICKUP_ARRIVAL_RADIUS_M=400
KJAPP_NO_SHOW_WAIT_MINUTES=5
```

- Sjåføren må ha fersk GPS og være innenfor radiusen før «Jeg er fremme» godtas.
- «Start turen» krever at turen allerede er i `at_pickup`.
- No-show kan først registreres etter ventetiden regnet fra serverens registrerte ankomsttid.
- Verdiene kan justeres uten app-release.

## Oslo beta serviceområde

Backenden har en launch-gate for **hentested**. Destinasjonen kan fortsatt være utenfor sonen.

Aktiver i Emergent beta/produksjonsmiljøet:

```
KJAPP_SERVICE_AREA_ENFORCE=true
KJAPP_SERVICE_AREA_CENTER_LAT=59.9139
KJAPP_SERVICE_AREA_CENTER_LNG=10.7522
KJAPP_SERVICE_AREA_RADIUS_KM=45
```

Radiusen er konfigurerbar uten kodeendring. `GET /api/service-area` viser aktiv konfigurasjon.
Når `KJAPP_SERVICE_AREA_ENFORCE=false` er funksjonen bygget, men ingen bestilling blokkeres.

## Bakgrunnsposisjon — Driver

Driver bruker `expo-location` + `expo-task-manager`.

Når backend sier at sjåføren er online:
- foreground GPS fortsetter å oppdatere UI
- native background location startes etter tillatelse
- Android bruker foreground location service
- posisjon sendes til `/api/driver/location`

Når sjåføren går offline eller logger ut, background location stoppes.

## Release-regler

1. Ikke merge mobilendringer til `main` uten at Customer og Driver er typechecket og Expo-configen kan genereres.
2. Kunde og Driver releases separat. De kan installeres samtidig fordi de har ulike bundle/package IDs.
3. Ikke legg test-/demo-data inn i mobil-UI som om det var ekte drift.
4. Ikke endre backend-arkitektur fra FastAPI + MongoDB som del av en mobilrelease.
5. KJAPP-standardprovisjon er 10%; mobilklient skal lese faktisk backend-verdi og aldri falle tilbake til gammel 20%-verdi.
6. Test alltid minst én komplett flyt før beta-release: Customer bestiller → Driver mottar → aksepterer → fremme → start → fullfører → Customer ser kvittering.

## Før butikk-release

Verifiser på fysiske enheter:
- login / rolleavvisning
- lokasjonstillatelser
- sjåfør online/offline
- bakgrunns-GPS med skjermen låst
- ny-tur-varsel med skjermen låst
- booking og dispatch
- aktiv tur etter app-restart
- chat kunde ↔ sjåfør
- betaling / betalingsstatus
- rating og turhistorikk
- GDPR eksport/sletting
- deep links fra push

Denne filen erstatter den gamle Capacitor-guiden.
