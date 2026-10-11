# Phase 4 Native QA Certification

**Status: STATIC APK BUILD / INSTALL / STARTUP COMPLETE — visual comparisons PARTIAL; functional/provider QA BLOCKED.**
**Safety label:** **STATIC-VISUAL-QA ONLY — PRODUCTION API EMBEDDED — NO FUNCTIONAL TESTING**
**Phase 4 branch:** `release/snar-v10-phase4-native-qa`
**Phase 3 baseline:** `9ad560c56f562da3c65b011e8c1d5b2aa854d7a8`
**Build source SHA:** `3da8fb282790354127bc2277601e2af8156c0f86`

## 1. Executive status

Both existing internal Android APK builds succeeded, were downloaded, identity-checked, installed and launched on the quarantined `Pixel_10` emulator. Five product screens were captured and compared with the approved references: **0 MATCHED / 5 PARTIAL**. One extra screenshot records a transient Android System UI prompt, not an app screen. Airplane mode remained enabled, Wi-Fi disabled, and `Active default network: none` was verified before installs and launches. No production API request or provider action was made.

The installed apps remain strictly offline and were used only for static splash/onboarding/login presentation. All functional flows stay blocked until a non-production staging environment and explicit authorization exist.

## 2. Baseline and Phase 4 branch

- Phase 3 baseline: `9ad560c56f562da3c65b011e8c1d5b2aa854d7a8`.
- Build source: `3da8fb282790354127bc2277601e2af8156c0f86`.
- Phase 4 branch: `release/snar-v10-phase4-native-qa`.
- No merge to `main`; no production deployment or database operation.

## 3. Customer APK result

- EAS build: `9f40ac6d-eef4-4698-b1a3-310867731d87` — **BUILD PASS**.
- Profile/platform: `apk`, Android internal APK.
- Package ID: `no.kjapp.app`; iOS bundle remains `no.nexorahub.kjapp.customer`.
- Build page: https://expo.dev/accounts/elitetransport/projects/kjapp/builds/9f40ac6d-eef4-4698-b1a3-310867731d87
- Artifact: [Customer APK](https://expo.dev/artifacts/eas/PRew1WwSAErvVKkbBXLp7T273FB88cVBaPxRHNcNRvU.apk); local path `artifacts/phase4-static-visual-qa/customer/9f40ac6d-eef4-4698-b1a3-310867731d87/SNAR-Customer-Phase4-static-visual.apk`.
- Source SHA `3da8fb282790354127bc2277601e2af8156c0f86`; profile `apk`; version `1.0.0` / version code `9`; APK manifest package `no.kjapp.app`; signature verification **PASS**.
- APK size 237,305,491 bytes; SHA-256 `E33FE67E30AEC05435C5A962C81432594117836E9089D49A9202184F28379DE7`.
- **INSTALL PASS / STARTUP PASS** — `.MainActivity` launched offline to splash/onboarding/login presentation without native fatal exception. Customer was later terminated by Android with `LOW_MEMORY` while both apps were resident; it relaunched normally after Driver was force-stopped.
- Native comparison captures: C01 splash, C03 onboarding and C04 login. All **PARTIAL**; details in `PHASE4_VISUAL_QA_MATRIX.md`.

## 4. Driver APK result

- EAS build: `2b98c687-e2d1-492c-aa2e-f6fea6e40539` — **BUILD PASS**.
- Profile/platform: `apk`, Android internal APK.
- Package ID: `no.kjapp.driver`; iOS bundle remains `no.nexorahub.kjapp.driver`.
- Build page: https://expo.dev/accounts/elitetransport/projects/kjapp-driver/builds/2b98c687-e2d1-492c-aa2e-f6fea6e40539
- Artifact: [Driver APK](https://expo.dev/artifacts/eas/ZPYUmRRz4PWz_xl8UE-rSqvNbxl5671VvCpCIOGzmk4.apk); local path `artifacts/phase4-static-visual-qa/driver/2b98c687-e2d1-492c-aa2e-f6fea6e40539/SNAR-Driver-Phase4-static-visual.apk`.
- Source SHA `3da8fb282790354127bc2277601e2af8156c0f86`; profile `apk`; version `1.0.0` / version code `1`; APK manifest package `no.kjapp.driver`; signature verification **PASS**.
- APK size 245,937,470 bytes; SHA-256 `6776CB63CA7EB753B057CCEF964E1A1A28D95A027D84EB34B1A68E9CE5B1C3E1`.
- **INSTALL PASS / STARTUP PASS** — `.MainActivity` reached splash/login presentation offline without an app fatal exception. One transient Android “System UI isn’t responding” prompt appeared; choosing the OS **Wait** action revealed the app. No app ANR/fatal was found in the inspected logcat window.
- Native comparison captures: D01 splash and D02 login. Both **PARTIAL**; details in `PHASE4_VISUAL_QA_MATRIX.md`.

## 5. Build configuration findings

See `PHASE4_NATIVE_BUILD_AUDIT.md`. Both EAS profiles embed `https://api.kjappapp.no`; the URL was not changed. Neither profile is safe for functional QA. Internal APKs are quarantined. Customer build-only authorization is limited to EAS profile `apk`; normal Customer builds remain unauthorized.

## 6. Visual QA summary

Approved visual source: `SNAR_V10_VSCode_Package.zip`. Screen-by-screen capture/comparison evidence is tracked in `PHASE4_VISUAL_QA_MATRIX.md`.

- Native product screenshot comparisons: **5** (1080×2424; references 391×845); one additional OS-warning screenshot is retained separately.
- `MATCHED`: **0**.
- `PARTIAL`: **5** (C01, C03, C04, D01, D02); observed presentation differences and exact screenshot/reference paths are in the matrix.
- `BLOCKED`: **60**.
- `NOT RUN`: **2** (C36, D31).
- No pixel-perfect claim is made. Install/startup PASS is not evidence of functional behavior.

## 7. MATCHED / PARTIAL / BLOCKED / NOT RUN

| State | Count | Evidence |
|---|---:|---|
| MATCHED | 0 | No screen was fully matched to the approved reference. |
| PARTIAL | 5 | C01/C03/C04/D01/D02 have direct native screenshot comparisons; see the visual matrix. |
| BLOCKED | 60 | Backend/provider-dependent or unsupported states remain unavailable under production API quarantine. |
| NOT RUN | 2 | C36 and D31 were not captured as local-only states. |

Counts reflect the 67-row Phase 4 matrix. The Phase 3 audit's 67 primary-screen baseline (0 MATCHED / 65 PARTIAL / 2 BLOCKED) is historical and not a Phase 4 screenshot result.

**Physical/device QA:** 3 static/install evidence checks PASS, 0 FAIL; QA01–QA28: **28 BLOCKED**. Evidence is from the `Pixel_10` emulator; no physical handset QA was performed.

## 8. Customer physical/device QA

**Functional QA: BLOCKED.** Only static onboarding/login presentation and offline install verification may proceed. No Customer auth, location, map data, search, booking, payment, messages, profile/settings, support, receipt, rating or history route may be used.

## 9. Driver physical/device QA

**Functional QA: BLOCKED.** Only static unauthenticated entry/login presentation and offline install verification may proceed. No Driver login, GPS, online/dispatch, offers, trips, messages, documents/selfie, profile/settings, earnings, Fleet, support, payout or push route may be used.

## 10. Provider QA

**BLOCKED / NOT RUN.** No Google/Apple sign-in, Stripe/SCA/wallet, push, email, camera identity provider, Supabase or other provider action has been performed. No payout, charge, or test transaction has been created.

## 11. GPS / push / native state

- Physical GPS and background GPS: **BLOCKED**.
- Push token registration/delivery: **BLOCKED**.
- Camera/document/selfie capture: **BLOCKED**.
- External navigation handoff: **BLOCKED**.
- Only emulator offline/safe-area/native static layout observations may be recorded.

## 12. Payment / SCA

**BLOCKED / NOT RUN.** The Customer APK contains payment integrations and the production API URL. Do not open or invoke payment routes. No real or sandbox payment was performed.

## 13. Identity / selfie

**BLOCKED / NOT RUN.** No login, identity verification, camera capture, upload or document flow was invoked.

## 14. Restart / recovery

**BLOCKED / NOT RUN.** Active-trip or authenticated recovery would require backend interaction. No backend-connected recovery is to be attempted in this static-only phase.

## 15. Receipt / earnings

**BLOCKED / NOT RUN.** These screens require authenticated server state and must not be opened.

## 16. Remaining blockers

- No remaining APK build/install/startup task is open. Static visual comparisons are recorded as PARTIAL with measured presentation differences.
- All backend/provider-connected flows require a separate non-production staging backend.
- Existing documented blockers remain: Customer SMS OTP, scheduled booking, generic inboxes, live operator support and entrance/pedestrian guidance; Driver SMS OTP, BankID, Driver Intelligence, generic inbox and unsupported staged pickup cues.

## 17. Regression results

No native functional fixes have been made. Phase 4 final regression gate: backend compile **PASS**; certified backend boundary **277 passed, 7 subtests passed, 0 failed**; Customer TypeScript **PASS**; Driver TypeScript **PASS**; Customer design suite **PASS**. The boundary ran all 26 certified test files.

## 18. TypeScript / API results

- Customer TypeScript: PASS after `npm ci` and final Phase 4 gate.
- Driver TypeScript: PASS after `npm ci` and final Phase 4 gate.
- Customer Expo Doctor: 21/21 PASS after installation settled.
- Driver Expo Doctor: 21/21 PASS.
- Customer design suite: PASS.
- Customer API audit: 241 routes / 161 contracts / 0 unmapped (static source audit; no live API calls).
- Driver API audit: 61 wrappers / 61 mapped / 0 unmapped (static source audit; no live API calls).

## 19. Release recommendation

**CONDITIONAL GO — internal static-visual QA is complete for the five safely reachable screens only.** APK builds, package identities, installs and offline startup passed. All functional/backend/provider QA remains blocked; do not use these production-connected APKs online or treat this as release approval. The observed partial visual differences are recorded for follow-up review; no code changes or replacement builds were made.

## 20. Explicit operation record

- Merge to `main`: **NOT DONE**.
- Production backend/web deployment: **NOT DONE**.
- EAS Update / OTA: **NOT DONE**.
- Store submission / TestFlight: **NOT DONE**.
- Production database mutation: **NOT DONE**.
- Real payout or unauthorized provider transaction: **NOT DONE**.
