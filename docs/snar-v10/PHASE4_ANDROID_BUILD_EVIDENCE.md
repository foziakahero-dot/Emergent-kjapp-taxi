# Phase 4 Android Build Evidence

**Required artifact label:** **STATIC-VISUAL-QA ONLY — PRODUCTION API EMBEDDED — NO FUNCTIONAL TESTING**
**Branch:** `release/snar-v10-phase4-native-qa`
**Build source SHA:** `3da8fb282790354127bc2277601e2af8156c0f86`
**Platform:** Android
**Build date:** 2026-10-11 (UTC build timestamps from EAS)
**Backend in both profiles:** `https://api.kjappapp.no` — unchanged, production host. APKs are quarantined; backend-connected/provider-connected testing is forbidden.

| App | EAS project | Build profile | Application ID | EAS build ID | Build page | Artifact URL | Result | Installable APK exists? |
|---|---|---|---|---|---|---|---|---|
| Customer | `kjapp` | `apk` — internal, Android `buildType: apk`, preview environment | `no.kjapp.app` | `9f40ac6d-eef4-4698-b1a3-310867731d87` | https://expo.dev/accounts/elitetransport/projects/kjapp/builds/9f40ac6d-eef4-4698-b1a3-310867731d87 | https://expo.dev/artifacts/eas/PRew1WwSAErvVKkbBXLp7T273FB88cVBaPxRHNcNRvU.apk | **BUILD PASS** | **YES — local APK downloaded and installed** |
| Driver | `kjapp-driver` | `apk` — internal, Android `buildType: apk` | `no.kjapp.driver` | `2b98c687-e2d1-492c-aa2e-f6fea6e40539` | https://expo.dev/accounts/elitetransport/projects/kjapp-driver/builds/2b98c687-e2d1-492c-aa2e-f6fea6e40539 | https://expo.dev/artifacts/eas/ZPYUmRRz4PWz_xl8UE-rSqvNbxl5671VvCpCIOGzmk4.apk | **BUILD PASS** | **YES — local APK downloaded and installed** |

EAS resolved remote Android credentials for both projects. No credential contents or signing values are recorded. No store submission, EAS Update, deployment, or provider operation was requested or performed.

## APK identity and artifact verification

Both successful builds were produced from commit `3da8fb282790354127bc2277601e2af8156c0f86` on `release/snar-v10-phase4-native-qa`. EAS reported SDK `57.0.0`, version name `1.0.0`, internal distribution, and profile `apk`.

| App | APK metadata (`aapt dump badging`) | Local artifact path | Size | SHA-256 | Signature verification |
|---|---|---|---:|---|---|
| Customer | `no.kjapp.app`, version `1.0.0` (code `9`), min SDK `24`, target/compile SDK `36` | `artifacts/phase4-static-visual-qa/customer/9f40ac6d-eef4-4698-b1a3-310867731d87/SNAR-Customer-Phase4-static-visual.apk` | 237,305,491 bytes | `E33FE67E30AEC05435C5A962C81432594117836E9089D49A9202184F28379DE7` | `apksigner verify`: PASS; signer SHA-256 `af35d9d3ba8f1758dd263d84380f739fcb51b8c7fdee0e4aa4d3e6b2190a9bc8` |
| Driver | `no.kjapp.driver`, version `1.0.0` (code `1`), min SDK `24`, target/compile SDK `36` | `artifacts/phase4-static-visual-qa/driver/2b98c687-e2d1-492c-aa2e-f6fea6e40539/SNAR-Driver-Phase4-static-visual.apk` | 245,937,470 bytes | `6776CB63CA7EB753B057CCEF964E1A1A28D95A027D84EB34B1A68E9CE5B1C3E1` | `apksigner verify`: PASS; signer SHA-256 `2a8f4fa0491469fe9018edfa33e92a193ca7dfb6ae871a69906326094aa87590` |

Both observed Android application IDs match `frontend/app.json` and `driver-app/app.json`. Each APK is non-empty, signature-verifies, and resolves to `.MainActivity` as its launcher activity. APKs and raw screenshots are local-only evidence and are not to be committed.

## Warnings and quarantine

- Customer package: `no.kjapp.app`; iOS bundle identifier recorded as `no.nexorahub.kjapp.customer` and not changed.
- Driver package: `no.kjapp.driver`; iOS bundle identifier recorded as `no.nexorahub.kjapp.driver` and not changed.
- EAS injected the public Mapbox access-token variable name into each build environment. Token values are not recorded.
- Driver EAS preview environment also reports Supabase-related public variable names; the application source contains no Supabase references, and Supabase must not be used for this QA.
- Customer and Driver may be installed only on a dedicated network-isolated emulator/device. Limit navigation to splash, onboarding and login presentation; do not authenticate or enter provider/backend-connected screens.
- Do not open real or test accounts, request location, register push tokens, create trips, send messages, change profile/settings, upload identity documents, or invoke payment/support/Fleet/payout flows.
- Node dependency installation reported 24 npm audit advisories per app (23 high, 1 critical); no automated audit remediation was run.

## Install-only evidence

| App | Install result | Device / Android | Package verification | Launch verification | Screenshot evidence |
|---|---|---|---|---|---|
| Customer | **INSTALL PASS** — installed twice from the same APK; both install attempts completed successfully | `Pixel_10`, Android 17 / API 37, `sdk_gphone16k_x86_64`; 1080×2424. Airplane mode on, Wi-Fi off, no active default network before install and launch. | `no.kjapp.app`; `pm path` and `.MainActivity` resolution verified | **STARTUP PASS (with device-memory caveat)** — cold launch reached onboarding/login presentation; no native fatal exception. An earlier process was later killed by Android `LOW_MEMORY` while both apps were resident; Customer relaunched normally after Driver was force-stopped. | Three comparison captures: C01, C03, C04; paths are in `PHASE4_VISUAL_QA_MATRIX.md`. |
| Driver | **INSTALL PASS** — succeeded after freeing emulator space; no replacement build | Same isolated `Pixel_10`; offline state rechecked before install and launch. | `no.kjapp.driver`; `pm path` and `.MainActivity` resolution verified | **STARTUP PASS (with transient emulator warning)** — splash and login rendered after dismissing one Android “System UI isn’t responding” prompt with **Wait**. No app fatal exception or app ANR was found in the inspected logcat window. | Two comparison captures: D01, D02; plus one transient System UI prompt capture documenting the emulator warning. |

During install preparation, both target packages were found already present on the AVD. Only those two apps’ local data was cleared to avoid restoring a saved session. The Customer APK installed; the first Driver install attempt returned `INSTALL_FAILED_INSUFFICIENT_STORAGE`. Customer was temporarily uninstalled to free space; Driver then installed successfully, followed by a successful Customer reinstall. Both packages are currently installed. No unrelated app was removed.

Final quarantine checks reported `Active default network: none`, airplane mode `1`, and Wi-Fi `0`. The app launch and screenshots were performed offline. No account credentials were entered; no provider buttons were activated. The production API URL was not changed. These results certify only build/install/startup and the five named static screen comparisons—not functional QA, production readiness, or release eligibility.
