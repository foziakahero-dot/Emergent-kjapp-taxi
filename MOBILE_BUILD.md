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

Mobilklienten bruker `expo-notifications` og registrerer native APNs/FCM-token mot:

`POST /api/push/native-subscribe`

Backenden har allerede native push-sender. For faktisk FCM-levering på Android må Firebase være riktig konfigurert for app-ID-ene og serveren må ha gyldig Firebase service-account-konfigurasjon. Ikke legg private service-account-nøkler i Git.

`google-services.json` er klientkonfigurasjon og må høre til riktig Firebase Android-app. Når den brukes med EAS/CNG, sett `android.googleServicesFile` til riktig filbane i app-configen.

På iOS må APNs/push-capability være knyttet til de riktige bundle-ID-ene og EAS/Apple credentials.

Driver har i tillegg en on-shift fallback: mens bakgrunnsposisjon kjører, kontrolleres ekte pending trips og en lokal varsling kan vises ved nytt tilbud. FCM/APNs er fortsatt primær kanal.

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
5. KJAPP-standardprovisjon er 12%; mobilklient skal lese faktisk backend-verdi og aldri falle tilbake til gammel 20%-verdi.
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
