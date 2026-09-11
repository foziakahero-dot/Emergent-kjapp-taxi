# KJAPP — Test Credentials (development / preview)

Backend seeds these when `ENABLE_DEMO_DATA=true` (current dev default).

## Customer (passenger)
- Email: `ola@kjapp.no`
- Password: `test1234`
- Comes with pre-seeded payment methods (Vipps + Visa + Mastercard), so booking works.

## Driver
- Email: `sjafor@kjapp.no`
- Password: `sjafor1234`
- Approved driver (Tesla Model Y · EL12345). Toggle "online" to receive ride offers.

## Admin / Superadmin (web portal — not part of the mobile app)
- Email: `admin@kjapp.no`
- Password: set via backend `.env` `ADMIN_PASSWORD`.

## Notes
- The mobile app (Expo) covers the **customer** and **driver** experiences.
- Admin / fleet / superadmin remain the existing web portal (admin.kjappapp.no).
- Backend base URL is provided to the app via `EXPO_PUBLIC_BACKEND_URL`.

## Google sign-in (Emergent-managed)
- Any real Google account works — no app password. First sign-in upserts a user by email with role="user" (customer). Existing email accounts are linked (no duplicate).
- Flow: login screen "Fortsett med Google" -> auth.emergentagent.com -> returns session_id -> POST /api/auth/google/session -> app JWT (kjapp_token). Drivers still use email/password (Google creates customer accounts only).
- E2E must be tested with a real Google account; mobile requires a real device/Expo Go (deep link kjapp://).
