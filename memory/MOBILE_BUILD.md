# KJAPP — Native App Build Guide (iOS + Android)

Denne guiden pakker KJAPP-PWA-en som native app for App Store og Google Play ved hjelp av **Capacitor**. Hele denne prosessen gjøres på din egen Mac (iOS krever Xcode).

---

## 1. Forutsetninger

**iOS (App Store)**:
- Mac med macOS 13+ og Xcode 15+
- Apple Developer Program-medlemskap: **$99/år** — [developer.apple.com](https://developer.apple.com/programs/)
- Aktivert to-faktor-autentisering på Apple ID

**Android (Google Play)**:
- Android Studio (Windows, Mac eller Linux)
- Google Play Console-konto: **$25 engangs** — [play.google.com/console](https://play.google.com/console/)

**Begge**:
- Node.js 20+, Yarn
- Git

---

## 2. Første oppsett (kjøres én gang)

Klon eller last ned KJAPP-koden til Mac-en din, gå inn i `/frontend`-mappen:

```bash
cd frontend

# Bygg PWA-en først
yarn install
yarn build

# Legg til Capacitor
yarn add @capacitor/core @capacitor/cli
yarn add @capacitor/ios @capacitor/android
yarn add @capacitor/splash-screen @capacitor/status-bar @capacitor/geolocation @capacitor/push-notifications @capacitor/haptics

# Initialiser Capacitor (bruk konfig fra /app/mobile/capacitor.config.json)
cp ../mobile/capacitor.config.json ./capacitor.config.json

# Legg til iOS + Android som "platforms"
npx cap add ios
npx cap add android

# Kopier build inn i native-prosjektene
npx cap sync
```

---

## 3. Bygg iOS-app (APP STORE / TESTFLIGHT)

```bash
npx cap open ios
```

Xcode åpner. Gjør følgende:

1. **Signing & Capabilities** (venstremeny → App → Signing):
   - Sett `Team` til din Apple Developer-konto
   - `Bundle Identifier`: `no.kjapp.app` (må matche `capacitor.config.json`)
   - Aktiver `Automatically manage signing`

2. **Legg til Info.plist-nøkler** (App → Info → Custom iOS Target Properties):
   - `NSLocationWhenInUseUsageDescription` = "KJAPP trenger posisjonen din for å finne nærmeste sjåfør"
   - `NSLocationAlwaysAndWhenInUseUsageDescription` = "Sjåfør-appen sender posisjonen din under aktive turer"
   - `NSCameraUsageDescription` (hvis vi legger til foto-verifisering senere)

3. **Legg til Capabilities**:
   - `Push Notifications` (App → Signing & Capabilities → + Capability)
   - `Sign in with Apple` (hvis du skal aktivere Apple Sign In — krever `APPLE_CLIENT_ID` i backend .env)
   - `Background Modes` → aktiver `Location updates` + `Remote notifications`

4. **App-ikon**: Dra ikonene inn i `Assets.xcassets/AppIcon` (1024×1024 base + alle størrelser)

5. **Kjør på simulator**: velg iPhone 15 Pro → trykk ▶

6. **Bygg for TestFlight**:
   ```
   Product → Archive
   ```
   Ferdig arkiv → `Distribute App` → `App Store Connect` → `Upload`
   Logg deretter inn på [App Store Connect](https://appstoreconnect.apple.com/) → TestFlight → Add testers

7. **Submit for review** (fra App Store Connect):
   - Fyll ut app-beskrivelse (norsk + engelsk)
   - Legg ved 6.7"/6.5"/5.5" iPhone-skjermbilder
   - Personvernerklæring URL: `https://kjapp.no/privacy`
   - Test-konto til Apple: `ola@kjapp.no` / `test1234`
   - Review-tid: 24-72 timer

---

## 4. Bygg Android APK/AAB (GOOGLE PLAY)

```bash
npx cap open android
```

Android Studio åpner. Gjør følgende:

1. **Endre app-versjon** (`android/app/build.gradle`):
   ```groovy
   defaultConfig {
       applicationId "no.kjapp.app"
       versionCode 1
       versionName "1.0.0"
   }
   ```

2. **Legg til permissions** (`android/app/src/main/AndroidManifest.xml`):
   ```xml
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   <uses-permission android:name="android.permission.WAKE_LOCK" />
   <uses-permission android:name="android.permission.VIBRATE" />
   ```

3. **Signer AAB**:
   - Build → Generate Signed Bundle / APK → Android App Bundle
   - Opprett keystore (kun første gang, TA VARE PÅ .jks-filen og passordet)
   - Alias: `kjapp-release`
   - `release` variant → Finish

4. **Ferdig AAB** ligger i `android/app/release/app-release.aab`

5. **Last opp til Play Console**:
   - [play.google.com/console](https://play.google.com/console/) → Ny app
   - App-innhold: fyll ut alt (personvern, kategori, målgruppe, annonser)
   - App-utgivelser → Intern testing → last opp AAB
   - Test i 1 uke med interne testere
   - Deretter: Closed Testing → Production

---

## 5. Oppdatere appen etter kodendringer

```bash
yarn build              # rebuild PWA
npx cap sync            # synk til native
npx cap open ios        # eller android
# Deretter Archive/Build → last opp ny versjon
```

**Viktig**: For hver nye release må `versionCode` (Android) og `Build` (iOS) inkrementeres.

---

## 6. Push-varsler (native)

Web Push (den nåværende implementasjonen) fungerer i PWA-modus, men native apper trenger:

- **iOS**: APNs (Apple Push Notification Service) via `@capacitor/push-notifications`
- **Android**: Firebase Cloud Messaging (FCM)

Backend-endepunktet `/api/push/subscribe` må utvides til å ta imot native token i tillegg til web-push subscription:

```js
// I frontend, når native
import { PushNotifications } from '@capacitor/push-notifications';

PushNotifications.register();
PushNotifications.addListener('registration', (token) => {
  // Send token.value til backend
  api.post('/push/native-subscribe', { platform: Capacitor.getPlatform(), token: token.value });
});
```

Backend må lagre disse i egen kolleksjon og sende via Firebase Admin SDK (Android) og APNs HTTP/2 (iOS). Dette er en **egen oppgave** som ikke er dekket i grunn-wrappingen.

---

## 7. Kritiske ting å huske

- **Backend-URL må være HTTPS med gyldig sertifikat** — native apper avviser selvsignerte
- **REACT_APP_BACKEND_URL** må peke til produksjon-URL (kjapp.no) før release
- **Alle push-nøkler (VAPID)** må være permanente — hvis backend blir re-deployet mister eksisterende brukere push-abonnement
- **Norske drosjekrav**: Skatteetaten ARS-godkjenning MÅ være på plass før kommersiell lansering — start den prosessen NÅ (2-6 uker saksbehandling)
- **App Store-avvisning**: 90% av avvisninger skyldes: manglende personvern, uklar bruk av lokasjon, eller manglende Apple Sign In når Google Sign In er implementert (Apple regel 4.8). Vi har Apple Sign In stubbet — MÅ aktiveres før iOS-release

---

## 8. Tidsestimat

| Steg | Tid | Kostnad |
|---|---|---|
| Apple Developer-registrering | 1-2 dager | $99 |
| Google Play-registrering | 3-5 dager | $25 |
| Første Xcode-oppsett + APK-build | 4-8 timer | 0 |
| App-ikoner + skjermbilder | 4 timer | 0 |
| Personvern + vilkår | ✅ (allerede laget) | 0 |
| Apple Sign In-aktivering | 2 timer (etter APPLE_CLIENT_ID) | 0 |
| Native push-varsel (APNs + FCM) | 8-16 timer | 0 |
| Skatteetaten ARS-godkjenning | 2-6 uker | Egen søknad |
| App Store review | 1-3 dager | 0 |
| Google Play review | 1-2 dager | 0 |

**Realistisk lansering**: 3-5 uker fra i dag (forutsatt at ARS-godkjenning ikke er blokker)
