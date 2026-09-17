# KJAPP GOLD rebase

This branch implements the first native product pass from the KJAPP design contract.

## Implemented

- Customer core palette rebased to `#050A0F` with cyan `#00E5F5`.
- Driver core palette rebased to `#050A0F` with operational green `#39E58C`.
- Geist is the core Customer and Driver product font through `@expo-google-fonts/geist`; JetBrains Mono remains for tabular operational numbers.
- Semantic spacing, radius and motion tokens are shared across the native themes.
- Customer Login and Register now use the same GOLD hierarchy, KJAPP wordmark, Geist typography and accessible password controls as the product surfaces.
- Driver Login uses the operational green identity without a generic decorative car badge, and online status is only chosen after authenticated entry.
- Customer Home is destination-first with voice embedded in the destination surface.
- Customer primary navigation is mobility-first: Home / Trips / Profile. Assist is contextual and hidden from the primary tab bar.
- Vehicle selection exposes KJAPP, KJAPP XL and Premium while preserving the existing backend identifiers.
- Generic vehicle glyphs were replaced by a dedicated three-vehicle vector asset family.
- KJAPP Assist is a booking companion rather than a chatbot-first mode: explicit voice states, real place search, real quote/ETA, vehicle selection and explicit confirmation before trip creation.
- Immediate one-sentence ride intent such as `Kjør meg til Gardermoen` resolves current pickup plus real destination search. Future-time phrases are blocked because scheduled rides are not implemented in the current trip API.
- Active-trip Customer UI now exposes network degradation instead of silently swallowing polling errors.
- `cancelled_by_driver` is treated as a final state with an explicit new-booking recovery path; the UI does not fake automatic reassignment.
- Customer Settings only exposes product settings that are supported by the current implementation; the unsupported price-alert UI was removed.
- Driver Dashboard is glance-first with explicit online/offline state, GPS state and real pending-request count.
- Driver map semantics separate operational green (driver/online/pickup) from KJAPP cyan (route/destination).
- Driver earnings and trip detail keep the real fee calculation internally but do not surface a commission percentage in the native app UI.
- Driver and Customer vehicle metadata use the same KJAPP / KJAPP XL / Premium taxonomy.

## Preserved

- Existing backend API contracts.
- Existing vehicle backend identifiers (`ai-first`, `trygg`, `premium`).
- Existing pricing, payment and dispatch calls.
- Existing map provider and real tile/route data.
- Existing fee calculation from backend payout data.

## Validation

- Netlify deploy preview is green on the GOLD branch.
- Vercel previews for Home, Admin and Fleet are green on the GOLD branch.
- Expo native Driver diagnostic is attached to branch commits and must complete successfully before this PR is treated as build-verified.
- A temporary GitHub Actions typecheck previously failed before job creation (`startup_failure`, zero jobs); it was removed and is not used as evidence of a code failure or success.

## Remaining GOLD work

- Complete device QA at 320 / 360 / 390 / 430+ widths.
- Verify native Android/iOS build artifacts after the Expo diagnostic is green.
- Continue state-specific polish where production API behavior exposes additional edge cases.
