# Phase 4 Physical / Device QA

**Current scope:** static APK install and visual presentation only. Both artifacts embed `https://api.kjappapp.no` and must be **STRICTLY QUARANTINED**. Use an isolated emulator/device with networking disabled before launch. Do not log in or interact with any backend/provider-connected flow.

**Evidence rule:** `PASS` requires recorded device evidence. `FAIL` requires an observed defect. `BLOCKED` means staging/backend/provider capability is required or the action is forbidden in this phase. `NOT RUN` means no attempt has occurred. No functional QA is implied by APK creation, installation, screenshots, TypeScript, or API audits.

## Install-only evidence (outside QA01–QA28)

| Check | Status | Evidence |
|---|---|---|
| Customer APK installation on isolated Android emulator | **PASS** | `no.kjapp.app`, version `1.0.0` (code 9), installed from the successful Phase 4 APK. `Pixel_10`, Android 17/API 37, 1080×2424; offline state verified before install and launches. |
| Driver APK installation on isolated Android emulator | **PASS** | `no.kjapp.driver`, version `1.0.0` (code 1), installed from the successful Phase 4 APK after freeing emulator storage. Same isolated emulator; offline state verified before install and launches. |
| Static splash/onboarding/login screenshot capture | **PASS — 5 product screenshots** | Customer C01/C03/C04 and Driver D01/D02 captured at 1080×2424 and directly compared against approved 391×845 design renders. All five comparisons are PARTIAL; see `PHASE4_VISUAL_QA_MATRIX.md`. One additional screenshot records a transient Android System UI warning. |
| Backend/provider functional interaction | BLOCKED | Production API URL is embedded; no staging backend URL has been approved. |

Customer and Driver both resolved to `.MainActivity` and reached their permitted static presentation without an app native fatal exception. Driver cold start showed a transient OS “System UI isn’t responding” prompt; selecting **Wait** revealed the app. Customer was killed once by Android with `LOW_MEMORY` while both apps were resident and relaunched successfully after Driver was force-stopped. These emulator caveats are not counted as application crashes. APK build/install/startup PASS does not change the functional QA boundary.

**Physical/device QA count:** 3 static/install evidence checks PASS; 0 FAIL; QA01–QA28: **28 BLOCKED**. Testing was on the `Pixel_10` emulator only; no physical handset QA was performed. Backend/provider functional interaction remains BLOCKED.

## QA01–QA28

| ID | Check | Status | Evidence / safe boundary |
|---|---|---|---|
| QA01 | Correct Customer build/backend | BLOCKED | Build identity may be verified locally; production API target is not safe for functional QA. APK must remain offline/quarantined. |
| QA02 | Customer Google sign-in | BLOCKED | No provider sign-in in static-only phase; requires approved staging and safe test account/configuration. |
| QA03 | Customer Apple sign-in | BLOCKED | No provider sign-in in static-only phase; requires approved staging and safe test account/configuration. |
| QA04 | Driver login | BLOCKED | Login screen presentation may be captured; credential submission/account login is prohibited. |
| QA05 | Runtime permissions | BLOCKED | No location/camera/microphone permission workflow in this static-only phase. |
| QA06 | Real GPS and location freshness | BLOCKED | GPS acquisition/update would violate the production API quarantine. |
| QA07 | Two real Drivers | BLOCKED | Dispatch/offer flow requires staging and authorized test accounts. |
| QA08 | Complete Customer-to-Driver ride | BLOCKED | Booking/lifecycle mutations to production are prohibited. |
| QA09 | Stripe reservation/SCA | BLOCKED | No payment/provider action; staging and explicit sandbox configuration required. |
| QA10 | Apple Pay / Google Pay | BLOCKED | No wallet/provider action in this phase. |
| QA11 | Two-Driver accept concurrency | BLOCKED | Dispatch acceptance would mutate production; requires staging. |
| QA12 | Customer restart/recovery | BLOCKED | Active-trip recovery requires backend-connected trip state. |
| QA13 | Driver restart/recovery | BLOCKED | Current-trip recovery requires backend-connected Driver state. |
| QA14 | Wait-inside / pickup guidance | BLOCKED | Requires a real trip and supported backend-provided instructions. |
| QA15 | Cancellation and no-show | BLOCKED | Would mutate a real booking; requires staging. |
| QA16 | Offline action handling | BLOCKED | Functional offline queue/reconciliation requires a staging trip. |
| QA17 | Customer ↔ Driver messaging | BLOCKED | Trip-scoped message API and live assigned trip required. |
| QA18 | Support flow | BLOCKED | Support API invocation is prohibited. |
| QA19 | Driver selfie/documents | BLOCKED | Camera capture, document upload and identity review are prohibited. |
| QA20 | External navigation | BLOCKED | Requires real trip coordinates and external app handoff. |
| QA21 | New-trip push | BLOCKED | Push token registration/delivery is prohibited; safe project staging required. |
| QA22 | Trip-phase push | BLOCKED | Requires real lifecycle state and push registration. |
| QA23 | Customer receipt | BLOCKED | Requires server-authoritative completed/payment state. |
| QA24 | Email receipt if applicable | BLOCKED | Requires staging email/provider configuration. |
| QA25 | Driver earnings | BLOCKED | Server earnings/history flow is expressly prohibited. |
| QA26 | Payout/Fleet finance visibility | BLOCKED | No Fleet/payout actions; no transfer or production finance access. |
| QA27 | Security/privacy | BLOCKED | Authenticated account/profile/privacy tests require a staging backend and test account. |
| QA28 | Voice/AI/scheduled/pixel-motion/accessibility final checks | BLOCKED | Voice/AI/scheduled flows are unsupported or backend/provider-connected; full motion/accessibility requires device QA authorization. |

## Unchanged hard prohibitions for the two APKs

- Do not log into real or test accounts while the app has the production API URL configured.
- Do not register, book, search for Drivers, go online, accept, cancel, message, rate, or open backend-backed profile/settings/history/receipt/earnings/support routes.
- Do not update location, register push tokens, upload documents/selfies, or trigger OAuth/payment/wallet flows.
- Do not call Supabase or any other backend/provider. Driver EAS preview configuration may contain Supabase-related variable names; they are not to be used.
- If the emulator/device loses confirmed network isolation, stop the app and do not resume static capture until offline status is re-established.

All backend/provider-connected QA stays **BLOCKED pending a non-production staging backend, safe provider configuration, and separate authorization**.
