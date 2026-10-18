# SNAR Customer QA pre-build gate — 2026-10-18

Target branch: `qa/snar-v10-phase5-staging-e2e`

This note records the fixes that must be present before the next Customer Android QA build. No Driver build is part of this gate.

## P0 — Add payment card Android crash

Physical QA showed the Android Customer process closing immediately after tapping **Legg til kort**. Render request logs showed `GET /api/payments/native/config` returning 200 while no `POST /api/payments/native/setup-intent` reached the backend for the failing action. The failure therefore happened in the native Customer client before SetupIntent creation.

Root cause: Stripe was initialized at the app root by `NativePaymentProvider` / `StripeProvider` and was also imperatively re-initialized from `nativePayment.native.ts` immediately before native payment operations.

Fix merged previously through PR #116:
- use the root `StripeProvider` as the single Stripe initializer;
- remove duplicate imperative `initStripe()` calls;
- keep ordinary card setup independent from Platform Pay probing;
- retain server-created SetupIntent and server-side verification after PaymentSheet returns.

Physical acceptance remains pending until this source is installed in a new Customer APK. Source/contract validation is not a substitute for opening PaymentSheet on a physical Android device.

## Google Pay availability

Fix merged previously through PR #117:
- Google Pay support detection no longer requires the tester to already have an existing Google Wallet payment method;
- server/device eligibility still controls availability;
- QA/test mode stays isolated from production.

Google Pay remains disabled in QA configuration while the old Customer APK is still in use. Re-enable only after the new APK passes ordinary card setup first.

## Live available cars — reliability

The Customer home screen used the authenticated Socket.IO feed as its only availability transport. On devices/networks where that socket handshake stalled or disconnected, the UI could show **Kan ikke oppdatere ledige biler akkurat nå** even though the same QA backend could answer the canonical nearby-cars REST endpoint.

Pre-build fix:
- Socket.IO stays primary for realtime updates;
- the Customer app now performs a bounded REST recovery against the same `/api/cars/nearby` backend snapshot when the socket reports offline;
- an initial REST recovery also runs if the socket is still loading after a short startup window;
- backend freshness, online/available, radius and assigned-vehicle rules remain authoritative;
- no stale/demo cars are manufactured locally.

## Car marker validation

`InteractiveMap` renders live Driver supply with `V10VehicleMarker` / `V10VehicleBody`. The red circular marker is the Customer's own GPS/pickup marker, not a Driver marker. Once a valid live-car snapshot is present, each Driver is rendered with the car silhouette and an ETA badge.

No replacement dot marker is introduced by this fix.

## Pickup ETA

The backend continues to prefer Google Routes/Distance Matrix road durations. To prevent live cars from having no visible minutes while Google is pending, not configured or temporarily unavailable, the backend now supplies a conservative distance-based fallback that is explicitly labelled:

- `eta_source=distance_fallback`
- `eta_status=approximate`
- client text: `ca N min`

An exact Google road ETA overrides the fallback as soon as it is available. The fallback uses straight-line distance inflated for urban road geometry and a conservative Oslo approach speed; it is never labelled as an exact Google ETA.

The Customer availability caption now includes the nearest pickup time, e.g. `3 ledige biler · nærmeste ca 4 min`.

## Build gate

Before triggering EAS Customer APK:
- [ ] Customer TypeScript passes (`npx tsc --noEmit`)
- [ ] Expo public config resolves QA backend `https://api-qa.snarapp.no`
- [ ] backend Python compiles
- [ ] QA Render deploy is live from the reviewed QA head
- [ ] `InteractiveMap` still uses `V10VehicleMarker`
- [ ] ordinary card path is `native config -> SetupIntent -> initPaymentSheet -> presentPaymentSheet -> server status`
- [ ] no imperative `initStripe()` exists in the payment action path
- [ ] no Driver build is triggered

After installing the new Customer APK, physical QA must verify:
1. Add test card opens Stripe PaymentSheet without process termination.
2. Test card can be saved and appears as verified/default in the app.
3. Home map shows real online/available Driver car markers inside 5 km.
4. Each visible Driver marker shows an ETA; fallback is marked `ca`.
5. Killing/reconnecting the socket does not permanently strand the UI in the offline availability message when REST is healthy.
6. Google Pay is only re-enabled after ordinary card setup is green.

Never store Stripe secret keys, Expo tokens, test-account passwords or other credentials in this document.
