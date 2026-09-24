# KJAPP Oslo Beta Incident Runbook

Scope: controlled Oslo beta for Customer, Driver, FastAPI backend, Admin, Fleet, Stripe and push.

This runbook is operational guidance. It does not replace legal, payment-provider or emergency-service procedures.

## Severity

| Severity | Definition | Immediate action |
| --- | --- | --- |
| P0 | Safety risk, duplicate/incorrect charge, widespread inability to complete rides, data/security incident | Stop new beta rides if needed, preserve evidence, notify operator lead immediately |
| P1 | Major ride flow broken for multiple users, dispatch/GPS/payment degraded with workaround | Restrict beta, investigate immediately, document affected trips |
| P2 | Important friction with safe workaround | Log, prioritize next beta fix |
| P3 | Cosmetic/polish only | Defer until after beta stability |

## Golden rules

1. Never fabricate driver GPS or ride status.
2. Never manually mark a payment paid without provider evidence.
3. Never force a ride lifecycle backwards to repair a payment state.
4. Never delete audit/payment/trip evidence during an incident.
5. If safety is involved, direct users to emergency services where appropriate; KJAPP support is not an emergency service.
6. Keep `KJAPP_AUTO_CHARGE_ENABLED=false` until Stripe test E2E is explicitly approved.

## 1. Dispatch failure

Symptoms:
- Customer remains searching.
- No eligible driver receives the offer.
- Wrong driver sees/accepts an offer.
- Same trip appears accepted by two drivers.

Operator:
1. Open Admin -> Live drift and Turer.
2. Locate the trip ID and confirm canonical status.
3. Check online approved drivers and GPS freshness.
4. Check whether an offer owner/expiry is active.
5. Do not create a second customer trip while the first one is active.
6. If dispatch cannot recover safely, cancel the affected beta trip through the supported operator/customer flow and log the reason.

Engineering evidence:
- trip_id
- customer id
- candidate driver ids
- offer owner + offer expiry
- created_at / driver_route_started_at
- API response/error
- Admin audit event

Escalate P0 if duplicate assignment is actually observed after atomic accept protection.

## 2. Driver GPS missing or stale

Symptoms:
- Driver disappears from nearby/live map.
- Customer sees stale-location recovery.
- Driver cannot mark arrival.
- Admin shows stale/missing GPS.

Operator:
1. Confirm Driver is online and approved.
2. Confirm location permission is granted.
3. Confirm phone location services are enabled.
4. Bring Driver app to foreground once.
5. Check Admin Live drift for a fresh timestamp.
6. If background GPS repeatedly fails, keep that driver offline for beta until resolved.

Do not:
- substitute Oslo-centre coordinates,
- manually mark pickup based only on a phone call,
- bypass backend pickup/destination proximity gates.

## 3. Push notification failure

Symptoms:
- Driver receives no new-trip push while locked.
- Customer receives no arrival/start/payment push.

Operator:
1. Verify the app is logged in on the intended account.
2. Verify notification permission.
3. Open app once to refresh native token registration.
4. Confirm the trip still appears through in-app polling.
5. Continue the beta ride only if the user can safely follow the in-app state.

Engineering:
- inspect native push token registration/provider
- check push send result
- verify deep-link target
- distinguish push failure from dispatch failure

Push failure with working foreground polling is normally P1 during controlled beta, not permission to weaken dispatch integrity.

## 4. Trip state stuck

Canonical sequence:
`searching -> driver_on_way -> at_pickup -> in_trip -> arrived -> completed/rated`

Operator:
1. Identify current server state in Admin.
2. Review timeline.
3. Verify driver ownership and fresh GPS.
4. Never move state backwards.
5. Use supported Admin intervention only with a recorded reason.
6. If state cannot be safely recovered, cancel/close the beta ride according to the available state and log the incident.

## 5. Payment failure

Symptoms:
- Checkout fails.
- Webhook delayed.
- Customer returns from Stripe but payment remains pending.
- Saved-card auto charge requires customer action.

Operator:
1. Keep ride lifecycle state separate from payment state.
2. Check Admin Finance / transaction record.
3. Check Stripe evidence before treating payment as successful.
4. If manual Checkout is available, let the customer retry through the supported receipt/payment flow.
5. Do not submit repeated ad-hoc charges.
6. Do not refund unless the original transaction is identified and the refund is recorded.

P0 examples:
- confirmed duplicate charge
- amount differs from server-side fare
- payment attributed to wrong trip/customer

## 6. Stripe Connect / fleet settlement issue

1. Do not change historical fare or commission snapshots.
2. Identify fleet_id, trip_id, transaction and Connect account.
3. Put settlement on hold if ownership/destination is uncertain.
4. Preserve provider response and Admin audit evidence.
5. Resolve before public commercial scale.

## 7. Customer/Driver app crash

The mobile apps send fatal JavaScript error reports to `/api/client-errors` for beta operations.

Operator:
1. Record phone model, OS version, app version, role and exact action.
2. Check Admin Beta Health fatal error count.
3. Preserve screenshot/video if available.
4. Ask whether restart restores the active ride.
5. Treat repeated crash in the core ride path as P0/P1.

Native crashes not captured by the JS handler still require device/build logs; this lightweight beta telemetry is not a full Crashlytics/Sentry replacement.

## 8. Backend/API outage

1. Confirm whether Customer, Driver, Admin and Fleet all fail against the same API.
2. Stop starting new beta rides if canonical state cannot be read/written.
3. Do not migrate backend provider during the incident.
4. Preserve logs and deployment/version identifiers.
5. Restore the known-good backend before resuming.

## 9. Admin unavailable

If mobile/backend are healthy but Admin is unavailable:
- pause scaling the beta;
- do not perform unsupported direct database edits as an operational workaround;
- restore Admin and confirm the same trip/user/driver truth before continuing.

## 10. Security/privacy incident

Examples:
- exposed credential/token
- unauthorized admin access
- user receives another user's data
- uploaded document exposed to wrong role

Actions:
1. P0 immediately.
2. Revoke/rotate affected credentials or sessions.
3. Preserve logs/audit trail.
4. Stop the affected feature if required.
5. Use `security@kjappapp.no` for the security process and `privacy@kjappapp.no` for privacy handling.
6. Do not delete evidence.

## Post-incident record

For every P0/P1 record:
- timestamp
- severity
- trip/user/driver/fleet references
- app/platform/version
- symptoms
- exact reproduction
- impact
- immediate mitigation
- root cause when known
- code/config change
- verification
- owner
- closure time

## Beta resume gate

Resume normal beta only when:
- canonical trip state is correct,
- no unexplained duplicate assignment/payment remains,
- driver GPS is real and fresh,
- core Customer/Driver flow works on physical devices,
- Admin shows the same state,
- any P0 fix has a regression test or reproducible verification step.
