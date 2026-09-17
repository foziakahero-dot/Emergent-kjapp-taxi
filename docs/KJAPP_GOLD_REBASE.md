# KJAPP GOLD rebase

This branch implements the first native product pass from the KJAPP design contract.

## Implemented

- Customer core palette rebased to `#050A0F` with cyan `#00E5F5`.
- Driver core palette rebased to `#050A0F` with operational green `#39E58C`.
- Geist is now the core Customer and Driver product font through `@expo-google-fonts/geist`; JetBrains Mono remains for tabular operational numbers.
- Semantic spacing, radius and motion tokens added to both native themes.
- Customer Home is destination-first and voice is embedded in the destination entry/search surface.
- Vehicle selection now exposes three primary classes: KJAPP, KJAPP XL and Premium.
- Generic one-size-fits-all car glyphs in vehicle selection were replaced by a dedicated three-vehicle vector asset family.
- Driver Dashboard is glance-first with explicit online/offline, GPS state and real pending-request count.
- Driver actions use large operational targets and no commission marketing appears in the app.

## Preserved

- Existing backend API contracts.
- Existing vehicle backend identifiers (`ai-first`, `trygg`, `premium`).
- Existing pricing, payment and dispatch calls.
- Existing map provider and real tile/route data.

## Remaining GOLD work

- Route color separation in Driver map (cyan route vs green driver state).
- Full state matrix for location/microphone/search/quote/payment/reassignment/offline.
- Device QA at 320/360/390/430+ widths.
- Actual Android/iOS build verification. GitHub Actions currently returns `startup_failure` with zero jobs before build execution, so this branch has not yet produced a valid build result.
