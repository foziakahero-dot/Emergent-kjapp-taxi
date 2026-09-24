# KJAPP Physical Beta Device QA

Use two real phones wherever possible: one Customer device and one Driver device. Keep Admin open on a separate browser.

## Preconditions

- Driver is approved and belongs to an active fleet.
- Driver vehicle/documents are approved.
- Customer has accepted current beta legal gate.
- Customer has a verified Stripe test card/payment method.
- Customer and Driver builds point to the same beta API.
- Push permission is granted on both.
- Driver foreground + background location permission is granted.
- New bookings are OPEN in Admin.

## Core Oslo ride

1. Customer opens app and confirms real current pickup.
2. Select Oslo destination and verify real route/price.
3. Request ride.
4. Admin sees the same trip.
5. Nearest approved online driver receives the offer.
6. Driver locks screen: native offer notification must still arrive.
7. Driver opens offer and verifies pickup distance/ETA/countdown.
8. Driver accepts.
9. Second driver cannot accept that ride.
10. Customer sees driver/vehicle/plate and live map.
11. Move Driver device toward pickup; Customer ETA/distance must update.
12. Driver marks arrived only when physically near pickup.
13. Customer receives arrival state/notification.
14. Driver starts ride only from at-pickup state.
15. Navigate to destination using native navigation.
16. Driver cannot end ride far from destination.
17. At destination, complete ride.
18. Verify payment/receipt state.
19. Customer rates driver.
20. Driver rates passenger.
21. Driver becomes available for a new ride.
22. Admin/Fleet show the same final ride/earnings state.

## Recovery

- Restart Customer while searching.
- Restart Customer after driver accepted.
- Restart Customer during in-trip.
- Restart Driver after accepting.
- Lock Driver screen for 2–5 minutes while moving.
- Switch Wi-Fi → mobile data and back.
- Temporarily remove network; restore it and confirm queued/retry behavior.
- Foreground both apps after 5 minutes and verify canonical state.

## Dispatch race

- Put two approved drivers online.
- Confirm nearest driver gets sequential offer first.
- Far driver must not be able to snipe it.
- First driver declines or times out.
- Offer moves to next eligible driver.
- After assignment, losing driver gets 409/no trip.

## GPS safety

- Attempt accept with stale GPS → blocked.
- Attempt at-pickup far from pickup → blocked.
- Attempt start before at-pickup → blocked.
- Attempt arrive far from destination → blocked.
- Confirm Admin does not count stale driver as fresh/online location.

## Payment

Test Stripe test-mode only before enabling auto-charge:
- normal successful saved-card charge
- repeated tap/request does not create duplicate charge
- payment requires action/3DS → manual Checkout fallback
- failed payment → receipt clearly asks customer to complete payment
- duplicate webhook → no duplicate receipt/charge/state regression
- rated ride remains rated after delayed payment webhook

Keep `KJAPP_AUTO_CHARGE_ENABLED=false` until all payment cases pass.

## Push

On locked screen:
- new Driver offer
- Driver assigned (Customer)
- Driver arrived
- trip started
- approaching notification (one only, no spam)
- payment complete/failure

Tap notification and verify it opens a real route in the correct app.

## Account / legal

- Customer forgot password email → KJAPP deep link.
- Open same reset email without app → kjappapp.no fallback works.
- Reset invalidates old sessions.
- Customer registration cannot proceed without consent.
- Existing social-login account without consent is sent to legal-consent screen.
- Logout removes this device push subscription.
- Driver logout stops background location.

## Release result

Record for every failure:
- app: Customer / Driver / Admin / Fleet
- app version/build number
- device + OS
- trip ID
- exact time
- expected vs actual
- screenshot/video
- P0/P1/P2
