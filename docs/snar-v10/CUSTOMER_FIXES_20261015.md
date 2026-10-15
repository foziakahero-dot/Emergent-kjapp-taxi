# Customer startup, search and API investigation — 2026-10-15

Base: QA branch at efcb288. No production or QA data migration.

## Changes
- Restore auth concurrently with bundled font loading; remove the additional 1.8 second startup delay. Bound font waiting to 5 seconds.
- Catch and bound native token reads, session lookup and expired-token cleanup. Surface retry without discarding the session on transient failures. Epoch guards prevent late restoration responses overwriting a new login.
- Place address-search close button within parent touch bounds while keeping its screen position; handle Android back while search is open.
- Allow minimization during payment authorization and in-trip; hide redundant minimize button while collapsed.
- Use a recent (at most 30 second, 100 metre accuracy) cached location or a bounded balanced-accuracy lookup before fetching nearby cars. Never invent vehicle positions.
- Native Google QA config/login/link can use explicit QA_GOOGLE_CLIENT_ID, QA_GOOGLE_IOS_CLIENT_ID and QA_GOOGLE_DRIVER_IOS_CLIENT_ID. No production OAuth fallback. Customer QA iOS build uses QA_GOOGLE_IOS_CLIENT_ID for its native URL scheme.
- Recognize admin.snarapp.no as a production admin domain, avoiding its broken same-origin /api route. This does not point production panels at QA.

## Live observations
- api-qa.snarapp.no and api.kjappapp.no both returned google_enabled=false and empty native Google client IDs. Google requires actual OAuth configuration and Android signing/package registration; no IDs or keys were invented.
- Test driver qa.driver.build20261014@example.com is approved but offline, legal_accepted=false; /driver/current returned 403. Driver must accept current terms and go online with GPS before the car can appear. No consent or location was fabricated.
- admin.kjappapp.no and fleet.kjappapp.no published bundles select https://api.kjappapp.no/api.
- fleet.snarapp.no uses same-origin /api; live /api/health returned backend JSON successfully. Repository redirect targets api.kjappapp.no.
- admin.snarapp.no published bundle selects same-origin /api and /api/health returned 404. Source fix requires deployment to affect that published site.
- APK QA profiles use https://api-qa.snarapp.no. Existing production panels do not represent this isolated QA database.

## Validation
- Customer TypeScript check passed.
- Android Metro/Hermes export passed (2304 modules); this is not a signed APK or a physical-device test.
- Focused startup/QA guard tests and native Google/provider isolation tests passed.
- Screen-by-screen Figma visual certification, on-device Google login and complete customer/driver trip testing remain outstanding.

## Release constraints
No subscription upgrade, API domain switch, external OAuth configuration or fake driver activation performed. Paid production Render service and Free QA service must not be confused. New APK, backend rollout, and admin deployment require the reviewed changes to reach the respective release targets; a source commit alone does not change installed apps.
