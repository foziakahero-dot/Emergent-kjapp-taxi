# Native wallet cards and 12% service fee

Source: deployed backend 18fc05c88aa1d82e4a0d8fc133f1a59836bb3be8.
This is a narrow patch preserving the deployed Resend integration; it does not
replace the service with the divergent v0/main branches or change Driver/Admin auth.

Native SetupIntent success is independently retrieved and bound to both user and
Stripe customer. Verified wallet cards record Apple Pay/Google Pay branding.
The explicit default-card POST endpoint rejects other users, unverified methods
and Stripe cards attached to another customer. The existing reservation service
continues to authorize, release and capture the selected verified default card.
No wallet-specific second trip charge was introduced.

Native live configuration is disabled unless matching live secret/publishable
keys, NATIVE_PAYMENTS_ENABLED=true, NATIVE_PAYMENTS_LIVE_ENABLED=true,
APP_ENV=production and QA_MODE!=true are all satisfied. Existing test configuration
continues to work. This release does not enable real payments.

Set SNAR_SERVICE_FEE_RATE=0.12 to enforce the user's 12% service fee for new trip
snapshots. The snapshot source prevents a stale fleet 10% setting from overwriting
the new rate when a driver accepts. Historical trips retain their stored rate.
Admin settings and public marketing configuration report the effective rate;
conflicting admin fee changes are rejected while the deployment override is set.
Removing the override restores editable stored agreements. This is a platform fee
allocation, not a new 12% surcharge added on top of the displayed customer fare.

Validation: 53 focused HTTP/unit tests passed across mobile_commerce,
ride_reservations, service_fee_policy and ride_search. The dispatch harness now
supplies the existing real gross-fare helpers and mocked notification adapter.
Python compile checks pass. An additional older static contract suite has 56
passing/6 failing assertions against the pre-existing mobile UI in this backend
branch; those are not represented as release acceptance. Legacy iter35 tests point
to a retired Emergent host and are not a valid live SNAR acceptance run.

Release verification: inspect the exact Render deploy commit and terminal live
state; GET /api/health, /api/ready, /api/payments/native/config and
/api/marketing/platform-config; verify unauthenticated default-card POST is denied.
Then use the new Customer build with a real Google Pay capable Android device in
test mode, paired test driver/customer accounts and fresh GPS. Apple Developer
2FA, Merchant ID, Stripe Apple Pay certificate and signed iOS entitlement remain
required, followed by physical-device testing. No beta/live approval is implied.

Before real charges: use a separate production environment/database with live
Stripe customers/methods/Connect accounts (test IDs cannot be reused), configure
live keys and a separately signed live webhook in secret storage, verify fleet
onboarding/capabilities and account activation, Google Pay production approval and
Apple merchant setup, and test reservation/3DS/capture/cancel/refund/webhook replay,
12% split and receipts before deliberately enabling production traffic.
