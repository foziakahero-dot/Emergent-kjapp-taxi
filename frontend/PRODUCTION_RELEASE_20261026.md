# Customer Google Pay and production release — 26 October 2026

Source: PR #127 branch `fix/customer-live-map-panels-20261025`,
SHA `d5f15c2841795ea5e9ec35d4f1b2fddf37edc130`. Existing v0 Curtin-appen
and repository are retained. No new application or native build is created.

Google Pay can now be selected for the booking even without a saved card. The
review screen labels the choice and uses Stripe's native Google Pay button.
The existing trip request carries `payment_provider=google_pay`. The backend
returns its canonical manual-capture PaymentIntent; the native adapter confirms
it with Google Pay and the API confirms backend reservation state before showing
a successful booking. Saved-card bookings remain the default. No duplicate Stripe
initialization is performed outside the existing root StripeProvider.

Customer Google Sign-In now rejects disabled backend configuration before opening
Google, reports signing/client configuration errors clearly, and treats cancellation
as neutral. The active API's blanket QA OAuth disable was the observed blocker;
Android SHA-1/package and actual Google account login remain device/account checks.

Production EAS config declares live payments. The new read-only release check
`node scripts/customer-production-preflight.cjs` verifies production readiness,
Stripe live mode, webhook configuration, Google Pay and Customer Google auth without
printing keys. It currently fails because the active API is still QA/test and
Google auth is disabled. It is not an APK build trigger.

Validation: TypeScript; actual native reservation and Google sign-in adapter tests;
existing quote/wallet, nearby-driver and map-camera regressions; Expo public QA
config. Native SDK calls are simulated in tests. This environment's sparse source
checkout excludes the existing large vehicle PNGs; no asset was changed. A full
web/native bundle or screenshot acceptance is not claimed. Physical Android Google
Pay, Google login, trip/receipt acceptance and Google production approval remain
unverified. Backend dependency is the separately reviewed production migration
change based on the live `abdea806` source, not a bulk merge of v0 backend files.
