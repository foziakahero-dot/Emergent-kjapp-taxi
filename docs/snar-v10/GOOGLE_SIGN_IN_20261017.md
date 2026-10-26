# SNAR Google Sign-In: APK, web and Render

## What is implemented

Customer (`frontend`) and Driver (`driver-app`) use native Google ID tokens on Android/iOS. `webClientId` is the backend Web OAuth client, not an Android client. Web uses authorization code + S256 PKCE with state validation. The popup is reserved during the click, before network awaits. Codes are exchanged only on Render; client secrets never enter app bundles. Both transports use the same RS256 signature, exact audience, expiry, subject and Google issuer checks, then the same account rules.

Existing password accounts must sign in normally and choose **Koble Google-konto** under account settings before using Google. Matching email alone never silently links accounts. A Driver must already be invited, approved, linked, and belong to an active fleet. Google never creates a Driver account or bypasses two-factor requirements.

Full source:

- `frontend/src/lib/socialSignIn.native.ts`, `socialSignIn.web.ts`, `socialSignIn.ts`, `api.ts`
- `frontend/src/context/AuthContext.tsx`, `frontend/app/customer-account.tsx`
- The corresponding files in `driver-app/`, plus `app/driver-login.tsx`, `app/driver-account-settings.tsx` and `app.config.js`
- `backend/mobile_commerce.py`: shared account/session handling, linking, web code exchange and native endpoints
- `backend/server.py`: `_verify_google_id_token` and rotating Google public keys
- `frontend/vercel.json`, `driver-app/vercel.json`: export the actual Expo apps, not admin-web or an old Emergent proxy

## Verified starting point

Repository: `foziakahero-dot/Emergent-kjapp-taxi`.
Base: QA branch at `8fc30e8168dc32aa164a8a2492a3bd94b125afc5`.
Render QA service: `snar-api-qa` / `srv-db61otlckfvc73bqp480`, paid Starter in My Workspace.
Observed running QA SHA before these changes: `da8e2de8f866833fec30fd08fd25edb344f59c92`.
QA native config already exposes Web client:
`209896468593-7ajfd1t61mnmbr6ui63fk5v6qcdseccp.apps.googleusercontent.com`.
Its actual client type, project ownership and Android registrations still require Console verification.

## MANUAL: Google Cloud Console

Console access here returned **Site Unavailable**, including after one reload. No Console registration was modified or verified.

1. Open Google Cloud Console → Google Auth Platform → Clients / APIs & Services → Credentials, in the project owning the Web client above. Verify its type is **Web application**. Android registrations must belong to that same project.
2. Create/verify Android OAuth clients for the exact installed application IDs:

   | App | Android package |
   | --- | --- |
   | Customer | `no.kjapp.app` |
   | Driver | `no.kjapp.driver` |

   Create a registration for **each package + signing SHA-1** combination actually used: local debug, EAS QA/release, and Google Play app-signing certificate when distributing through Play. The Play upload certificate alone is not the installed Play app certificate. Debug and release may be signed differently even when both are APKs.
3. Obtain actual fingerprints; never generate a new keystore to make Google match:

   ```sh
   # Definitive certificate of the APK you are installing
   apksigner verify --print-certs path/to/customer.apk
   apksigner verify --print-certs path/to/driver.apk

   # Local Android variants, when native projects exist
   cd frontend/android
   ./gradlew signingReport
   # Repeat in driver-app/android

   # EAS signing metadata, separately in each app directory
   eas credentials --platform android
   ```

   Previously recorded Customer EAS SHA-1 is `44:C8:7B:B8:9C:6E:E9:9B:34:AA:99:7D:B5:A6:70:AD:74:0C:E4:2C`; it is **not freshly verified** against the current APK. Driver/debug fingerprints are unknown here.
4. On the Web OAuth client add each exact web origin (scheme + hostname + optional port) to Authorized JavaScript origins. Add the same origin with trailing `/` to Authorized redirect URIs, matching this implementation. For example `https://<actual-customer-domain>/` and `https://<actual-driver-domain>/`. Preview URLs require explicit registrations; there are no wildcard redirect URIs.
5. Configure Branding/Audience, support email, privacy/terms links and test users if the consent screen is in Testing. Use only `openid email profile` for this login.
6. For iOS, verify separate iOS OAuth clients for `no.nexorahub.kjapp.customer` and `no.nexorahub.kjapp.driver`. Configure the matching native URL schemes through the build variables below. This requires a new native build when changed.
7. If Firebase supplies push configuration, enable Google sign-in in the corresponding project, add the fingerprints there as well and download updated `google-services.json` for each app. Keep QA and production Firebase settings separate. Native Google authentication itself validates through Google OAuth and Render, not Firebase Auth.

## MANUAL: Render environment

Use dedicated QA credentials. Never copy production secrets into QA implicitly.

| QA variable | Value |
| --- | --- |
| `QA_GOOGLE_AUTH_ENABLED` | `true` |
| `QA_GOOGLE_CLIENT_ID` | verified Web OAuth client ID |
| `QA_GOOGLE_CLIENT_SECRET` | secret belonging to that same Web OAuth client; enter directly in Render |
| `QA_GOOGLE_REDIRECT_URIS` | comma-separated exact permitted web redirects with trailing `/` |
| `QA_GOOGLE_IOS_CLIENT_ID` | Customer iOS client, if iOS is supported |
| `QA_GOOGLE_DRIVER_IOS_CLIENT_ID` | Driver iOS client, if iOS is supported |

Production uses the same variable names without `QA_`; `GOOGLE_AUTH_ENABLED` is not required there. Native APK verification does **not** need a client secret. Web code exchange does. CORS must allow the exact intended web origins (`FRONTEND_URL` / existing CORS policy); arbitrary origins must not be enabled. Redeploy after saving variables.

## MANUAL: Vercel and EAS

Only `snar-admin`, `snar-landing`, `snar-fleet` were visible among this repo's Vercel projects. There is no verified Customer/Driver web project or URL yet. Do not repurpose the admin/landing/fleet projects.

- Create or select separate Customer and Driver web projects pointing at `frontend` and `driver-app` respectively. Framework Other; `npm ci`; `npx expo export --platform web`; output `dist`. Their checked-in `vercel.json` contains these settings and SPA rewrites.
- Set `EXPO_PUBLIC_BACKEND_URL=https://api-qa.snarapp.no` for QA, or the verified production API for production. The build fails if no HTTPS backend is provided. Configure only public client/map identifiers in Vercel; never a Google client secret.
- Register the resulting stable web domains in Google Console and Render redirect/CORS allowlists.
- EAS QA iOS variables: `EXPO_PUBLIC_QA_GOOGLE_IOS_CLIENT_ID` for Customer; `EXPO_PUBLIC_QA_GOOGLE_DRIVER_IOS_CLIENT_ID` for Driver. Production omits `QA_`.
- Set GitHub variables `SNAR_CUSTOMER_QA_ANDROID_SHA1` and `SNAR_DRIVER_QA_ANDROID_SHA1` to the fingerprints registered in Google. The controlled workflow checks the certificate of each downloaded APK against its app-specific fingerprint.

## Verification before calling this complete

- `/api/auth/native/config?client=customer` and `?client=driver`: Google enabled, expected Web audience.
- `/api/auth/google/web/config?client=customer` and `?client=driver`: enabled after server secret setup, never exposes a secret.
- Real Google login on both signed installed APKs and both HTTPS web origins; cancellation and retry; link existing account; approved/unapproved Driver; restart and session restoration.
- Rejected wrong-audience, wrong-issuer, expired, malformed and forged tokens. Rejected unapproved redirects and missing/invalid PKCE. Google tokens are never merely decoded as proof of identity.
- A new APK is needed for added Driver native dependencies. No APK builds have been launched by this repair.
