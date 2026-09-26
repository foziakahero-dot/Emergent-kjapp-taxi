# KJAPP Firebase / mobile beta push

This branch keeps the registered iOS App IDs:
- Customer: `no.nexorahub.kjapp.customer`
- Driver: `no.nexorahub.kjapp.driver`

Android app IDs are `no.kjapp.app` and `no.kjapp.driver`. Each EAS project needs its own matching Firebase Android app configuration. Set `GOOGLE_SERVICES_JSON` as an EAS **file** variable for the `preview` and `production` environments in each Expo project. Android `apk` builds fail closed if the variable is missing.

Upload an FCM V1 service account key in each EAS project's Android push credentials. `google-services.json` identifies the Android app; the service account key authorizes Expo Push to deliver through Firebase FCM V1. They serve different purposes. Do not commit the service account key. This branch registers Expo push tokens and the backend sends to Expo Push, which delivers to FCM on Android and APNs on iOS. It does not require the older direct-FCM backend service account for new app installs.

For iOS, keep the two existing Apple App IDs and connect APNs signing in EAS. Verify TestFlight in the two App Store Connect records before submitting a signed beta.

Driver new-trip notifications use the `kjapp-new-trip` tag. Server-side driver settings govern whether offers notify and which Android channel is used for sound/vibration. iOS sound follows the setting; independent vibration is controlled by iOS system settings, so Driver does not offer an iOS vibration switch.

Physical beta gate:
1. Sign in as an approved invited driver with a selected fleet-assigned vehicle and valid GPS; go online.
2. Verify `/api/push/native-config`, a registered Expo token, and a locked-screen offer notification on Android and iOS. A successful `/api/push/test` response alone is insufficient proof of delivery.
3. Check Android sound on/off and vibration on/off combinations, plus foreground and background fallback. Confirm no duplicate offer alert.
4. Confirm customer booking, driver acceptance, pickup GPS gate, ride start, arrival, customer receipt/payment, and both sides' history.
5. Check Fleet assignment, ID verification status and Admin receipts for the same real trip ID. Keep `KJAPP_DRIVER_IDENTITY_REQUIRED` explicit for the selected rollout policy.

Build source from this branch only after the local beta gate passes. No Firebase or Apple credential is stored in Git.
