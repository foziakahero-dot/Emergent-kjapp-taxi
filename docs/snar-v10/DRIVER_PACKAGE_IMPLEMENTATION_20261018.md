# Driver V10 package checkpoint — 18 October 2026

Reviewed against the owner-exported `reference/snar10/src/DriverApp.tsx`, `src/snar10/kit.tsx` and existing native controllers. This implements the supplied package on the existing native screens rather than replacing working controllers with demo transitions. Original export provenance remains in reference/snar10/source-contract.json.

## Changes in this checkpoint

- Extracted actual cockpit Ring, TurnBanner, OnlineChip, OfferSheet and HoldButton into the existing snar10 kit. Existing source Button, Dock, Sheet, Avatar, Badge, Chip, Input, Toggle, TopBar, StateView and typography remain in use.
- Added Ring and GlassView exports to both independent app bundles, identical original VehicleMarker geometry to the Driver kit. The cockpit navigation arrow remains the original driver-specific marker.
- OnlineChip now uses one blur + one tint over a dedicated map-only BlurTargetView. No second solid fill or self-blur target. Source chip geometry is a 40-point power control plus 10-point top/bottom padding (60 total), not a 40-point total container.
- TurnBanner has minimum height 88, 40-point icon, 30-point primary line and source padding/radius. Existing minimize/reopen/navigation actions are retained.
- OfferSheet retains real ETA, addresses, price, disabled/expired/busy guards and server countdown, adds subtle map dimming. Acceptance stays red.
- Existing 900 ms hold for start/finish remains the actual action implementation, including release/unmount cancellation and duplicate guard.
- Offline wash follows the chosen theme; Mapbox uses night preset in dark mode instead of always using day.
- EarningsMeter shows real confirmed daily income against the driver's existing account-scoped personal target. Existing real weekly graph remains; it is labelled as weekly, not presented as hourly shift data.
- Confirmed trip-summary earnings count up over 700 ms, with reduced-motion support and unmount cleanup. Pending payment never animates or claims earnings.
- Drive Intelligence now calls the existing authenticated GET /driver/demand endpoint. It renders actual demand cells and up to three actual zones, with geographic navigation to the selected recommendation. There are no invented hotspots, battery values or income forecasts.
- Freshness/coordinate guards remove malformed, future-dated or >15-minute-old demand. Failed refresh hides stale map/recommendations. Polling only runs while focused.

## Existing screen/controller coverage retained

| Package phase | Existing native entry |
| --- | --- |
| Splash / login / approval | app/index.tsx, app/driver-login.tsx, app/driver-approval.tsx |
| Offline / pending / online / offer | app/(driver)/home.tsx + src/components/DriverCockpitView.tsx |
| Pickup / inside / arrived / waiting / start | DriverCockpitView + existing DriverHome API actions |
| Active / arriving / complete / summary | DriverCockpitView + existing DriverHome state machine |
| Income / detail | app/(driver)/earnings.tsx, app/driver-earnings-detail.tsx |
| Demand insights | app/(driver)/intel.tsx |
| Profile / vehicle / fleet / documents | app/(driver)/profile.tsx, app/driver-vehicles.tsx, app/driver-fleet.tsx, app/driver-documents.tsx |
| Customer messages / settings / identity | app/(driver)/messages.tsx, app/driver-settings.tsx, app/driver-identity.tsx |

## Explicit limits and conflicting package instructions

- IMPLEMENTED / TESTED LOCALLY: components and demand integration above. Existing behavior checks exercise actual trip controllers, 900 ms holds, minimize/reopen, hidden active-trip finances and summary payment gates.
- NOT VERIFIED ON DEVICE: Android blur over Mapbox, navigation typography at real widths, animations and full screenshot parity. Do not describe all screens as pixel-identical without native comparison.
- Offer timeout remains the backend's absolute offer_expires_at (previous approved 30 seconds per driver). Waiting remains waiting_policy.free_minutes (previous approved 2 minutes). The Figma demo's 15/300-second clocks cannot silently override existing pricing/dispatch logic under the instruction to preserve functionality.
- Existing Google/Apple/password authentication is retained. No pretend BankID button/integration was added; earlier owner instructions excluded BankID.
- The banner shows actual known ETA/destination and preserves external navigation. The backend currently supplies route geometry, not a live maneuver stream; no fabricated turn distance or next turn is displayed. True in-app turn-by-turn requires that provider integration.
- No fabricated hourly chart, projected 620 kr/90 min, battery level or charging availability. The existing backend provides historical demand, not those predictions.
- Existing source buttons use press scale .97. A spring animation for every existing control and a full native motion/visual review remain open; this checkpoint does not claim those are completed.

## Release separation

Customer APK 20308cb7-a325-43f1-8a18-ce4ddd493322 was already building exact commit 5fb7bf88e0aa493ccdda6d7d65774bd7ffdfd6c6 in Expo (qa/preview/Android). The corresponding paid Render QA service was deployed live to that exact SHA. This later Driver checkpoint does not change the immutable Customer build. No new Driver or iOS build or production deployment is started here.
