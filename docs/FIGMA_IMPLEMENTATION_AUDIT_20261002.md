# KJAPP Figma implementation audit — 2 October 2026

## Result

This revision implements source-based visual corrections in both Expo 57 native apps. It does **not** establish complete pixel identity with the current live Figma Make file. Signed APK/IPA compilation and phone acceptance remain outstanding.

Parent commit: `87a8ce48ca211619fe21541ca48f5f319a93a8a9`, branch `design/figma-make-pixel-match-20261002`, draft PR #65, stacked on the existing native auth/payment PR #64. No production merge is part of this revision.

## Design evidence

Reference: the supplied **Revolutionary AI Taxi App Design (2).zip**, exported on 30 September 2026. Original visual source files are retained in `design/figma-make-20260930/`, with archive/file SHA-256 values in its manifest. Those files are reference material, not production modules.

The Make link is https://www.figma.com/make/y94k21wsXX8d9sI966cOAY/Revolutionary-AI-Taxi-App-Design. Its connected design-context tool returned resource links without readable bodies. Screenshot and motion-context tools explicitly reject Make files. The approved browser fallback displayed **Site Unavailable**; it also rejected the local reference preview URL. The live file manifest includes additional source files absent from the older export. Current-file freshness and same-dimension reference/native screenshots are therefore unverified.

The provided export contains a component screenshot for the recent-address sheet. Source geometry was checked against that reference; no native screen screenshot comparison passed.

## Implemented corrections

| Area | Previous mismatch | Source-based change |
| --- | --- | --- |
| Fonts throughout both apps | System-font text and synthetic weights; missing weights | Shared Text/TextInput select actual Inter 300/400/500/600/700/800 and JetBrains Mono 400/500 files, preserving nested font/color inheritance |
| Palette | Muted and feedback colors differed | Faint ink `#8B97A7`, success `#4CAF50`, warning `#FF9800`, error `#F44336`; operational green remains `#12B981` |
| In-app mark | Customer chevrons filled the tile; different gradient/shadow | Original 24-unit paths, glyph at 52% of tile size, radius 28%, CSS 145° gradient with middle stop at 55%, source shadows |
| Splash | One pulse; different title spacing; full-width bottom CTA; extra copy | Centered group, 104 px mark, two 3 s rings offset 1.2 s, 4 s / −6 px float, 60 px wordmark with 36 px margin, compact CTA at 56 px margin, 2.8 s shimmer, radial background |
| Login | Extra top navigation, fake Google letter, different fields/spacing | Original Google SVG, source field labels and focus halo, entrance delays 0/60/100/140/180 ms, 30 px customer title, primary gradient, forgot link below primary action |
| Shared actions | Flat red fill, 0.99 press, 16 px text | 120° gradient calculated for actual rectangle dimensions, 0.95 press scale, 14/20 px Inter semibold |
| Task bars | Built-in tab layout, wrong inactive glyphs/color, Driver green selection | Original Customer SVG paths, Driver glyphs, 20 px icons, 10 px labels, 26 px radius, 16 px inset, original active indicator, scene-backed native blur |
| Customer browse | Recent rows too short; bottom content obscured by navigation | Source row/icon/text spacing, 112 px bottom reservation while expanded, 300 ms collapse, original vehicle glyph and category-row proportions |
| Confirmation/matching/arrival | Different gradient, padding and type spacing | Source shell gradients and primary actions; matching card spacing; preserved 900 ms linear spinner; arrival sheet/top-card spacing |
| Driver trip actions | Static gray row with multiple arrows | Red 56 px pill, 48 px white thumb, 300 ms travel, action after 350 ms; existing backend handler and final-trip confirmation retained |
| Motion preference | Loops did not consult system preference | Shared native accessibility subscription; new rise/float/pulse/shimmer/collapse/confirmation and matching motion respect reduced motion; animations/timers clean up on unmount |
| Maps | Faded theme, tilted camera, 3D buildings and POI labels | Mapbox Standard monochrome/day, flat 13.4 zoom, source Oslo fallback, 3D/POI disabled, original 30 px arrow glyphs and 22 px position pulse |
| Platform identity | Old gold K icons, dark launch/theme, cyan notification tint | Original Customer red/white and Driver navy/red S ribbons, generated adaptive/monochrome/favicon assets, source splash mark, light native theme and red notification tint |

Native safe areas are added to the mockup's content insets. App names, package identifiers, schemes and visible KJAPP wordmarks retain the existing project identity. iOS uses its native Continue with Apple control rather than the browser's imitation. Unsupported platforms do not show a fake Apple action. Store icon corner transparency is filled for valid opaque iOS assets; the OS supplies its icon mask.

`npm run icons:figma` in frontend regenerates platform icon files directly from the archived AppIcons SVG source. No generated or invented icon paths are used.

## Backend preservation

Both `src/lib/api.ts` files are byte-identical to the pre-change source. No Supabase dependency or reference is present in either app's runtime TS/TSX or manifests. Existing auth, place search, quotes, nearby cars, booking, trip state, receipts, payment, chat and safety APIs remain authoritative.

An AST comparison confirmed these existing handlers were unchanged: Customer booking, email login, Google login, Apple login and account-role completion; Driver login, poll, accept, decline and advance; permission-request completion. Role, approval, legal-consent and identity gates remain in place. The new confirmation component animates before calling the existing advance handler and reports unexpected rejections to the screen.

The source export's random cars, hardcoded passengers/prices/earnings, automatic matching and demo approval are not production data. This audit does not certify live end-to-end backend behavior or constitute a full backend security assessment.

## Validation

| Check | Customer | Driver |
| --- | --- | --- |
| TypeScript, `npx tsc --noEmit` | PASS | PASS |
| Expo Doctor | 21/21 PASS | 21/21 PASS |
| Android native project generation, no installation | PASS | PASS |
| Android Hermes export | PASS | PASS |
| iOS Hermes export | PASS | PASS |
| Component regression checks | PASS across both apps | PASS across both apps |
| Existing receipt/navigation regression suite | — | 4/4 PASS |
| Signed APK / IPA | NOT COMPILED | NOT COMPILED |
| Native screenshot / full motion playback | NOT VERIFIED | NOT VERIFIED |
| Real phone auth → booking → trip → payment | NOT TESTED | NOT TESTED |

The component checks cover all loaded font weights, nested text inheritance, CSS gradient direction on non-square surfaces, one shared reduced-motion subscription, delayed single trip-action invocation despite repeated presses, cancellation after unmount, and error recovery. They use mocked native host components and are **not visual tests**.

Commands: `npm run test:design` in frontend; `node --test tests/tripSummary.test.mjs` in driver-app; `npx tsc --noEmit`; `npx expo-doctor@latest`; `npx expo prebuild --platform android --no-install`; `npx expo export --platform android` and `--platform ios` in each app.

The new `figma-mobile-audit.yml` requests the source checks and both platform exports on pushes/PRs. Existing APK/simulator/EAS workflows retain their separate native compilation/signing responsibilities. YAML parsing passed; successful GitHub workflow startup is still required.

## Security and accessibility findings

`npm audit --omit=dev` reports **7 high affected packages for Customer and 6 for Driver**, no critical/moderate/low findings. These counts propagate from the same underlying `node-forge` advisory, **GHSA-86w9-cpqp-85rv / CVE-2026-85393**, through Expo CLI/code-signing dependencies. The advisory lists versions through 1.4.0 as affected and no patched version. The npm registry's latest version checked was 1.4.0. Downgrading Google/Stripe integrations as suggested by the dependency resolver would not constitute a verified fix.

Primary advisory: https://github.com/advisories/GHSA-86w9-cpqp-85rv. The audit remains open on this finding. CLI dependency paths were inspected; this is not evidence that the vulnerable verification routine is bundled or exploitable in the native customer runtime.

The exact source palette has contrast limitations: faint ink against white is approximately **2.97:1** and white against primary red is **4.00:1**. These do not meet 4.5:1 for ordinary small text. Colors were retained to match the supplied design. Reduced motion, native permission prompts, tab/switch/button semantics and error states are included; comprehensive accessibility compliance is not asserted.

## Remaining design and release gaps

1. No current live Make source/render comparison has passed. The 30 September export may be older than the current design.
2. Profile setup still routes to real payment/address management instead of the reference's direct four-payment-tile/name/address form. Driver profile/onboarding does not reproduce every reference fleet/document/settings subsection. The proactive AI recommendation overlay and every Customer support/settings sub-screen are not fully ported. These are remaining implementation work, not verified parity.
3. Complete screens, scroll states, dynamic type, keyboard behavior, blur, SVG shadows, icon masks and full animation timelines require same-size iOS/Android rendering and comparison. The arrow path is exact; its browser drop-shadow/heading transition is not a passed native match. Raster fallback when a Mapbox token is absent cannot match Mapbox Standard.
4. GitHub build attempts for implementation commit `d0d118254a7618121a3149d4e4561acc8fce0c79` completed with `startup_failure`, `path: BuildFailed`, **zero jobs and zero artifacts**. The push run is https://github.com/foziakahero-dot/Emergent-kjapp-taxi/actions/runs/37033515038; the pull-request run is https://github.com/foziakahero-dot/Emergent-kjapp-taxi/actions/runs/37033518396. Both job and artifact lists were checked. Parent-commit attempts failed the same way; retry was rejected with HTTP 403. No app compiler log exists and the root cause is not established.
5. This Linux session has no configured Android SDK, Xcode or Expo authentication token. Native project generation and Hermes packaging succeeded; APK/IPA compilation and signing have not been performed here.

The draft should not be described as pixel-perfect, fully implemented, release-ready, security-clean or accepted on physical devices. Review the remaining design gaps and build results before production integration.

## Local follow-up checkpoint — not published application source

After the source port above was committed, an additional local pass revised Customer profile setup, the six-item profile menu and detail layouts, native support, saved-address editing, the recommendation overlay, and Driver profile fleet/vehicle/document/earnings sections. It added shared 48 × 28 animated toggles and extended component checks. APIs remained unchanged. Support used real server replies and ticket IDs; missing reward, RideCheck and consent capabilities were explicitly unavailable rather than simulated.

The extended component regression checks passed, including duplicate support/ticket submission guards, server-confirmed success, unmount cancellation, and preserving a Work address ID/label when entered from a Home shortcut. Both app typechecks passed during this pass. Last minor presentation and permission-toggle edits did not receive the intended final typecheck/export run.

Before the final four exports could start, the execution service disconnected. Recovery returned `environment_offline: Environment is not connected`. Attempts to read and publish the local follow-up source were blocked by the same failure. **These follow-up app changes are not in PR #65.** The committed platform export hashes and validation table above describe the published `d0d1182` application source, not the unpublished follow-up.

The local follow-up files, when the workspace becomes reachable again, are:

- `frontend/app/profile-setup.tsx`, `frontend/app/(app)/profile.tsx`, `frontend/app/(app)/home.tsx`, `frontend/app/saved-places.tsx`, `frontend/app/permissions.tsx`
- `frontend/src/components/CustomerSupport.tsx`, `frontend/src/components/CustomerProfileDetails.tsx`, `frontend/src/components/DesignToggle.tsx`, `frontend/src/components/Icon.tsx`
- `driver-app/app/(driver)/profile.tsx`, `driver-app/src/components/DesignToggle.tsx`, `scripts/verify-figma-mobile.cjs`

Resume by inspecting those files, repeating final source checks and four exports, replacing the build manifest with matching hashes, and publishing a separately verified follow-up commit. Full current-Figma/native pixel comparison, missing production-backed features, and native compilation remain open.
