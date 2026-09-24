# KJAPP Beta Incident Runbook

Scope: Oslo closed beta. This runbook is operational guidance for KJAPP Customer, KJAPP Driver, Admin, Fleet and the FastAPI backend.

## Severity

- **P0** — safety issue, duplicate/incorrect charge, wrong passenger/driver assignment, unauthorized access, widespread booking/dispatch failure.
- **P1** — active rides materially degraded: stale GPS, push outage, payment outage with fallback still possible, Admin/Fleet unavailable.
- **P2** — non-critical UI/support/history/reporting issue. Ride completion remains safe.

## First response

1. Open **Admin → Live drift** and confirm active rides and fresh driver GPS.
2. Open **Admin → Krever handling** and **Turer** for stale/blocked rides.
3. Check **Admin → Innstillinger → Teknisk beta-status**.
4. If new rides could make the incident worse, set **Nye bestillinger = PAUSET** and save. Existing rides continue.
5. Record time, affected trip IDs, users and symptoms in the incident log/support ticket.
6. Never edit production MongoDB records manually while an active ride is in progress unless an approved recovery procedure explicitly requires it.

## Dispatch incident

Symptoms:
- customer remains in searching/booking
- wrong driver sees an offer
- two drivers attempt acceptance
- offer countdown does not advance

Actions:
1. Pause new bookings if the issue is systemic.
2. In Admin, inspect the trip and timeline.
3. Verify intended driver is approved, online and has fresh GPS.
4. Use **release driver / find new driver** only for a ride that has not started.
5. If no safe assignment can be made, cancel the ride through Admin and notify the customer.
6. Do not force a driver ID directly in the database.

Expected protections:
- sequential nearest-driver offers
- exact offer ownership
- offer expiry
- atomic accept
- duplicate driver reservation lock
- duplicate customer booking guard

## GPS incident

Symptoms:
- driver marker stops moving
- stale GPS warning
- driver cannot accept/arrive/complete

Actions:
1. Confirm Driver app has foreground/background location permission.
2. Ask driver to foreground KJAPP Driver and confirm location services are enabled.
3. Driver should remain online; the backend rejects stale GPS from dispatch.
4. Do not bypass pickup/destination proximity checks.
5. If widespread GPS ingestion fails, pause new bookings.
6. Active passengers should be told that the displayed marker is the last known position.

## Push incident

Push is notification transport, not trip truth. REST/backend state remains canonical.

Actions:
1. Confirm the Driver app can foreground-refresh pending offers.
2. Confirm Customer/Driver can reload active trip state.
3. Check /api/push/native-config and Expo/APNs/FCM credentials.
4. If push is down but polling/state recovery works, continue only a controlled internal beta.
5. For public beta, treat widespread locked-screen Driver push failure as P1 and stop new bookings until restored.

## Payment incident

Rules:
- ride lifecycle status and payment status are separate
- never mark a ride completed solely because Stripe says paid
- never retry a live charge by manually creating a second PaymentIntent

If automatic saved-card charge fails:
1. Customer sees payment action required/failed.
2. Customer uses the receipt/payment Checkout fallback.
3. Stripe webhook or status endpoint confirms the payment.
4. Admin may refund through the existing refund control after verifying the original transaction.

If duplicate/incorrect charge is suspected:
1. Pause automatic charge by setting `KJAPP_AUTO_CHARGE_ENABLED=false` at deployment/runtime config.
2. Pause new bookings if impact is systemic.
3. Verify Stripe PaymentIntent/session IDs and KJAPP payment transaction records.
4. Refund only the verified duplicate/incorrect transaction.
5. Preserve audit trail.

## Customer cannot recover active ride

1. Restart Customer app.
2. App must refresh auth and active ride from backend.
3. Search by trip ID in Admin if UI still fails.
4. Do not create a second booking while the first ride is active.

## Driver cannot recover active ride

1. Restart Driver app and foreground it.
2. App must restore current trip from /api/driver/current.
3. Confirm driver remains approved and fleet is active.
4. Confirm GPS permission and fresh sample.
5. Do not create a replacement driver account during the active ride.

## Driver no-show / pickup dispute

- Driver must first register a GPS-valid arrival near pickup.
- Server wait timer must expire before no-show is accepted.
- Use trip timeline/GPS timestamps for review.
- Do not apply an unsupported fee manually.

## Safety incident

1. Emergency situations use local emergency services first (112).
2. Preserve trip ID, driver ID, passenger ID, GPS/timestamps and safety events.
3. Do not delete or overwrite incident-related records.
4. Escalate immediately to the designated KJAPP operator.

## Rollback

If a new backend release causes a P0/P1 regression:
1. Pause new bookings.
2. Keep active ride records intact.
3. Route/deploy back to the last known-good backend commit.
4. Run `backend/scripts/release_smoke.py`.
5. Verify one controlled Customer/Driver ride before reopening bookings.
6. Record rollback commit and root cause.

When `api.kjappapp.no` is introduced, rollback should be performed behind that stable hostname so mobile builds do not need to change.

## Reopen criteria

Reopen new bookings only when:
- /api/health is healthy
- /api/ready reports ready
- Admin can see fresh Driver GPS
- one controlled dispatch/accept succeeds
- Customer sees assignment/driver position
- payment path is either healthy or explicitly running with safe manual fallback
- no unresolved P0 remains
