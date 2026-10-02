# KJAPP Figma implementation audit — 2026-10-02

## Outcome

The requested complete pixel-for-pixel implementation is NOT complete. No live Figma screen, asset geometry or motion comparison passed in this session. The existing partial port remains in draft PR #65. This session changes only build dependency installation and adds this audit; it does not claim new visual implementation.

Audited mobile source commit: `bc7d0da232010b379c8d35616bb841e8d023afe3`.
Design source: https://www.figma.com/make/y94k21wsXX8d9sI966cOAY/Revolutionary-AI-Taxi-App-Design

## Integration checked

| PR | Actual state | Relationship |
| --- | --- | --- |
| #60 | Merged | Earlier mobile UI and Mapbox changes already integrated |
| #62 | Merged | Expo 57 release corrections already integrated |
| #64 | Open, draft | Native auth/payment foundation, based on beta |
| #65 | Open, draft | Partial Figma port, stacked on #64 |

PR #65 head was checked again before publishing these changes. No older UI branch was imported and neither #64 nor #65 was merged.

## Mobile architecture

Reviewed 22 Customer route files and 15 Driver route files, plus their application source (94 TS/TSX files in total).

- Both mobile API clients and all EAS build profiles target `https://api.kjappapp.no`.
- No Supabase dependencies appear in either mobile package manifest, and no Supabase references appear in either app's TS/TSX source.
- The existing KJAPP API clients for auth, places, nearby cars, quotes, booking, trip lifecycle, chat, payments, safety and receipts remain in place.
- This is a source audit, not proof that all live backend flows work. A read-only API health probe timed out after 10 seconds; this does not establish backend downtime.

## Concrete visual and motion findings

Targets in this table come from the repository's previously extracted `docs/FIGMA_MAKE_PIXEL_SOURCE_20261002.md`. They have not been reconfirmed against the current live Make source.

| Area | Documented target | Current source | Result |
| --- | --- | --- | --- |
| Font coverage | Inter 400/500/600/700/800 | Both themes load only 400/500/600/700 | Inter 800 absent |
| Mono coverage | JetBrains Mono 400/500 | Only local Regular TTF is loaded | Mono 500 absent |
| Shared button typography | Inter | Button text uses fontWeight with no fontFamily; its View parent does not supply text inheritance | Shared controls do not explicitly select Inter |
| Shared button press | Scale 0.95 | Both shared Button components use 0.99 | Source mismatch |
| Sheet timing | 300 ms | Both themes declare 280 ms; token usage must be confirmed during port | Token mismatch, actual transition parity unverified |
| Entrance motion | 700 ms with specified cubic easing and 14 px rise | No corresponding shared entrance implementation found | Not verified/implemented as specified |
| Matching spinner | 900 ms linear | Customer booking uses 900 ms and Easing.linear | Source duration/easing match; appearance unverified |
| Reduced motion | System preference collapses animation | Neither mobile source references useReducedMotion, isReduceMotionEnabled or reduceMotionChanged; explicit splash/spinner loops do not consult it | Missing explicit preference handling |
| Icon and image geometry | Exact Make assets and sizing | Current native assets/icons could not be compared to readable Make source | Unverified |
| Screen spacing, type size, shadows, radii | Exact per-screen source | No same-size reference/native renders available | Unverified |

Font loading alone is not proof that every screen uses the intended font. Existing comparison document labels such as IMPLEMENTED remain source-level assertions, not passed pixel comparisons.

## Checks executed in this session

Environment: Node 24.19.0, npm 11.9.0, Expo SDK 57 and React Native 0.86.3. Read the versioned Expo 57 documentation required by both mobile AGENTS.md files before preparing changes.

| Check | Customer | Driver |
| --- | --- | --- |
| npm ci --no-audit --no-fund | PASS | PASS |
| npx tsc --noEmit | PASS | PASS |
| npx expo-doctor@latest | 21/21 PASS | 21/21 PASS |
| Android Hermes JavaScript export | PASS | PASS |
| iOS Hermes JavaScript export | PASS | PASS |
| Signed APK | NOT BUILT | NOT BUILT |
| IPA/TestFlight | NOT BUILT | NOT BUILT |
| Physical phone auth/trip/payment | NOT TESTED | NOT TESTED |
| Figma visual/motion comparison | BLOCKED | BLOCKED |

Both exports package the local JetBrains Mono Regular font and Inter 400–700. They do not include the missing target font weights. JavaScript exports are not APK/IPA compilation.

## Changes published by this audit

The Android native, iOS simulator, EAS Android and EAS iOS workflows now run `npm ci --no-audit --no-fund` instead of `npm install`. This prevents fresh build dependency resolution from drifting away from the tested committed lockfiles. All four workflow files parse as valid YAML. Existing trigger, credential, signing, API-target and payment behavior is unchanged. The native Android and iOS workflow file updates request new push-triggered build attempts on the current Figma branch.

## Verified blockers

1. Figma get_design_context for Make root 0:1 returned links for 27 source files and 28 image resources, not readable source bodies or a reference screenshot. App.tsx resource reads return Unknown resource. A second request with forceCode returned the same links. get_screenshot explicitly rejects Make files. The current Make source/assets/renders are therefore unavailable through the connected tools.
2. The latest existing GitHub run at the audited head, https://github.com/foziakahero-dot/Emergent-kjapp-taxi/actions/runs/36996628221, is completed/startup_failure with zero jobs. The retry request returned HTTP 403: This workflow run cannot be retried. The underlying startup cause is not established; it is not a failing app compilation.
3. This session has no EXPO_TOKEN or configured Android SDK and runs Linux without Xcode. The connected GitHub tools do not expose workflow_dispatch. Signed EAS builds cannot be requested directly from this session.

## Required continuation

Obtain readable current Make source, assets and screen/state renders through an approved browser export or a supplied Make source export. Port each remaining mismatch into the existing native apps, keeping production data and APIs authoritative. Compare screenshots at identical dimensions and test motion including reduced motion. Then compile native APK/IPA and verify the complete Customer/Driver lifecycle on phones.

No visual completion, merge readiness, successful signed build or beta acceptance is asserted.
