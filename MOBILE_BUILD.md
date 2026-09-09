# KJAPP — native mobil-bygg og push (Capacitor)

> Emergent kan publisere APK/iOS direkte **kun for Expo/React Native-apper**. KJAPP er en Capacitor-app,
> så selve APK/IPA-bygget kjøres på din egen Mac/PC (eller i Xcode Cloud / GitHub Actions).
> Alt annet — push, tillatelser, ikoner, splash, deep links, kanaler — er ferdig konfigurert i repoet.

## 0. Forutsetninger på din maskin
- Node **22+** (containeren her har Node 20, derfor bygges native lokalt)
- Android: Android Studio + JDK 17
- iOS: macOS + Xcode 15+ og en Apple Developer-konto (99 USD/år for App Store/TestFlight)

## 1. Bygg web-laget og synk til native
```bash
cd frontend
# Pek appen mot produksjons-API (viktig: dette bakes inn i APK/IPA)
REACT_APP_BACKEND_URL=https://api.kjappapp.no yarn build
npx cap sync
```

## 2. Android
```bash
npx cap open android      # åpner Android Studio
# Build > Generate Signed App Bundle / APK  → lag keystore første gang
```
- Pakkenavn: `no.kjapp.app`
- Tillatelser (allerede i `AndroidManifest.xml`): INTERNET, ACCESS_FINE/COARSE/BACKGROUND_LOCATION,
  POST_NOTIFICATIONS, WAKE_LOCK, VIBRATE, FOREGROUND_SERVICE(_LOCATION)
- Varselkanal `kjapp_trips` (høy prioritet, lyd + vibrasjon) opprettes automatisk av appen.

## 3. iOS
```bash
npx cap open ios          # åpner Xcode
```
I Xcode: velg Team under *Signing & Capabilities* → legg til **Push Notifications** og
**Background Modes** (Remote notifications + Location updates er allerede i `Info.plist`).
`App.entitlements` ligger klar med `aps-environment = development` (Xcode bytter til `production` for release).
Arkivér: *Product > Archive* → Distribute til TestFlight.

## 4. Native push (FCM for Android, APNs for iOS) — dette må DU opprette

Backend er klar og **nøkkel-valgfri**: `GET /api/push/native-config` svarer
`{"enabled": false, ...}` til nøklene finnes. Push virker i det sekundet nøkkelen er satt.

### 4a. Firebase-prosjekt (gratis)
1. Gå til https://console.firebase.google.com → **Add project** → navn «KJAPP».
2. **Add app → Android**: pakkenavn `no.kjapp.app` → last ned **`google-services.json`**
   → legg filen i `frontend/android/app/google-services.json`.
3. **Add app → iOS**: bundle ID `no.kjapp.app` → last ned **`GoogleService-Info.plist`**
   → dra den inn i Xcode-prosjektet (App-target, «Copy items if needed»).
4. **Project settings → Service accounts → Generate new private key** → laster ned en JSON-fil.
   Dette er backend-nøkkelen (hemmelig — skal ALDRI i git eller chat).

### 4b. iOS: koble APNs til Firebase
1. https://developer.apple.com → Certificates, Identifiers & Profiles → **Keys** → «+»
   → aktiver **Apple Push Notifications service (APNs)** → last ned **`.p8`**-filen.
   Noter **Key ID** og **Team ID**.
2. Firebase → Project settings → **Cloud Messaging** → *Apple app configuration* →
   last opp `.p8` + Key ID + Team ID.

### 4c. Sett nøkkelen i backend-miljøet
Legg hele service-account-JSON-innholdet på én linje i `backend/.env`:
```
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"kjapp-...", ...}
```
(alternativt `FCM_SERVICE_ACCOUNT_FILE=/app/backend/secrets/fcm.json`)
Restart backend. Verifiser:
```bash
curl -s $REACT_APP_BACKEND_URL/api/push/native-config      # {"enabled": true, ...}
```

### 4d. Test på ekte telefon
1. Installer appen, logg inn som sjåfør, trykk **«Få turer på låst skjerm»** → godkjenn varsler.
   (Appen sender device-token til `POST /api/push/native-subscribe`.)
2. Lås telefonen. Bestill en tur fra kundeappen.
3. Telefonen skal vekkes med «Ny tur · X kr til deg» + «Se turen» → åpner sjåførappen på turen.

## 5. Hva push brukes til i dag
| Hendelse | Mottaker | Tittel |
|---|---|---|
| Ny turforespørsel (nærmeste sjåfør først) | sjåfør | «Ny tur · X kr til deg» |
| Sjåfør godtok turen | kunde | «Sjåføren er på vei» |
| Sjåfør fremme / tur startet / fullført | kunde | statusvarsel |

## 6. Sikkerhet
- `FCM_SERVICE_ACCOUNT_JSON`, `.p8`-filer og keystore skal **kun** ligge i miljøvariabler / lokalt.
- `.gitignore` dekker `*service-account*.json`, `**/*.p8`, `*.keystore`, `*.jks`.
