# SNAR production migration — 26 October 2026

Source: `release/onboarding-live-base-20261020` at `abdea80629e20e395e450f8d07e2886706fa07ae`.
Target: existing Render `kjapp-beta-api`, service `srv-datbvsid0e5s73bg0s30`.
Separate QA: `snar-api-qa`, service `srv-db61otlckfvc73bqp480`.
Both use paid 0.5 CPU / 512 MB instances. No service or plan is created by this change.

## Verified starting state

The active `https://api.kjappapp.no/api/ready` reports `qa_mode=true`,
`production_mode=false`. Native payment config exposes test mode. Native Customer
Google config is disabled by the QA guard. The older separate QA API advertises
Google enabled but Google Pay disabled. Stripe's connected live account is
Kjappapp, with no live webhook endpoints at inspection time.

## Implementation

- `payment_provider=google_pay` on the existing trip request bypasses only the
  saved-card prerequisite. The backend creates the canonical NOK PaymentIntent
  with manual capture and an idempotency key; it remains `payment_authorizing`.
- The app confirms that PaymentIntent through Google Pay, then calls the existing
  authorization-confirm endpoint. Only server-confirmed `requires_capture`
  activates dispatch. Cancellation uses the existing release flow; completion
  uses the same capture and receipt reconciliation. No parallel checkout charge.
- Stripe customer IDs and payment methods are partitioned by test/live mode.
  Legacy instruments are treated as test data. Existing test reservations cannot
  be confirmed or captured using live credentials.
- Live payment activation requires matching live keys, explicit production mode,
  a non-QA database, webhook secret, `NATIVE_PAYMENTS_ENABLED=true` and
  `NATIVE_PAYMENTS_LIVE_ENABLED=true`. Google Pay also requires
  `GOOGLE_PAY_ENABLED=true`.
- Customer native Google OAuth in QA requires `QA_GOOGLE_CLIENT_ID`; it never
  inherits the production audience. Driver native Google OAuth is disabled.

## Production transition

1. Preserve the existing QA database and service. Inventory and back up actual
   fleet/driver onboarding records before any selective migration. Do not copy
   test trips, saved Stripe test cards or test financial records into production.
2. Confirm the production database on the existing Mongo connection and configure
   `DB_NAME`, `APP_ENV=production`, `QA_MODE=false`, demo/test seeding off, production
   web/Fleet/password-reset/checkout origins and the existing operational secrets.
3. Configure the existing Stripe account's matching live publishable and server
   key securely in Render. Configure a live webhook for the existing route
   `/api/stripe/webhook` and store its signing secret only in Render.
4. Configure production Google OAuth using the existing SNAR project. Validate
   the exact signed Android package + SHA-1; native ID-token verification uses
   its web/server client ID. Google Pay production approval and device acceptance
   remain necessary.
5. Deploy this backend from the reviewed source, monitor Render until live, and
   verify health, production readiness and native auth/payment configuration.
6. Run the Customer `scripts/customer-production-preflight.cjs`. No APK is built
   automatically. Physical Android authentication/Google Pay, reservation,
   dispatch, trip completion, capture and receipt remain release acceptance gates.

## Validation

109 focused backend tests passed: reservations, Google Pay lifecycle, native
identity/payment HTTP endpoints, QA safety, service-fee policy, driver offers and
transitions, driver approval, fleet onboarding and onboarding emails. Python
compilation and whitespace checks pass. SDK/provider responses are simulated in
unit tests; no real charge, transfer or production data mutation was performed.
