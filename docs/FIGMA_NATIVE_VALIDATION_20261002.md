# Figma mobile implementation validation 2026 10 02

## Result

The Figma port is still work in progress. It has NOT been merged, visually verified, signed, or accepted on physical phones. Existing “IMPLEMENTED” entries in FIGMA_PIXEL_COMPARISON_20261002.md describe source-level assertions, not pixel comparisons or runtime acceptance.

This session corrected 18 references to the removed React Native 0.86 StyleSheet.absoluteFillObject API in 12 Customer/Driver screen files. StyleSheet.absoluteFill restores full-screen overlays, gradients and search/ride layers. It also changed both dynamic Expo configs to consume the incoming normalized static configuration; output equivalence was checked with and without optional Google iOS and Apple Pay identifiers.

Commits:
- d9e2326e26b8485bb7b4f6964902252201ecad27: React Native overlay fix.
- cc8313ea0c8267cc7fb51a25e5f560c1c2c7f7fa: Expo config fix and native CI branch triggers.

## Validation performed

| Check | Customer | Driver |
| --- | --- | --- |
| npm ci from committed lockfile | PASS | PASS |
| TypeScript noEmit after overlay fix | PASS | PASS |
| Expo Doctor after config fix | 21 of 21 PASS | 21 of 21 PASS |
| Expo config prebuild resolution | PASS | PASS |
| Android JavaScript Hermes export | PASS | PASS |
| iOS JavaScript Hermes export | PASS | PASS |
| Native Android and iOS project generation with no install | PASS | PASS |
| Signed Android APK compilation | NOT VERIFIED | NOT VERIFIED |
| Signed iOS build and TestFlight submission | NOT VERIFIED | NOT VERIFIED |
| Physical phone booking and trip flow | NOT VERIFIED | NOT VERIFIED |
| Same-size Figma versus native screenshots | BLOCKED | BLOCKED |

Environment: Node 24.19.0, npm 11.9.0, Expo SDK 57, React Native 0.86.3.

Exports include the local JetBrains Mono Regular asset and Inter 400, 500, 600 and 700. This confirms these fonts are packaged; it does not confirm every text style uses the Figma weight. Inter 800 and JetBrains Mono 500 in the documented Figma specification are not loaded by the current themes.

Native prebuild warned that expo-system-ui is absent for the configured userInterfaceStyle. The warning did not prevent native generation; system appearance behavior is not verified. Generated native directories and prebuild script changes were not published as source changes.

## Current source versus old comparison document

The current branch contains Customer permissions and profile setup routes, Customer registration/forgot/reset styling and Driver forgot/reset styling. The old comparison document still lists these as open. Their existence and compilation are verified here; exact Figma layout, all state transitions and onboarding completion behavior remain unverified.

No Figma source or screenshot was successfully read in this session:
- get_design_context on Make root 0:1 returned resource links.
- reading the returned App.tsx link failed with Unknown resource.
- get_screenshot returned that Make files are not supported.
- direct private Git clone required unavailable Git credentials, so the mobile files and assets were read at the fixed GitHub commit through the connected repository access instead.

No screens or assets were invented to substitute for the inaccessible Figma source.

## Build attempts and external blockers

The Android APK and iOS simulator workflow push triggers now include design/figma-make-pixel-match-20261002. New runs associated with cc8313e completed with startup_failure:
- https://github.com/foziakahero-dot/Emergent-kjapp-taxi/actions/runs/36996431785
- https://github.com/foziakahero-dot/Emergent-kjapp-taxi/actions/runs/36996428676

The runners did not compile the apps. The failure cause is not established by the available run metadata.

This local session has no EXPO_TOKEN or Android SDK; it runs Linux without Xcode. The connected GitHub tools do not expose workflow_dispatch. The existing EAS workflows require manual dispatch and a configured GitHub EXPO_TOKEN; their credentials and account state are not verified here. No signed EAS request or TestFlight submission was made.

A read-only request to https://api.kjappapp.no/api/health timed out after ten seconds in this environment. This does NOT establish that the production backend is down.

## Completion gates

1. Obtain readable current Figma Make source, referenced assets and renders of every requested screen/state.
2. Compare the native implementation at matching dimensions and resolve layout, typography, icon and motion deviations.
3. Verify real auth, fresh GPS supply, quote, booking, offer, acceptance, arrival, trip, chat, payment, receipt and Driver ready-state.
4. Confirm required external Google, Apple, Stripe, Mapbox and push configuration from PR 64 without enabling live payment flags as part of a visual change.
5. Restore a working native build runner or authenticated Expo session, build both apps, then complete physical phone tests.
6. Resolve the stacked PR 64/65 integration against beta/oslo-production-ready only after applicable gates pass.

No beta-ready or pixel-perfect claim is made.
