# Native bundle verification after three screen pairs — 2026-10-14

Source: 9ac28fb74507f85d154e82e41b8b7903a440bea8 on implementation/snar-v10-screens-20261013. Code pairs: auth/registration 20892fd828d6307513530db001a761ea1264ccd3; Customer home/search 47f544c2dfdc03456dfcfb9de06754f299476444; introduction/permission 9ac28fb74507f85d154e82e41b8b7903a440bea8. All 31 changed published blobs were verified against the local tested contents.

An automatic approval review rejected following up the initial Expo export because the CLI could contact cdp.expo.dev. We inspected the installed CLI's telemetry/index.js and api/rest/wrapFetchWithOffline.js: EXPO_OFFLINE/EXPO_NO_TELEMETRY return no telemetry client and disable REST networking. We then performed a materially safer offline-only export with both flags set. No cloud EAS build/upload or submission was initiated.

All four local Expo Metro/Hermes exports exited 0, using EAS_BUILD_PROFILE=qa and EXPO_PUBLIC_BACKEND_URL=https://api-qa.snarapp.no. The canonical QA URL is present in each resulting Hermes bundle. These are local JavaScript/native-module bundle checks, not signed Android/iOS builds, device tests or store submissions.

| App/platform | Modules | Bundle bytes | SHA-256 |
|---|---:|---:|---|
| Customer Android | 2283 | 5507968 | 9392cffbc89a55e70299a222d6e96a5918cb9b0421c71d5fd3adabb815c93337 |
| Customer iOS | 2197 | 5302423 | 485b7e6e1f8853e28a10e7212969c7da40f15be0b0f9fdc1c5cbf11a0738d15b |
| Driver Android | 2136 | 5079575 | d1d9993a4b7c497a1fbe66fe56f154a0616c3f1ed60853284d199e6e074dc235 |
| Driver iOS | 2051 | 4879608 | 833ec5e9b629b6781ca1fd288e452a17abde826a6a152dc59c0064d80ca6db60 |

Both TypeScript checks and the actual-screen behavior suites pass. Native Mapbox camera and availability geometry tests pass. Web captures were inspected for auth, registration, home/search, introduction/permission in both themes; geographic tiles did not load in the capture environment, so full native cartography/pixel equivalence is not claimed.

Live API checks: QA health/readiness and production health returned HTTPS 200/database true; QA ready=true, no blockers, isolated database and Stripe test mode. Correct POST /api/cars/nearby returned 200 and zero qualified cars at the test point. Driver QA password login succeeded. QA provider native config disables Google; this backend explicitly blocks QA native Google and Apple sign-in until separate provider configuration exists. Production Driver Google is enabled but its iOS client is absent. Neither provider login on a physical device nor SMS auth was certified. BankID is excluded per user.

Existing APKs are unchanged and do not contain these screen commits. Native splash assets require new signed binaries to appear at OS cold start. Next source pair: Driver approval/selfie, followed by Customer route/vehicle selection. Preserve already implemented source-matched areas and continue in separate two-screen checkpoints.
