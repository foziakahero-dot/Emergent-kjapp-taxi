# KJAPP Signature continuation status

Branch: `codex/kjapp-signature-mainline`
PR: #17
Base: current `main`

## Ported safely
- Customer Signature map-first Home and 3-snap booking/search sheet
- Customer floating dock while preserving KJAPP Assist
- Customer Signature profile while preserving GDPR deletion and current backend contracts
- Driver Signature command Home: offline, online, waiting, offer and active-trip states
- Driver trip-stage progress and foreground incoming-trip alert
- Driver floating dock and Signature profile
- Native map layers for Customer and Driver, with InteractiveMap fallback when Google Maps is not configured
- Build-time Google Maps config through Expo `android.config.googleMaps.apiKey`
- Best-effort server logout for both apps while always clearing the local bearer session
- Explicit Driver login redirects after logout/account deletion

## Intentionally not ported from old PR #7
- Customer on-device profile-photo association/persistence pretending to be cross-device state
- Stale upload API wrappers used only by that profile-photo implementation
- Old Driver push wrapper/root runtime; current `nativeRuntime.ts` on main is newer and remains authoritative
- Any old layout that would remove the newer KJAPP Assist tab

## Build validation
- Customer EAS workflow triggers correctly from the connected Customer Expo project. Signature branch builds have been submitted and GitHub currently reports them as pending.
- Driver standalone EAS workflow exists under `driver-app/.eas/workflows/build-apk.yml`, but the Driver Expo project does not create a check for Signature branch pushes. The remaining trigger blocker is outside the Driver source workflow and requires the Driver Expo project GitHub connection/app root (`driver-app`) to be corrected.
- The repository GitHub Actions APK workflow cannot currently be used as a fallback. A one-step `echo` smoke workflow also terminated with `startup_failure` before any job was created. Existing `main` runs show the same pre-existing behavior, so this is a repository/account GitHub Actions runner/policy/billing/startup issue rather than an application compile failure.

## Merge gate
Keep PR #17 as draft until:
1. Customer APK reaches a terminal green build and receives device smoke testing.
2. Driver Expo GitHub connection is restored and Driver APK builds successfully.
3. Driver device smoke test covers offline -> online -> offer -> accept -> pickup -> active trip -> complete.
4. Customer smoke test covers location/map -> search -> vehicle -> payment -> booking -> active trip/receipt.
