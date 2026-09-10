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
