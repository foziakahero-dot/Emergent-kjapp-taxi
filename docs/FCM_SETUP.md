# KJAPP FCM / Android push setup

KJAPP has two separate Android apps and both must belong to the SAME Firebase project as the backend service account:

- Customer: `no.kjapp.app`
- Driver: `no.kjapp.driver`

## 1. Firebase Console

Create or select one Firebase project, then add two Android apps with the package IDs above.

Download one `google-services.json` for each Android app. The files are app-specific even though they share the same Firebase project.

Do not reuse the Customer JSON for Driver or vice versa.

## 2. EAS file variables

Each mobile project uses `app.config.js`. It adds `android.googleServicesFile` only when the EAS file variable `GOOGLE_SERVICES_JSON` exists.

From `frontend/`:

```bash
eas env:set production --name GOOGLE_SERVICES_JSON --type file --visibility secret --value ./google-services.json
eas env:set preview --name GOOGLE_SERVICES_JSON --type file --visibility secret --value ./google-services.json
```

From `driver-app/`, run the same commands with the Driver app's JSON file.

If your installed EAS CLI does not support `--type file` on `env:set`, use the Expo dashboard:
Project → Environment variables → New variable → Type: File → name: `GOOGLE_SERVICES_JSON`.

## 3. FCM V1 service account for EAS credentials

For each Expo project:

```bash
eas credentials -p android
```

Choose the Android app, then Push Notifications / FCM V1 and upload a Google Service Account key from the SAME Firebase project.

## 4. Backend sender

The FastAPI backend already uses Firebase Admin. Configure the deployment with:

```text
FCM_PROJECT_ID=<firebase project_id>
FCM_SERVICE_ACCOUNT_JSON=<entire service-account JSON>
```

or mount the service account file and set `FCM_SERVICE_ACCOUNT_FILE`.

The backend now refuses to initialize FCM when the service-account `project_id` does not equal `FCM_PROJECT_ID`.

## 5. Verify

Build fresh APKs after adding the Firebase files. On each physical app:
1. Grant notifications.
2. Sign in.
3. Confirm `POST /api/push/native-subscribe` stores a device token.
4. Send a test notification.
5. Lock the phone and verify it arrives through channel `kjapp_trips`.

Never call native push verified only because an EAS build is green.
