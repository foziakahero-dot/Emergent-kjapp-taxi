# Phase 5 QA Build Evidence

**Status: QA profiles and safety guard prepared; builds NOT RUN.**

The target `https://api-qa.snarapp.no` did not resolve and there is no deployed QA backend to receive QA traffic. No APK was submitted or built. The existing Phase 4 APKs embed production and are not usable for Phase 5 functional QA.

| App | Profile | Profile API target | EAS build ID / artifact | Package ID | Version |
|---|---|---|---|---|---|
| Customer | `qa` (internal APK) | `https://api-qa.snarapp.no` | **NOT RUN** | `no.kjapp.app` (retained; provider/signing isolation not verified) | `1.0.0` |
| Driver | `qa` (internal APK) | `https://api-qa.snarapp.no` | **NOT RUN** | `no.kjapp.driver` (retained; provider/signing isolation not verified) | `1.0.0` |

The Customer and Driver `eas.json` profiles are additive; production/static profiles remain unchanged. The common build-time guard accepts only the exact HTTPS QA origin when `EAS_BUILD_PROFILE=qa`; tests verify both profiles and prove that a production URL is rejected by each dynamic Expo config. QA app labels render `QA BACKEND` so internal installs are visibly distinct.

Both app EAS preview environments currently have a `GOOGLE_SERVICES_JSON` variable name. Its value/project was not read. QA app config deliberately omits the shared Firebase file; outbound push is disabled by the QA backend. Driver preview also contains shared Supabase variable names, but the repository has no code references to those variables. Both apps have shared Mapbox token variable names; provider scopes/terms remain unverified.

Before starting either EAS build, provision and verify the QA service/DNS/database and inspect the build worker's resolved QA profile. The QA build guard must pass inside each EAS build worker; do not override or alter production API configuration to make a build pass. No QA package identity, artifact link, install, or startup result is asserted in this evidence.
