# KJAPP — Figma Make pixel source (2026-10-02)

Source of truth:
- Figma Make key: `y94k21wsXX8d9sI966cOAY`
- Design root: `0:1`
- Extraction: Figma Make source code, not screenshot inference.
- Implementation branch: `design/figma-make-pixel-match-20261002`
- Branch base: `ab23e2825a47d6adcfadf1cc080198c17b87b8e9` (native auth / fleet payment foundation).

## Non-negotiable implementation rule

Figma is the visual and motion source of truth. Existing KJAPP production APIs, auth, booking, trip lifecycle, payments, maps, push and safety logic remain authoritative for data and behavior. Do not replace real runtime behavior with Figma demo data.

## Exact visual tokens extracted from Figma Make

- Canvas: `#F4F6FA`
- Surface: `#FFFFFF`
- Soft surface: `#EEF1F5`
- Navy / primary ink: `#001F3F`
- Secondary ink: `#4A5A6E`
- Faint ink: `#8B97A7`
- Primary action red: `#FF0000`
- Bright red: `#FF3B3B`
- Deep red: `#CC0000`
- Soft red: `#FFE6E6`
- Operational green: `#12B981`
- Lines: `rgba(0,31,63,0.10)`
- Strong lines: `rgba(0,31,63,0.18)`
- Primary action gradient: `linear-gradient(120deg,#FF3B3B,#FF0000)`

Typography:
- Display/body: Inter
- Weights used: 400, 500, 600, 700, 800
- Mono/meta: JetBrains Mono 400/500
- Display tracking: -0.02em

Motion:
- Rise: 700 ms, cubic-bezier(0.22, 1, 0.36, 1), translateY(14px) -> 0 + opacity 0 -> 1
- Matching spinner: 900 ms linear infinite
- Bottom-sheet transitions: 300 ms
- Primary press state: scale 0.95
- Map/location control press: scale 0.90
- Reduced-motion must collapse animations to effectively instant.

## Customer screen/state contract extracted from Figma Make

1. Splash / permission / login / setup
2. Map-first Home
   - floating rounded search control
   - full-screen destination search with explicit Avbryt/minimize
   - current-location floating control
   - recent/favorite expandable bottom sheet
3. Destination selected / ride class selection
   - Standard, Comfort, Premium (+ expanded Van / accessible)
   - vehicle silhouette, wait, capacity and backend price
   - primary red CTA remains visible
4. Confirm ride
   - pickup/drop-off route summary
   - fare breakdown from backend
   - payment method
   - red pill CTA
5. Matching
   - live map remains visible
   - frosted/light overlay
   - centered white card
   - spinning red ring around brand mark
6. Driver arriving
   - top ETA card
   - bottom verify-driver card with name, car, plate, rating/photo when available
   - call + message
7. In ride
   - persistent top trip banner
   - progress/ETA
   - bottom controls for share, stop, safety/SOS
8. Receipt / rating
   - paid state
   - fare breakdown
   - driver card
   - 1–5 stars and support actions

## Data mapping rules

Never hard-code Figma demo values in production:
- driver name/photo/car/plate/rating <- active trip backend
- ETA <- fresh driver position / backend ETA
- nearby car markers <- `carsApi.nearby`
- price/distance/duration <- `tripsApi.estimate`
- payment method <- real stored/default payment method
- receipt rows/total <- immutable backend receipt/payment data
- booking/matching state <- canonical trip status

## Static source files extracted from Figma Make

The extraction includes the Figma Make source for:
- `src/App.tsx`
- `src/apps/CustomerApp.tsx`
- `src/apps/DriverApp.tsx`
- `src/components/AppIcons.tsx`
- `src/components/LiveMap.tsx`
- `src/components/SnarMark.tsx`
- `src/components/TaskBar.tsx`
- `src/screens/Splash.tsx`
- `src/screens/Login.tsx`
- `src/index.css`
- supporting design notes and generated assets

These files are reference implementation material. Native Expo/React Native code must reproduce them rather than embedding the Figma web app.

## Verification gate

A screen is not "pixel-perfect" until:
1. target device dimensions are fixed,
2. Figma reference and native render are captured at the same dimensions,
3. typography, spacing, radii, shadows, icon geometry and control positions are compared,
4. motion states are tested,
5. real backend data is exercised,
6. Android APK and iOS/TestFlight build still pass.
