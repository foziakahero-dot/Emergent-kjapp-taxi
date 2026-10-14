# Expo QA build continuation — 14 October 2026

The user explicitly authorized both Android QA APKs through Expo EAS, a persistent Customer test account and a persistent Driver test account. Render APK builders and store submissions are not used.

## Observed failures and fixes

- Customer builds `27d07403-05b5-45c0-9076-0680f11d6325` and `bd8189ff-2f7e-4c90-a569-08083be9c1bc` at `b75c0ab7036c7b4afaa50f8624753b79cb8b69d1` failed before installation: the old ride-sheet source rewriter cannot match the new V10 home screen.
- Customer build `5a875135-1039-4886-8a48-bd9ca516b603` at `b3e593785aae2d0cd5afe72e3dc99304e34667bd` passed the new live QA pre-install gate, then failed because npm postinstall invoked the same obsolete rewriter.
- Both automatic calls to that source rewriter have been removed from the V10 build path. V10 source is committed directly.
- Customer Expo SDK 57 patch dependencies are updated to the versions required by the current Expo check. The expo-sharing plugin is added to the dynamic config. Dependencies remain locked.
- QA remains internal APK distribution with the canonical backend `https://api-qa.snarapp.no`. The new gate checks the profile, native identity, Mapbox public token presence and actual live backend readiness before building. Production/store gates are not marked complete.

## Verified

- Clean Customer `npm ci --include=dev` passed.
- The exact Customer EAS post-install command (`tsc --noEmit` and `expo install --check`) passed.
- Customer Android prebuild passed with the updated SDK patch dependencies and sharing plugin.
- Nineteen build guard tests passed, including rejection of production URLs, redirects, unsafe distribution, absent authorization and incomplete native configuration.
- The canonical live QA preflight passed: direct HTTPS 200 health/readiness, isolated database, Stripe test mode, no production mode and no automatic charging.
- Two new persistent QA accounts were created without changing the six existing accounts. Both correct-role password logins and `/auth/me` passed. Their test sessions were logged out after verification. Credentials are outside Git and handed to the user separately.
- The Driver has an active assigned QA vehicle `QA0014` in the existing QA fleet. Its identity and document fixtures are explicitly synthetic QA records, never production verification. Terms are unaccepted so the tester must accept them in the app.

## EAS jobs

Driver job: `2da03c07-1e26-4040-825b-bcd4404a3bf7`, source `b75c0ab7036c7b4afaa50f8624753b79cb8b69d1`, profile `qa`, Android, preview environment. Expo reports **Succeeded**, build time 23m21s, with an APK artifact. Artifact verification is recorded separately after download.

Customer job: `17f1f1c5-7707-4524-847a-01d4acc7169d`, source `16956e53f46e18619acefe6e101bc5b42bd13bff`, profile `qa`, Android, preview. The actual EAS pre-install, clean dependency install, doctor, prebuild, post-install TypeScript/package checks and JavaScript bundle all passed. Expo reports **Succeeded**, build time 25m45s, with an APK artifact.

The actual QA support smoke test returned the expected clear AI-disabled 503 and created support ticket `6acecbb4dd6507e3be5dea55` with HTTP 201. Inspection of the existing AdminSupport client found that it reads `body`/`contact_email`, while public intake historically wrote only `message`/`contact`. The endpoint now preserves both schemas, and admin listing normalizes existing public tickets without changing the database. All eight actual support/AI endpoint tests pass. The correction is **live** on Render QA at source `eb840af50e3a036559d467ec914012fd266b59d9`, deployment `dep-db7cs967bikc73adg1v0`, finished 2026-10-14 00:36:26 UTC. Live health/readiness and both account logins passed again after rollout. A new live support ticket `6acecefc3cdf78c6223396e0` returned HTTP 201; Mongo readback confirmed the canonical body and contact fields.

## Delivered APK verification

Both actual EAS APK artifacts were downloaded and retained for the user. ZIP integrity, expected Android identity, ARM64 native libraries, the canonical QA backend and V10 UI markers in the Hermes bundle passed. Both contain ARM64, ARMv7, x86 and x86_64 libraries, min SDK 24 and target SDK 36.

- Customer: `SNAR_Customer_QA_20261014.apk`, 237394943 bytes, SHA-256 `fa0c33b0ab345f353c254fe916a94e56a88fd159ab8af3cca09326cf1bcaa115`, package `no.kjapp.app`.
- Driver: `SNAR_Driver_QA_20261014.apk`, 246016910 bytes, SHA-256 `3d394db93763e9ddf6c9fdc65d53ce00ffd76fba18f470f910bc9e06ed28781c`, package `no.kjapp.driver`.

Machine-readable artifact and live backend evidence is in `evidence/2026-10-14/apk/`. Test instructions are in `docs/snar-v10/ANDROID_QA_TESTING_20261014.md`. APKs and private login handoff are delivered separately, not committed into Git.

GitHub Actions is separately blocked by the account payment/spending annotation; direct EAS builds do not depend on that runner. Main, production Render, app stores and OTA are unchanged.

Full physical trip/payment/device acceptance and all 67 source-screen pixel checks remain pending. This checkpoint does not claim those checks passed.
