# SNAR Driver Technical Requirements

Status: normative beta requirements. Source code and backend contracts are authoritative; runtime items remain UNVERIFIED until native/device evidence exists.

## Status values
- VERIFIED_SOURCE: confirmed in current source/contract, not a physical-device claim.
- PARTIAL: implementation exists but one or more required behaviours are incomplete.
- MISSING: required implementation not found.
- UNVERIFIED_RUNTIME: source exists but native/device/E2E evidence is still required.

| ID | Priority | Requirement | Current status | Test method | Acceptance criteria |
|---|---|---|---|---|---|
| DRV-AUTH-001 | P0 | Driver shall authenticate only as role `driver` using email/phone + the Driver's own password. | VERIFIED_SOURCE | API + native login | Passenger/admin/fleet credentials cannot create a Driver session; password login succeeds for an approved Driver. |
| DRV-AUTH-002 | P0 | Driver session shall fail closed if the account is not approved. | VERIFIED_SOURCE | API + app restart | Unapproved driver cannot reach protected Driver screens. |
| DRV-AUTH-003 | P0 | Stored session shall be revalidated with `/auth/me`; invalid role/unapproved session is cleared. | VERIFIED_SOURCE | expired/invalid token test | Invalid session returns to login without protected data. |
| DRV-AUTH-004 | P1 | Forgot-password shall use the Driver client and complete reset without exposing secrets. | UNVERIFIED_RUNTIME | API + email/deep-link test | Reset link works on a real device and old password no longer works. |
| DRV-AUTH-005 | P0 | Google Sign-In and Apple Sign-In shall not be exposed or used as Driver authentication methods. | VERIFIED_SOURCE | source/UI scan + native login screen | Driver login offers password credentials only; social login is Customer-only. |
| DRV-AUTH-006 | P1 | SMS shall be reserved for later step-up/recovery verification and shall not replace the Driver password unless requirements are explicitly revised. | MISSING | future Twilio E2E | SMS challenge can be added without weakening password authentication. |
| DRV-BRAND-001 | P0 | All user-facing Driver product branding shall display SNAR. | PARTIAL | static string scan + device visual QA | No visible KJAPP branding remains; internal compatibility IDs may remain `kjapp`. |
| DRV-ONLINE-001 | P0 | Driver shall only enter ONLINE after role, approval, fleet, vehicle, legal, identity and compliance gates pass. | VERIFIED_SOURCE | API regression | Server rejects non-operational Driver before online state changes. |
| DRV-ONLINE-002 | P0 | Driver app shall require foreground GPS permission and a fresh position before presenting ONLINE as successful. | PARTIAL | native permission test | Denied/unavailable GPS leaves Driver offline with a Norwegian error. |
| DRV-ONLINE-003 | P0 | Driver shall be forced offline when GPS safety requirements fail. | VERIFIED_SOURCE | revoke permission while online | UI and backend reconcile to offline; stale online state cannot override local GPS block. |
| DRV-GPS-001 | P0 | Online Driver shall publish real latitude/longitude with timestamp and available heading/speed. | VERIFIED_SOURCE | API capture + physical drive | Backend receives fresh real samples; no fabricated zero-position fallback. |
| DRV-GPS-002 | P0 | Stale GPS shall not represent available supply to Customer/dispatch. | VERIFIED_SOURCE | stale timestamp test | Driver disappears from supply after freshness window. |
| DRV-GPS-003 | P1 | Active-trip GPS shall use higher update frequency than idle shift GPS. | VERIFIED_SOURCE | source + device log | Active trip uses navigation-grade configuration; idle mode is throttled. |
| DRV-TRIP-001 | P0 | Only one Driver may successfully accept a trip. | VERIFIED_SOURCE | concurrency regression | One winner; other accepts receive canonical conflict/state result. |
| DRV-TRIP-002 | P0 | Accept shall reconcile with `/driver/current` when the request outcome is ambiguous. | VERIFIED_SOURCE | drop response after server accept | App recovers assigned trip instead of showing a false failure. |
| DRV-TRIP-003 | P0 | Driver lifecycle shall follow offer → accept → pickup → start → arrive/complete using server-authoritative states. | VERIFIED_SOURCE | two-phone E2E | Each transition is server-confirmed and invalid transitions are rejected. |
| DRV-TRIP-004 | P0 | A completed/arrived/rated trip shall not remain in active-trip UI. | VERIFIED_SOURCE | completion regression + restart | Finished trip leaves active state and next work can be received. |
| DRV-TRIP-005 | P1 | Active trip shall be minimizable and restorable without losing `trip_id` or stopping runtime GPS. | PARTIAL | native UI + restart | Minimize hides command sheet, restore reopens same trip, GPS continues, state survives navigation/restart. |
| DRV-TRIP-006 | P0 | Critical trip actions shall not be falsely shown as successful during transport failure. | VERIFIED_SOURCE | disconnect at pickup/start/arrive | Action is queued/reconciled or clearly failed; server remains canonical. |
| DRV-TRIP-007 | P1 | No-show shall be server-gated by trip state/wait/GPS policy. | VERIFIED_SOURCE | premature no-show test | Server refuses premature no-show and accepts only valid state. |
| DRV-TRIP-008 | P0 | After every Driver trip-state mutation, the client shall reconcile canonical `/driver/current` server state. | VERIFIED_SOURCE | action-by-action E2E | Accept, pickup, start, arrive/complete and cancellation immediately show the server-confirmed state. |
| DRV-TRIP-009 | P0 | After a finished ride, active trip state shall clear and Driver availability plus earnings shall refresh without app restart. | VERIFIED_SOURCE | consecutive-trip E2E | Completed ride leaves active UI, earnings refresh, and the Driver can receive the next offer in the same session. |
| DRV-FLEET-001 | P0 | Driver may only select vehicles assigned by the authorized fleet. | VERIFIED_SOURCE | API authorization test | Unassigned vehicle selection is rejected. |
| DRV-FLEET-002 | P0 | Driver cannot receive operational work without a valid active selected vehicle. | VERIFIED_SOURCE | online/accept without vehicle | Online/accept is blocked until valid assignment exists. |
| DRV-FLEET-003 | P1 | Driver profile shall display active vehicle, fleet and organization data from canonical backend state. | VERIFIED_SOURCE | profile API/native UI | Display matches backend; no fake car fallback. |
| DRV-PUSH-001 | P0 | Driver shall register native push token and receive new-trip notifications when configured. | UNVERIFIED_RUNTIME | locked/background phone test | Real notification arrives with correct trip and opens Driver home. |
| DRV-PUSH-002 | P1 | Foreground/background polling fallback shall not duplicate native push alerts. | VERIFIED_SOURCE | notification regression | Same offer produces at most one local fallback alert in a session. |
| DRV-PUSH-003 | P1 | Driver notification sound/vibration preferences shall be respected. | UNVERIFIED_RUNTIME | Android/iOS device matrix | Sound/vibration follow selected preference and OS rules. |
| DRV-MSG-001 | P1 | Driver↔Customer messages shall be scoped to the active/authorized trip. | VERIFIED_SOURCE | API authorization test | Driver cannot read/send messages for unrelated trip. |
| DRV-MSG-002 | P1 | Driver shall be able to call the assigned Customer only when authorized phone data is available. | UNVERIFIED_RUNTIME | assigned trip device test | Call action is disabled without phone and launches dialer when present. |
| DRV-ID-001 | P1 | Driver profile shall expose profile photo and identity/selfie verification status. | VERIFIED_SOURCE | profile + identity endpoints | UI reflects canonical verification state. |
| DRV-ID-002 | P0 | Identity selfie upload shall be authenticated and reviewed server-side before operational access is granted. | VERIFIED_SOURCE | camera/upload/admin-review test | Valid image uploads; status changes only via authorized backend workflow. |
| DRV-ID-003 | P0 | First login/first shift on an identity-unverified installation shall require Selfie ID verification. | VERIFIED_SOURCE | clean-install login test | Driver is routed to Selfie ID and cannot go ONLINE until server status is `verified`. |
| DRV-ID-004 | P0 | Login from a new/untrusted app installation/device shall require renewed Selfie ID verification. | VERIFIED_SOURCE | login on second physical phone | Changed persistent installation ID creates recheck requirement before next shift. |
| DRV-ID-005 | P0 | Driver shall not go ONLINE or handle a new ride while mandatory identity verification/recheck is unresolved. | VERIFIED_SOURCE | online/accept while not_submitted/pending/recheck | Backend rejects operational actions and keeps Driver offline. |
| DRV-EARN-001 | P1 | Earnings shall use backend-provided gross/net/commission/payout data, not frontend invention. | VERIFIED_SOURCE | ledger comparison | Displayed values match canonical backend response. |
| DRV-EARN-002 | P0 | Earnings/history shall refresh after ride completion without app restart. | VERIFIED_SOURCE | complete ride + earnings screen | Current totals/history reflect the completed ride after canonical settlement data is available. |
| DRV-PAY-001 | P1 | Stripe Connect secrets shall never be present in Driver mobile code. | VERIFIED_SOURCE | secret scan | Only client-safe status/data reaches mobile. |
| DRV-ERR-001 | P0 | User-facing failures shall be understandable Norwegian messages, not raw `Internal Server Error`, `Network failed`, `undefined` or `[object Object]`. | PARTIAL | forced 401/403/409/422/500/offline | Each class maps to actionable Norwegian UI while full server detail remains in server logs. |
| DRV-SEC-001 | P0 | Driver shall never access another Driver's private resources. | VERIFIED_SOURCE | IDOR/RBAC tests | Cross-driver resources return 403/404 as appropriate. |
| DRV-SEC-002 | P0 | Secrets shall not be hardcoded or committed. | UNVERIFIED_RUNTIME | repository + build artifact secret scan | No server secret/API credential appears in source/log/artifact. |
| DRV-BUILD-001 | P0 | Android beta shall produce an installable signed APK from the Driver Expo project. | UNVERIFIED_RUNTIME | EAS build + install | Build ID/URL recorded; APK installs and cold-starts on physical Android. |
| DRV-BUILD-002 | P1 | iOS shall build with existing bundle/team configuration and be delivered through internal/TestFlight profile as appropriate. | UNVERIFIED_RUNTIME | EAS iOS build | Build ID recorded and install/TestFlight launch succeeds. |

## P0 release blockers
Any open P0 above blocks declaring the Driver app beta-ready. A TypeScript pass, Metro export, Expo prebuild or successful compile alone does not satisfy DRV-BUILD-001 or the physical acceptance criteria.
