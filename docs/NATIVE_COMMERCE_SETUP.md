# KJAPP native identity and commerce foundation

Implemented for Expo SDK 57. This change does not activate production charges.

## Identity

- Customer and Driver use native Google ID tokens verified against the backend's
  `GOOGLE_CLIENT_ID`. Mobile login no longer uses Emergent authentication.
- Customer web uses KJAPP's existing authorization-code endpoint with PKCE.
- Apple native login verifies issuer, expiry and the client-specific bundle audience.
- Driver social login only accepts existing, approved Driver accounts in active fleets.
  It preserves the device identity recheck policy and does not create Driver accounts.
- Accounts requiring 2FA must use the existing KJAPP login. Social login cannot bypass it.
- An existing provider subject is never overwritten. Linking Google accounts with
  third-party email requires the existing KJAPP password flow.

Configure Google Cloud OAuth clients: one web/server client, Android clients for
`no.kjapp.app` and `no.kjapp.driver` with the actual EAS signing SHA-1/SHA-256, and
separate iOS clients for the bundle IDs in each app.json. Use client IDs from the
same authorized Google project. No IDs or signing fingerprints are invented here.

Backend: `GOOGLE_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID` (Customer),
`GOOGLE_DRIVER_IOS_CLIENT_ID`, `APPLE_BUNDLE_ID`, `APPLE_DRIVER_BUNDLE_ID`.
Google web additionally requires `GOOGLE_CLIENT_SECRET` and an authorized redirect
URI matching the customer web origin plus `/`.

Expo: set each project's own `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` before an iOS build.
The app checks that its compiled iOS client agrees with backend configuration.
Enable Sign in with Apple for both native bundle IDs and regenerate provisioning
profiles as needed. Verify the Driver release's actual bundle ID: this branch uses
`no.nexorahub.kjapp.driver`; older builds may use another ID.

## Fleet onboarding and settlement

Admin approval and manual fleet creation provision an idempotent Express account
when Stripe is configured. Provisioning failure leaves a visible retry status; it
does not silently revoke an approved fleet. The authenticated owner starts or
continues Stripe-hosted bank/KYC under Fleet → Økonomi. Onboarding links are generated
on demand, never emailed as reusable secrets. Stripe approval remains separate
from KJAPP approval. Weekly Friday payouts are requested, not guaranteed arrival dates.

This foundation retains the existing **destination-charge** model. Customer money
is charged on KJAPP's Stripe platform; `transfer_data.destination` allocates funds
to the trip's fleet and `application_fee_amount` retains the agreed KJAPP fee.
Native payments refuse to charge if fleet settlement is unavailable. This is not
the cheaper direct-charge/account-billed Connect model. Converting to direct
charges requires connected-account customer/payment-method handling, account-aware
webhooks and refunds, and a separately tested migration.

Amounts and commission come from backend trip/fleet snapshots, never the phone.
Do not treat `commission_rate=.10` as proof that 10% + VAT has been configured:
the current field is the total fractional amount used in settlement. Agree and
test the service-fee VAT basis and invoice breakdown before real-money activation.

## Native payments

The Customer receipt opens Stripe PaymentSheet when explicitly enabled; otherwise
the existing Checkout flow remains available. PaymentSheet supports cards and
configured Apple Pay/Google Pay. Signed Stripe webhooks or backend Stripe retrieval
confirm settlement; client success alone never marks a trip paid.

Backend: matching `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`, verified
`STRIPE_WEBHOOK_SECRET`, `NATIVE_PAYMENTS_ENABLED=true`, and optional
`GOOGLE_PAY_ENABLED=true`, `APPLE_PAY_MERCHANT_ID`.

Expo Customer: `EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID` must equal the registered Apple
Merchant ID and backend value. Create its Apple Pay certificate through Stripe
and update provisioning. Google Pay production access must be approved for the
Android integration. Wallets require a new native APK/iOS build; OTA alone is
insufficient. Live and test key modes must agree.

Keep `NATIVE_PAYMENTS_ENABLED=false` and `KJAPP_AUTO_CHARGE_ENABLED=false` until
physical-device, test-mode acceptance passes: customer/approved driver login,
unapproved driver rejection, card/Apple Pay/Google Pay success and cancellation,
retries, signed webhook replay, bank/3DS challenge, refund and fleet/platform split.
Register `payment_intent.succeeded` for the existing platform webhook endpoint.
Connect account status is refreshed from Stripe on demand in both panels.

Native intent creation, legacy Checkout and autocharge share a trip lock.
A native transaction is reserved before the Stripe request and reused with a
deterministic idempotency key, preventing a network retry from creating another
payment flow. A canceled native intent needs support reconciliation rather than
opening a second independently payable Checkout session.

## Validation

- HTTP tests cover role/approval boundaries, provider linking, 2FA, account ownership,
  server-priced payment splits, idempotent retries, shared locks and webhook truth.
- TypeScript checks cover both mobile apps, Admin and Fleet.
- Admin and Fleet production bundles and Expo SDK 57 prebuild configuration checked.
- No physical-device login, wallet payment or production charge is claimed by these checks.
