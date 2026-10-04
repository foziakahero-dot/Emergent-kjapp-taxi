# SNAR Project Requirements

Status: working technical source of truth for Oslo beta.

## Product goal
SNAR is a Norwegian taxi / ride-hailing platform with Oslo beta first. The product consists of Customer mobile, Driver mobile, Fleet Web, Admin Web and a shared FastAPI/MongoDB backend.

## Product roles
- Customer: search, quote, vehicle selection, booking, live trip, communication, payment, receipt and account controls.
- Driver: approved/invited driver access, online/offline availability, GPS, trip offers, trip lifecycle, navigation, communication, identity, vehicle and earnings.
- Fleet owner: driver invitations/approval, vehicle assignment, Stripe Connect settlement and fleet operations.
- Admin/superadmin: operational oversight, approval, finance, support, safety and audit.

## Architecture
- Customer mobile: Expo / React Native.
- Driver mobile: Expo / React Native.
- Backend: FastAPI.
- Database: MongoDB.
- Mapping: Mapbox where native implementation is present; external navigation may open Google Maps / Apple Maps / Waze according to supported platform and user preference.
- Payments: Stripe; server remains authoritative for payment state and fleet settlement.
- Push: Expo Notifications / FCM / APNs according to platform configuration.
- Authentication: password plus configured native identity providers; backend validates identity and role.
- Public API base for beta: `https://api.kjappapp.no` until a controlled SNAR hostname migration is executed.

## Environments
- development: local-only development and explicitly synthetic test data when enabled.
- test: automated regression and sandbox integrations.
- beta/staging: real beta behavior, no fabricated operational supply.
- production: release-gated environment with strict secrets, auth, authorization and observability requirements.

## Branding
- User-facing product name: **SNAR**.
- Legacy internal identifiers such as package IDs, bundle IDs, URL schemes, notification channel IDs, database fields or storage keys may remain `kjapp` where changing them would risk signing, migrations or compatibility.
- New user-facing strings must not introduce KJAPP branding.

## Data integrity
- Operational customer/driver views must not fabricate trips, cars, GPS, ETAs, earnings or payment state.
- Backend state is authoritative for trip lifecycle, authorization, payment and fleet assignment.
- Stale GPS must not represent an available vehicle.

## Security baseline
- Secrets never committed or logged.
- Mobile apps receive only client-safe keys/configuration.
- JWT/session state must be protected and invalid sessions must fail closed.
- Server enforces role, approval and resource ownership.
- Driver must not access another driver's private resources or another trip's restricted data.
- Payment and settlement transitions require server-side validation and idempotency.

## Release policy
A release requires:
1. source validation,
2. TypeScript / configured static checks,
3. Expo Doctor / native configuration validation,
4. backend regression coverage for changed contracts,
5. native Android build,
6. iOS build where applicable,
7. physical-device smoke test,
8. P0 release gate green,
9. documented remaining P1/P2 items.

A successful compile/export alone is not a release acceptance result.
