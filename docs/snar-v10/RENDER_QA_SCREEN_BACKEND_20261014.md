# Render QA screen backend rollout

Authorized explicitly by the user on 2026-10-14 Europe/Oslo. Deploy only the existing `snar-api-qa` service (`srv-db61otlckfvc73bqp480`) from `qa/snar-v10-phase5-staging-e2e`. Keep auto-deploy off, existing QA database/Stripe configuration and suppressed external provider delivery.

Promote the tested backend delta from the screen implementation branch: customer-owned pickup preference, existing driver-to-pickup road geometry, accepted Driver notification/sound fields, preference-aware optional delivery, and safe AI-chat error handling. Compare with the exact QA baseline `6955bc48a9284e780f8a4746a1a64273a2c7a801`; no unrelated backend replacement is included.

AI-chat previously imported/constructed the provider outside error handling and attempted to use an intentionally empty QA key. It now returns explicit 503 without provider calls when unavailable, validates trimmed messages, handles initialization/timeout/empty responses, and keeps human support intake independent of AI. This does not activate BytePlus or certify live AI/transcription.

All 27 targeted backend tests pass (7 pickup, 13 settings/push, 7 support/AI), and the unchanged QA safety/build guard fixtures pass from the complete source checkout. Deployment status, live health/readiness and authenticated integration must be recorded after rollout. No APK or physical ride test is implied by a successful Render deployment.

## Deployment result

QA commit `1e17796b4b69a0a6a06435e0ee93b9d552906f0e` is deployed as `dep-db7an8t9fdbs73dgjqqg`. Render confirms **live**, finished 2026-10-13 22:09:18 UTC / 2026-10-14 00:09 Oslo. Startup completed and no error-level app logs were found in the inspected post-deploy interval through 23:37 UTC. Canonical health/readiness and authenticated integration are still unverified: terminal access timed out and automatic browser approval could not complete because the usage limit was reached. No blocked-browser workaround was attempted. The QA branch contains the backend rollout, not the new combined mobile candidate.

## Fresh continuation evidence — 2026-10-14 01:51 Oslo

The combined mobile candidate is saved as `b847dc1a5c6ed6bc285c4935b1dc8fcf2cb8c192` in draft PR #101, targeting QA, with GitHub reporting mergeable=true. Both app typechecks, all behavioral/controller suites, 27 targeted backend cases and 12 QA guard fixtures pass. The candidate backend blob matches the deployed QA source exactly (`cf449b4022e2c1757bc3760237f49876384d157f`).

A fresh PR-triggered Actions run, `38486477203`, is completed with startup_failure. Its actual GitHub annotation says the job was not started because recent account payments failed or the spending limit needs increasing. No jobs/artifacts were produced. Do not retry builds until the account billing/spending obstruction is resolved through an authorized human payment path.

The previous browser usage limit no longer blocked opening QA. The free Render instance woke up; startup completed and the application log confirms `GET /api/health` HTTP 200 at 2026-10-13 23:50:45 UTC. Reading the resulting browser page was rejected by the browser URL policy because its protocol was not allowed. No alternate-browser, raw-page, protocol or indirect workaround was attempted. The JSON body, canonical readiness and authenticated integration remain unverified. Deployment live plus HTTP 200 is not full database/Stripe/ride certification.
