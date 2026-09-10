# KJAPP — bygge APK og iOS-app

> Emergents «publiser direkte til App Store/Play» finnes **kun for Expo/React Native**-apper.
> KJAPP er en **Capacitor**-app, så selve APK/IPA lages ett av disse tre stedene:
>
> | Måte | Krever | Anbefalt for |
> |---|---|---|
> | **GitHub Actions** (ferdig satt opp i repoet) | bare GitHub-konto | **APK uten Mac** ✅ og TestFlight |
> | Egen maskin (`./scripts/build-mobile.sh`) | Node 22 + Android Studio / Xcode | rask lokal testing |
> | Xcode på Mac | macOS + Apple Developer | App Store-innsending |
>
> Alt annet er ferdig konfigurert: ikoner, splash, tillatelser, push-kanaler, deep links,
> signeringsoppsett og versjonshåndtering.

---

## A. Bygg i skyen med GitHub Actions (ingen Mac nødvendig)

Repoet har to workflows: `.github/workflows/android-build.yml` og `.github/workflows/ios-build.yml`.
Push koden til GitHub (bruk **Save to Github** i Emergent-chatten), så er de tilgjengelige under
fanen **Actions**.

### 1. Sett API-adressen (én gang)
GitHub → **Settings → Secrets and variables → Actions → Variables → New variable**
```
Navn:  KJAPP_API_URL
Verdi: https://api.kjappapp.no        (eller https://<ditt-emergent-domene>)
```
Denne adressen bakes inn i appen — appen snakker med dette API-et.

### 2. Kjør Android-bygget
**Actions → «Android build (APK + AAB)» → Run workflow** → fyll inn versjon (f.eks. `1.0.0`) og
versjonskode (`1`, må økes for hver Play-opplasting).
Når jobben er ferdig laster du ned **`kjapp-android-apk`** under *Artifacts* → filen kan installeres
rett på en Android-telefon (slå på «tillat ukjente kilder»).

### 3. Signert release for Google Play (valgfritt, men nødvendig for Play Store)
Lag en keystore én gang på din maskin:
```bash
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias kjapp
base64 -i upload-keystore.jks | pbcopy      # macOS  (Linux: base64 -w0 upload-keystore.jks)
```
Legg inn som **Secrets** (Settings → Secrets and variables → Actions → Secrets):
| Secret | Verdi |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | base64-strengen fra kommandoen over |
| `ANDROID_KEYSTORE_PASSWORD` | passordet du valgte |
| `ANDROID_KEY_ALIAS` | `kjapp` |
| `ANDROID_KEY_PASSWORD` | nøkkelpassordet |
| `GOOGLE_SERVICES_JSON` | hele innholdet i `google-services.json` (for push) |

Ta vare på `upload-keystore.jks` — mister du den, kan du ikke oppdatere appen i Play.
Bygget lager også **`kjapp-android-aab`** som er filen du laster opp i Google Play Console.

### 4. iOS / TestFlight
**Actions → «iOS build (IPA / TestFlight)» → Run workflow**.
- Uten secrets: bygger usignert (bekrefter at prosjektet kompilerer).
- For signert IPA + automatisk TestFlight-opplasting, legg inn:
  `IOS_CERTIFICATE_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`,
  `IOS_TEAM_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_ID`, `APPSTORE_PRIVATE_KEY`
  (+ `GOOGLE_SERVICE_INFO_PLIST` for push).
  API-nøkkelen lages i App Store Connect → **Users and Access → Integrations → App Store Connect API**.

---

## B. Bygg på din egen maskin

Forutsetninger: **Node 22+** (Capacitor 8 krever det), JDK 17 + Android Studio for Android,
macOS + Xcode 15+ for iOS.

```bash
# alt-i-ett (bygger web, synker native, lager APK)
./scripts/build-mobile.sh https://api.kjappapp.no apk
./scripts/build-mobile.sh https://api.kjappapp.no aab     # Play Store-bundle
./scripts/build-mobile.sh https://api.kjappapp.no ios     # åpner Xcode
./scripts/build-mobile.sh https://api.kjappapp.no         # bare web + cap sync
```
Lokal signering (valgfritt): lag `frontend/android/keystore.properties` (git-ignorert):
```
storeFile=/absolutt/sti/til/upload-keystore.jks
storePassword=xxx
keyAlias=kjapp
keyPassword=xxx
```

Manuelt, om du vil styre stegene selv:
```bash
cd frontend
REACT_APP_BACKEND_URL=https://api.kjappapp.no yarn build
npx cap sync
npx cap open android      # eller: npx cap open ios
```

---

## C. App-identitet (ferdig satt opp)
| | |
|---|---|
| App-ID / bundle | `no.kjapp.app` |
| Appnavn | KJAPP |
| Ikon | champagne-gull «K» på kull-svart — `frontend/resources/icon.png` |
| Splash | KJAPP-wordmark på #08090B — `frontend/resources/splash.png` |
| Versjon | styres av `KJAPP_VERSION_NAME` / `KJAPP_VERSION_CODE` (Android) og `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` (iOS) |
| Deep link-scheme | `kjapp://` |

Vil du endre ikon eller splash: bytt filene i `frontend/resources/` og kjør
```bash
cd frontend && npx @capacitor/assets@3 generate --android --ios \
  --iconBackgroundColor '#0A0D0F' --splashBackgroundColor '#08090B'
```

## D. Tillatelser som allerede er på plass
- **Android**: INTERNET, ACCESS_FINE/COARSE/BACKGROUND_LOCATION, POST_NOTIFICATIONS, WAKE_LOCK,
  VIBRATE, FOREGROUND_SERVICE(_LOCATION). Varselkanal `kjapp_trips` (høy prioritet) lages av appen.
- **iOS**: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`,
  `UIBackgroundModes` = `location` + `remote-notification`, `App.entitlements` med `aps-environment`.

---

## E. Native push (låst skjerm) — krever dine Firebase/Apple-nøkler

Backend er ferdig og **nøkkel-valgfri**: `GET /api/push/native-config` svarer
`{"enabled": false}` til nøkkelen finnes, og push virker i det sekundet den er satt.

1. **Firebase** (gratis): https://console.firebase.google.com → nytt prosjekt «KJAPP».
   - *Add app → Android*, pakkenavn `no.kjapp.app` → last ned **`google-services.json`**
     → `frontend/android/app/google-services.json` (eller secret `GOOGLE_SERVICES_JSON`).
   - *Add app → iOS*, bundle `no.kjapp.app` → last ned **`GoogleService-Info.plist`**
     → `frontend/ios/App/App/GoogleService-Info.plist` (eller secret `GOOGLE_SERVICE_INFO_PLIST`).
   - *Project settings → Service accounts → Generate new private key* → JSON-fil (hemmelig).
2. **APNs for iOS**: developer.apple.com → *Keys* → «+» → aktiver **APNs** → last ned `.p8`,
   noter **Key ID** + **Team ID** → last opp i Firebase → *Cloud Messaging → Apple app configuration*.
3. **Backend**: legg service-account-JSON på én linje i `backend/.env`:
   ```
   FCM_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"kjapp-...", ...}
   ```
   Restart backend og sjekk: `curl $API/api/push/native-config` → `{"enabled": true, ...}`.
4. **Test**: installer appen, logg inn som sjåfør, trykk **«Få turer på låst skjerm»**, lås telefonen,
   bestill en tur fra kundeappen → telefonen vekkes med «Ny tur · X kr til deg».

## F. Sikkerhet
`.gitignore` dekker `keystore.properties`, `*.jks`, `*.keystore`, `**/*.p8`,
`*service-account*.json`, `google-services.json` og `GoogleService-Info.plist`.
Nøkler skal kun ligge i GitHub Secrets eller lokalt — aldri i koden.
