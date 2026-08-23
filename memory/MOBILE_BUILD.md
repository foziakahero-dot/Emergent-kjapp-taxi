# KJAPP — Native App Build Guide (iOS + Android)

**Status per Iter 18 (Feb 2026)**: Native prosjektene er allerede generert i `/app/frontend/ios/` og `/app/frontend/android/`. Capacitor v8 + Node v22 er installert. Du trenger bare å åpne prosjektene på din egen Mac/PC for å bygge og signere.

---

## 1. Forutsetninger

**iOS (App Store)**:
- Mac med macOS 13+ og Xcode 15+
- Apple Developer Program-medlemskap: **$99/år** — [developer.apple.com](https://developer.apple.com/programs/)
- Aktivert to-faktor-autentisering på Apple ID
- CocoaPods (`sudo gem install cocoapods`)

**Android (Google Play)**:
- Android Studio (Windows, Mac eller Linux)
- Google Play Console-konto: **$25 engangs** — [play.google.com/console](https://play.google.com/console/)
- JDK 17+ (leveres med Android Studio)

**Begge**:
- Node.js **22+** (viktig — Capacitor 8 krever dette)
- Yarn
- Git

---

## 2. Overføre koden til din Mac/PC

Klon eller last ned KJAPP-koden. Alt du trenger ligger allerede i `/frontend`:

```bash
cd frontend
yarn install
yarn build
npx cap sync
```

Prosjektene ligger klare i:
- iOS: `frontend/ios/App/App.xcworkspace`
- Android: `frontend/android/`

---

## 3. Bygg iOS-app (App Store / TestFlight)

```bash
cd frontend
npx cap open ios
```

Xcode åpner `App.xcworkspace`. Gjør følgende:

1. **Signing & Capabilities** (App-target → Signing & Capabilities):
   - Sett `Team` til din Apple Developer-konto
   - Bekreft `Bundle Identifier`: `no.kjapp.app` (må matche `capacitor.config.json`)
   - Kryss av `Automatically manage signing`

2. **Legg til Capabilities** (klikk `+ Capability`):
   - `Push Notifications`
   - `Background Modes` → aktiver `Location updates` + `Background fetch` + `Remote notifications`
   - (Valgfritt, når `APPLE_CLIENT_ID` er klar) `Sign in with Apple`

3. **App-ikon**: Dra 1024×1024 ikonet inn i `Assets.xcassets/AppIcon` (Xcode genererer alle størrelsene)

4. **Info.plist er allerede fylt ut med**:
   - `NSLocationWhenInUseUsageDescription` (norsk tekst)
   - `NSLocationAlwaysAndWhenInUseUsageDescription`
   - `UIBackgroundModes` (location + fetch + remote-notification)
   - `ITSAppUsesNonExemptEncryption = false` (for å hoppe over eksport-erklæring)

5. **Kjør på simulator**: velg iPhone 15 Pro → trykk ▶

6. **Bygg for TestFlight**:
   ```
   Product → Archive
   ```
   Ferdig arkiv → `Distribute App` → `App Store Connect` → `Upload`
   Logg deretter inn på [App Store Connect](https://appstoreconnect.apple.com/) → TestFlight → Add testers.

7. **Submit for review** (fra App Store Connect):
   - Fyll ut app-beskrivelse (norsk + engelsk)
   - Legg ved 6.7"/6.5"/5.5" iPhone-skjermbilder
   - Personvernerklæring URL: `https://kjapp.no/privacy` (eller `/api/privacy`)
   - Test-konto til Apple: `ola@kjapp.no` / `test1234`
   - Review-tid: 24-72 timer

---

## 4. Bygg Android APK/AAB (Google Play)

```bash
cd frontend
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

2. **AndroidManifest.xml er allerede fylt ut med**:
   ```xml
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   <uses-permission android:name="android.permission.WAKE_LOCK" />
   <uses-permission android:name="android.permission.VIBRATE" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
   ```

3. **Test-APK på emulator**:
   ```bash
   ./gradlew assembleDebug
   # APK i: android/app/build/outputs/apk/debug/app-debug.apk
   ```
   Eller trykk ▶ i Android Studio.

4. **Signer AAB** (for Play Store):
   - Build → Generate Signed Bundle / APK → Android App Bundle
   - Opprett keystore (kun første gang — **TA VARE PÅ .jks-filen og passordet**)
   - Alias: `kjapp-release`
   - `release` variant → Finish

5. **Ferdig AAB** ligger i `android/app/release/app-release.aab`

6. **Last opp til Play Console**:
   - [play.google.com/console](https://play.google.com/console/) → Ny app
   - App-innhold: fyll ut alt (personvern, kategori, målgruppe, annonser)
   - App-utgivelser → Intern testing → last opp AAB
   - Test i 1 uke med interne testere
   - Deretter: Closed Testing → Production

---

## 5. Oppdatere appen etter kodendringer

```bash
cd frontend
yarn build              # rebuild PWA
npx cap sync            # synk til native
npx cap open ios        # eller android
# Deretter Archive/Build → last opp ny versjon
```

**Viktig**: For hver nye release må `versionCode` (Android) og `Build` (iOS) inkrementeres.

---

## 6. Native funksjoner allerede wired inn

Frontend bruker `/app/frontend/src/lib/native.js` som isomorf bridge — automatisk fall-back til web-APIer når appen ikke kjører native.

Wired og klar:
- ✅ **Statusbar & Splash**: `initNativeShell()` kjøres på App-mount
- ✅ **Native GPS**: `watchLocation()` bruker `@capacitor/geolocation` på native, `navigator.geolocation` på web (DriverHome.jsx)
- ✅ **Native push**: `registerNativePush()` sender token til `/api/push/native-subscribe`
- ✅ **Haptics**: `haptic("light|medium|heavy")` gir taktil feedback
- ✅ **Device ID**: Sendt med push-token så multi-device fungerer (iPhone + iPad = to tokens)
- ✅ **Safe area**: CSS bruker `env(safe-area-inset-*)` for notch-tilpasning
- ✅ **Android back-button**: Håndteres → nettleser-history + exitApp på root

Native push (APNs + FCM) — **serverside sender ikke fysisk push-melding ennå**:
- Endepunktet `/api/push/native-subscribe` lagrer tokens
- For å faktisk sende trenger du:
  - **iOS**: APNs .p8-nøkkel (fra Apple Developer → Keys), key_id, team_id
  - **Android**: FCM `google-services.json` + service account
- Denne siste bit implementeres når du er klar for produksjonsvarsler (est. 8-16 timer)

---

## 7. Konfigurer produksjons-backend

Før du bygger for release:

1. **Endre `REACT_APP_BACKEND_URL`** i `frontend/.env` fra preview-URL til produksjon:
   ```
   REACT_APP_BACKEND_URL=https://api.kjapp.no
   ```

2. **Slå av DevNavigator** (allerede env-gated fra iter 18):
   ```
   REACT_APP_DEV_NAV=false
   ```
   (eller fjern helt)

3. **Rebuild**:
   ```bash
   yarn build && npx cap sync
   ```

4. **Sett `allowNavigation` i `capacitor.config.json`** til produksjons-domenet ditt:
   ```json
   "allowNavigation": ["kjapp.no", "*.kjapp.no"]
   ```

---

## 8. Kritiske ting å huske

- **Backend-URL må være HTTPS med gyldig sertifikat** — native apper avviser selvsignerte
- **Alle push-nøkler (VAPID)** må være permanente — hvis backend blir re-deployet mister eksisterende brukere push-abonnement
- **Norske drosjekrav**: Skatteetaten ARS-godkjenning MÅ være på plass før kommersiell lansering — start den prosessen NÅ (2-6 uker saksbehandling)
- **App Store-avvisning**: 90% av avvisninger skyldes: manglende personvern, uklar bruk av lokasjon, eller manglende Apple Sign In når Google Sign In er implementert (Apple regel 4.8). Vi har Apple Sign In stubbet — MÅ aktiveres før iOS-release
- **Vipps checkout**: Ikke aktivert ennå — trenger `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET`, `VIPPS_SUBSCRIPTION_KEY`, `VIPPS_MSN` i backend/.env

---

## 9. Tidsestimat til produksjonslansering

| Steg | Tid | Kostnad |
|---|---|---|
| Apple Developer-registrering | 1-2 dager | $99 |
| Google Play-registrering | 3-5 dager | $25 |
| Xcode-oppsett + første build | 2-4 timer | 0 |
| Android Studio-oppsett + første build | 1-2 timer | 0 |
| App-ikoner + skjermbilder | 4 timer | 0 |
| Personvern + vilkår | ✅ (allerede laget) | 0 |
| Apple Sign In-aktivering | 2 timer (etter APPLE_CLIENT_ID) | 0 |
| APNs + FCM native push senders | 8-16 timer | 0 |
| Vipps integrasjon | 4-8 timer (etter nøkler) | 0 |
| Skatteetaten ARS-godkjenning | 2-6 uker | Egen søknad |
| App Store review | 1-3 dager | 0 |
| Google Play review | 1-2 dager | 0 |

**Realistisk lansering**: 2-4 uker fra i dag (forutsatt at ARS-godkjenning ikke er blokker)
