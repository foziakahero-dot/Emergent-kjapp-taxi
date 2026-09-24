# KJAPP Physical Oslo Beta QA

Status: **release gate**. This checklist validates the existing Customer and Driver products; it does not redesign either app.

## Test devices

Minimum:
- 1 physical iPhone for Customer
- 1 physical iPhone or Android phone for Driver

Preferred:
- 1 Customer phone
- 2 Driver phones/accounts to verify real sequential dispatch and losing-driver protection
- one Android and one iPhone represented across the set

Record for every run:
- date/time
- Customer app version/build
- Driver app version/build
- phone model + OS version
- backend target
- trip_id
- Customer account
- Driver account(s)
- result + screenshots/video for failures

Never store passwords, Apple keys, Expo tokens or Stripe secrets in this document.

## Pre-flight

Before starting:
- [ ] reviewed branch is the build source
- [ ] backend target is explicitly known
- [ ] Customer can log in
- [ ] Driver account is approved and tied to an active fleet
- [ ] Driver has a valid assigned vehicle
- [ ] Customer has a Stripe-verified test payment method
- [ ] Customer location permission is granted
- [ ] Driver foreground + background location permissions are granted
- [ ] Customer notification permission is granted
- [ ] Driver notification permission is granted
- [ ] Admin can see the same Driver account and fleet
- [ ] Admin booking kill switch is OPEN for the test
- [ ] `GET /api/health` is healthy
- [ ] `GET /api/ready` is ready for the intended beta environment
- [ ] `KJAPP_AUTO_CHARGE_ENABLED=false` unless the separate Stripe auto-charge test has already passed

## A. Native install / startup

Customer:
- [ ] clean install launches
- [ ] returning install launches
- [ ] fonts/icons/maps render
- [ ] login works
- [ ] Sign in with Apple works on physical iPhone
- [ ] forgot-password deep link opens the Customer reset screen
- [ ] the same reset email works through `https://kjappapp.no/reset-password/:token` if the app cannot open
- [ ] existing account without current legal consent is sent through the consent gate

Driver:
- [ ] clean install launches
- [ ] approved Driver login works
- [ ] unapproved Driver is blocked from live Driver routes
- [ ] approved legacy Driver without current legal consent is sent to the Driver consent gate before push/GPS starts
- [ ] forgot-password deep link opens the Driver reset screen
- [ ] going online starts the correct location runtime

## B. Push with screen locked

Driver:
1. Put Driver online with fresh GPS.
2. Lock the Driver phone.
3. Customer requests a real beta trip.

Verify:
- [ ] native new-trip notification arrives while locked
- [ ] notification opens the Driver app
- [ ] visible offer is the same canonical trip
- [ ] offer countdown matches server expiry
- [ ] no duplicate offer notifications for the same offer cycle

Customer:
- [ ] driver-assigned push arrives
- [ ] approaching push occurs at most once when real ETA reaches threshold
- [ ] arrived push arrives
- [ ] trip-start push arrives
- [ ] payment state push deep-links to a valid receipt/booking screen

## C. Dispatch integrity

With two eligible Drivers:
- [ ] both are approved, online and have fresh real GPS
- [ ] nearer Driver receives the sequential offer first
- [ ] farther Driver cannot see/snipe that offer
- [ ] decline forwards to next eligible Driver
- [ ] expired offer cannot be accepted
- [ ] once one Driver accepts, the other receives 409 / cannot win
- [ ] accepting Driver cannot accept a second active trip
- [ ] Customer cannot create a second active booking

## D. Real GPS / background behavior

Driver:
- [ ] idle-online location updates are lower-frequency
- [ ] active-trip location switches to higher-frequency mode
- [ ] lock Driver phone for at least 3 minutes during active ride
- [ ] background GPS continues
- [ ] Admin Live shows fresh Driver GPS
- [ ] Customer sees movement without manual refresh
- [ ] impossible/stale sample is not treated as fresh location

Customer:
- [ ] denying location does not silently book from Oslo-centre fallback
- [ ] re-enabling permission and retrying restores real pickup position
- [ ] stale Driver GPS produces recovery warning instead of fabricated movement/ETA

## E. Full canonical ride

Use a controlled Oslo route.

1. Customer:
   - [ ] chooses real pickup
   - [ ] chooses destination
   - [ ] sees route
   - [ ] sees backend fare
   - [ ] sees verified payment method
   - [ ] requests trip

2. Dispatch:
   - [ ] Customer enters searching state
   - [ ] eligible Driver receives offer
   - [ ] Driver sees real pickup distance/ETA
   - [ ] Driver accepts
   - [ ] Customer sees real Driver / car / plate / ETA

3. Pickup:
   - [ ] Driver navigation opens with correct pickup coordinates
   - [ ] Driver GPS moves on Customer map
   - [ ] server rejects “arrived” if Driver is too far away
   - [ ] server accepts “arrived” near pickup
   - [ ] Customer sees Driver arrived
   - [ ] no-show cannot be used before configured wait time

4. Trip:
   - [ ] Driver cannot start before at-pickup
   - [ ] Driver starts trip
   - [ ] Customer transitions to in-trip automatically
   - [ ] Driver navigation opens correct destination
   - [ ] chat Customer -> Driver works
   - [ ] chat Driver -> Customer works
   - [ ] share-trip link works
   - [ ] emergency action records safety event and opens intended emergency flow

5. Destination:
   - [ ] server rejects completion far from destination
   - [ ] server accepts arrival near destination
   - [ ] Driver receives trip earnings result
   - [ ] Customer can complete/idempotently reload completed ride
   - [ ] Customer receipt uses the same server-side fare
   - [ ] Customer rating succeeds once
   - [ ] duplicate Customer rating is rejected
   - [ ] Driver can rate Customer after ride

6. Cross-system:
   - [ ] Admin shows same trip_id/status/customer/driver
   - [ ] Admin timeline has the same lifecycle timestamps
   - [ ] Fleet sees the same assigned Driver/trip/earnings
   - [ ] no fabricated/demo data is mixed into the ride

## F. App/network recovery

During a separate ride:
- [ ] background Customer for 2–5 minutes, reopen -> correct active trip restored
- [ ] kill/restart Customer -> correct active trip restored
- [ ] background Driver for 2–5 minutes -> active trip remains canonical
- [ ] kill/restart Driver -> current trip restored
- [ ] switch Wi-Fi -> mobile data -> ride survives
- [ ] temporary network loss -> no duplicate booking
- [ ] temporary network loss -> no duplicate state advance
- [ ] temporary network loss -> no duplicate payment

## G. Stripe beta payment

Manual Checkout path:
- [ ] checkout amount equals server-side fare
- [ ] return bridge opens native Customer app
- [ ] webhook/payment status is idempotent
- [ ] refreshing/retrying does not create a second paid transaction
- [ ] failed/3DS-required path leaves ride lifecycle intact
- [ ] receipt reflects payment state
- [ ] Admin Finance sees the same transaction
- [ ] Connect destination/commission matches intended fleet

Automatic saved-card path:
- keep `KJAPP_AUTO_CHARGE_ENABLED=false` until a dedicated Stripe test run is approved.
- when testing it, use Stripe test mode only and verify success, requires-action, failure and duplicate retry behavior before enabling anywhere else.

## H. Support / account / privacy

Customer:
- [ ] Help opens `https://kjappapp.no/help`
- [ ] Privacy opens `/personvern`
- [ ] Terms opens `/vilkar`
- [ ] GDPR export works
- [ ] account deletion requires explicit confirmation

Driver:
- [ ] Help opens canonical KJAPP help
- [ ] Privacy/Terms use `kjappapp.no`
- [ ] logout stops background location
- [ ] logout removes this device's push subscription

## I. Release evidence

A run is considered **green** only when:
- all core ride-path checks above pass on physical devices
- no unexplained duplicate assignment exists
- no unexplained duplicate charge exists
- locked-screen Driver push works
- Driver background GPS works
- restart recovery works
- Admin/Fleet agree with mobile canonical state
- any P0/P1 failure is fixed and retested

Attach/record:
- build URLs/IDs
- trip IDs used
- screenshots of key states
- Stripe test transaction IDs
- failed-case notes
- final PASS/FAIL sign-off

## Merge gate

Only after build validation + physical QA + deployment smoke:
1. deploy reviewed beta backend to the controlled beta environment
2. run `backend/scripts/release_smoke.py`
3. run one final physical end-to-end ride
4. resolve any P0/P1
5. mark PR #44 ready for review
6. merge to `main`
7. then proceed with the separately planned backend-ownership migration
