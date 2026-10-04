# KJAPP mobile — Emergent pixel-perfect implementation contract

## Non-negotiable source of truth
The already-approved KJAPP mobile design in the Emergent project is the visual source of truth. This branch is NOT a redesign. Do not invent new layouts, spacing, typography, icons, cards, navigation, map treatment, or visual hierarchy.

When an implementation screen differs from the approved Emergent screen, change the implementation while preserving the real backend/API behavior.

## Architecture that must remain unchanged
- Customer app: `frontend/`
- Driver app: `driver-app/`
- Customer package/bundle id: `no.kjapp.app`
- Driver package/bundle id: `no.kjapp.driver`
- Shared production backend: `https://github-app-builder-28.emergent.host`
- API base: `/api`
- Backend: FastAPI + MongoDB
- No Supabase migration
- No fake/demo production data
- Admin is separate and must not be redesigned by this branch

## Production fixes that must not regress
The map/account UX fix merged in commit `968df84b6291a8acaca8ad3952d4bfecbedb5ead` is baseline behavior:
- street/place labels
- real current location marker
- pan
- pinch zoom
- +/- zoom controls
- recenter
- controls accessible above sheets
- account deletion exposed from customer Profile with confirmation
- equivalent interactive map behavior in Driver

## Customer screen audit
Each screen must be matched against the corresponding approved Emergent design before being marked complete.

1. Splash / launch
2. Entry / welcome
3. Login
4. Register
5. Home / map
6. Destination search
7. Saved places
8. Vehicle-class selection
9. Payment-method selection
10. Booking confirmation
11. Searching for driver
12. Driver assigned / approaching
13. Driver arrived
14. Active trip
15. Trip completed
16. Receipt
17. Trip history
18. Profile
19. Settings
20. GDPR / delete-account confirmation
21. Empty states
22. Error/loading states

Customer implementation routes currently include `frontend/app/(app)/home.tsx`, `history.tsx`, `profile.tsx`, `frontend/app/booking/[tripId].tsx`, `frontend/app/receipt/[tripId].tsx`, `frontend/app/saved-places.tsx`, `frontend/app/payment-methods.tsx`, `frontend/app/settings.tsx`, login/register and related routing.

## Driver screen audit
1. Driver splash
2. Driver login
3. Driver home / map
4. Offline state
5. Online / available state
6. Incoming trip request
7. Accepted / to passenger
8. Arrived
9. Pickup / start trip
10. Active trip / navigation
11. Complete trip
12. Driver trip history
13. Earnings
14. Driver profile
15. Driver settings
16. Driver GDPR / delete-account flow
17. Empty states
18. Error/loading states

Driver implementation routes currently include `driver-app/app/(driver)/home.tsx`, `earnings.tsx`, `profile.tsx`, `driver-app/app/driver-trips.tsx`, `driver-login.tsx`, `driver-settings.tsx` and related routing.

## Pixel-perfect acceptance criteria per screen
A screen is complete only when all are checked:
- [ ] exact component positions
- [ ] exact horizontal/vertical spacing
- [ ] exact margins/padding
- [ ] exact sizing
- [ ] exact border radius
- [ ] exact typography family/weight/size/line-height
- [ ] exact colors/opacity/surfaces
- [ ] exact icon family/size/placement
- [ ] exact cards/chips/buttons/inputs
- [ ] exact sheet height/radius/overlay
- [ ] exact tab/navigation treatment
- [ ] correct safe areas on real Android dimensions
- [ ] all visible controls functional
- [ ] real API data only
- [ ] loading state
- [ ] empty state
- [ ] error state

## Map contract
Map must remain a real interactive production map while visually matching the approved Emergent design. It must preserve labels, user GPS, pickup/dropoff, route, active driver position, pan, pinch-to-zoom, +/- and recenter. Do not replace it with a static mockup just to achieve visual similarity.

## Agent rules
Any coding/review agent working on this branch must:
1. inspect the approved Emergent reference for the target screen before visual changes;
2. modify only the target screen/component set for that pass;
3. preserve API/auth/business logic unless fixing a verified bug;
4. never introduce placeholder production values;
5. report exact files changed and remaining mismatches;
6. never claim pixel-perfect without a visual comparison against the approved reference.

## Build/release
- Customer EAS workflow lives under `frontend/.eas/workflows/`.
- Driver EAS workflow lives under `driver-app/.eas/workflows/`.
- Pixel-perfect work should be reviewed on this branch and only merged to `main` after mobile visual QA.
