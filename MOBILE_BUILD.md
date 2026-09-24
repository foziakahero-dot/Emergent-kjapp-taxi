# KJAPP mobile — build og release

KJAPP mobile består nå av **to separate Expo / React Native-apper**. Den gamle Capacitor-buildflyten er historisk og skal ikke brukes for nye builds.

## Apper

| App | Mappe | Android | iOS | Expo project |
| --- | --- | --- | --- | --- |
| KJAPP Customer | `frontend/` | `no.kjapp.app` | `no.kjapp.app` | `3631002e-5b25-4847-b5d8-05ec2ef304b5` |
| KJAPP Driver | `driver-app/` | `no.kjapp.driver` | `no.kjapp.driver` | `1dec8949-0423-4fbf-a080-0703f93519d7` |

Begge bruker samme produksjonsbackend:

`https://github-app-builder-28.emergent.host/api`

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
