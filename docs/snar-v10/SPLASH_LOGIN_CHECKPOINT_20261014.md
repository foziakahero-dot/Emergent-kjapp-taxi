# Splash and login — targeted checkpoint, 2026-10-14

User narrowed the task to Customer and Driver splash/login only. Do not move on to other screens before these are accepted. Parent: 6ff2c4f4911b778584edb00ae62b32c972369ef0 on implementation/snar-v10-screens-20261013. No backend, API URLs, accounts, payment code, other screens or build profiles changed.

Design source: original SNAR_V10_VSCode_Package.zip (libfile_9f140149f1d08191a09e2143a6c61b96), reference/snar-v10-design/src/CustomerApp.tsx (splash/signin), DriverApp.tsx (splash/login), snar10/kit.tsx (SplashMark/TopBar), index.css. There is no resolved canonical Figma file/node URL; this work uses the user's exported Figma Make source, not an older prototype or invented design.

## Saved changes

- Both native Expo splash plugins now use the original red SNAR chevron mark, transparent 3x PNG, 96dp width and source navy background. SVG master preserves the source geometry. Both system themes use the same launch surface. These native asset changes require a new binary; existing QA APKs are unchanged.
- Root layouts keep the native splash until bundled fonts load (or font loading fails), then show the animated V10 splash for 1800ms. The light trace uses the correct source dash direction and range, the mark reveals from 0.94 scale, and wordmark fades after 120ms. Reduced motion suppresses movement. Timers and animations clean up on unmount. Driver launch includes DRIVER; Customer startup remains navy even with a saved dark theme.
- Customer login retains the source TopBar, 70px top anchor, 24px gutters, 26/32 heading, 56px input/actions, 16px radii, divider and anchored legal footer. Removed added mail/lock decoration; kept working password reveal, Google/Apple platform behavior, register/forgot actions, roles, consent and duplicate-operation guards. Password supports keyboard submission.
- Driver login retains the source 110px top anchor, 24px gutters, 32/38 heading, 60px inputs, 58px primary and footer. Placeholder colors match source tokens; reveal/forgot controls disable during submission. Existing role, approval, 2FA, legal and identity checks remain.

## Actual verification

Both TypeScript checks pass. Existing verify-figma-mobile.cjs and verify-v10-screen-checkpoint.cjs pass, including actual login role/legal/approval/2FA/identity gates, empty/failed/duplicate attempts and shared provider locking. Both public Expo QA configs resolve; the canonical QA backend build guard remains unchanged. React Native Web renders of both splash/login screens in both themes (8 captures) have no page errors; empty submissions show an alert. Splash source and implementation captures were inspected at 370x824; 96px mark/22px gap/wordmark placement match within browser font/layout differences. This is not Android/iOS device certification.

## Outstanding — do not claim full pixel parity

The original Customer design says SMS/no password. Driver source shows phone + BankID. Current canonical auth exposes password-based login, Customer Google and iOS Apple; no connected SMS login or BankID auth was found. We did not introduce fake provider actions, hardcoded OTPs or bypass approval. Therefore the extra password fields/actions and truthful copy are explicit design deviations; login is NOT a complete pixel-identical implementation. Implementing the original auth layout needs real SMS/BankID contracts or an explicitly approved design variant for current password auth. Driver's original support number is prototype data and is not copied.

Native release screenshots and cold-start verification, keyboard/safe-area checks on devices, provider sign-in on devices, and APK/iOS rebuild remain pending. Existing builds from 2026-10-14 do not contain this commit. No new build, merge, deployment or OTA was performed. Stay on splash/login next; do not continue the 67-screen matrix.
