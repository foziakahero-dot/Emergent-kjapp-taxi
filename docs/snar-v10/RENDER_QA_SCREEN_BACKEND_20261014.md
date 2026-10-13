# Render QA screen backend rollout

Authorized explicitly by the user on 2026-10-14 Europe/Oslo. Deploy only the existing `snar-api-qa` service (`srv-db61otlckfvc73bqp480`) from `qa/snar-v10-phase5-staging-e2e`. Keep auto-deploy off, existing QA database/Stripe configuration and suppressed external provider delivery.

Promote the tested backend delta from the screen implementation branch: customer-owned pickup preference, existing driver-to-pickup road geometry, accepted Driver notification/sound fields, preference-aware optional delivery, and safe AI-chat error handling. Compare with the exact QA baseline `6955bc48a9284e780f8a4746a1a64273a2c7a801`; no unrelated backend replacement is included.

AI-chat previously imported/constructed the provider outside error handling and attempted to use an intentionally empty QA key. It now returns explicit 503 without provider calls when unavailable, validates trimmed messages, handles initialization/timeout/empty responses, and keeps human support intake independent of AI. This does not activate BytePlus or certify live AI/transcription.

All 27 targeted backend tests pass (7 pickup, 13 settings/push, 7 support/AI), and the unchanged QA safety/build guard fixtures pass from the complete source checkout. Deployment status, live health/readiness and authenticated integration must be recorded after rollout. No APK or physical ride test is implied by a successful Render deployment.
