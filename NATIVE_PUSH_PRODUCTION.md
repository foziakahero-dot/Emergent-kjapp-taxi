# KJAPP Native Push — Production Configuration

Current mobile architecture:
- Customer: Expo / React Native, Android package + iOS bundle `no.kjapp.app`
- Driver: Expo / React Native, Android package + iOS bundle `no.kjapp.driver`

## Delivery architecture

- Android: `expo-notifications` obtains the native FCM token. Backend sends through Firebase Admin / FCM.
- iOS: `expo-notifications` obtains the native APNs token. Backend sends directly to APNs.
- Both clients register tokens at `POST /api/push/native-subscribe`.
- Token rotation is listened for and re-registered automatically.
- Backend stores one token per user + platform + device + app role and removes dead tokens.

## Firebase project

Register two Android apps in the Firebase project:
1. `no.kjapp.app`
2. `no.kjapp.driver`

Download the matching `google-services.json` for each app. Do not commit either file.

## EAS file secrets

Each Expo project must have its own secret file variable named:

`GOOGLE_SERVICES_JSON`

The Customer EAS project receives the Customer `google-services.json`.
The Driver EAS project receives the Driver `google-services.json`.

Assign the file variable to both:
- `preview`
- `production`

The dynamic `app.config.js` reads the secret file path from `process.env.GOOGLE_SERVICES_JSON`.
The `apk` and `production` profiles deliberately fail if Firebase is required and this file is missing.

## Backend Firebase Admin

Set one of:

`FCM_SERVICE_ACCOUNT_JSON`
- Entire Firebase service-account JSON as a secret environment variable.

or:

`FCM_SERVICE_ACCOUNT_FILE`
- Path to a securely mounted service-account JSON file.

A single service account can send to both Android apps when both are registered in the same Firebase project and the account has FCM permissions.

## Apple Push Notification service

The iOS clients return native APNs tokens, not Firebase registration tokens. Backend therefore sends iOS notifications directly through APNs.

Required backend secrets:

`APNS_KEY_ID`
`APNS_TEAM_ID`

and one of:

`APNS_PRIVATE_KEY`
- Contents of the Apple .p8 key.

or:

`APNS_PRIVATE_KEY_FILE`
- Path to a securely mounted .p8 key.

Optional overrides:
`APNS_BUNDLE_ID_CUSTOMER=no.kjapp.app`
`APNS_BUNDLE_ID_DRIVER=no.kjapp.driver`

Production EAS builds set:
`EXPO_PUBLIC_APNS_ENVIRONMENT=production`

## Verification

1. Build Customer Android with profile `apk`; build must refuse to start if `GOOGLE_SERVICES_JSON` is missing.
2. Build Driver Android with profile `apk`; same gate applies.
3. Install both APKs on physical Android.
4. Log into each app and grant notifications.
5. Confirm `native_push_tokens` contains provider `fcm`, stable `device_id`, and correct `app_role`.
6. Call `POST /api/push/test` while app is backgrounded and while phone is locked.
7. Admin integration health must show Firebase / FCM (Android) operational.
8. On iPhone, repeat with APNs credentials configured; admin integration health must show Apple Push / APNs operational.

Never commit service-account JSON, google-services.json, or .p8 private keys.
