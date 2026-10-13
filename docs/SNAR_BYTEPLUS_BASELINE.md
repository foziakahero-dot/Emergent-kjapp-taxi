# SNAR × BytePlus baseline — 2026-10-13

Repository: foziakahero-dot/Emergent-kjapp-taxi (private monorepo). GitHub connector inspection, not old branch assumptions.

| Role | Branch / source | Verified commit |
|---|---|---|
| Main source (deployment not yet verified) | main | 6f2c2d96e7290fb1b3331906e752958e1db4c356 |
| Latest Customer + Driver screen implementation | implementation/snar-v10-screens-20261013 | 9e7469076e62520743b8e1c7ae51f6a3ec7b2ea5 |
| Isolated QA baseline | qa/snar-v10-phase5-staging-e2e | 6955bc48a9284e780f8a4746a1a64273a2c7a801 |
| Older isolated BytePlus experiment (draft PR #37, unmerged) | feature/byteplus-deepwiki-mcp-test | e82869e700af8605094bf60af1714a6e012a08ef |
| This task | feature/byteplus-voice-booking-20261013 | starts at 9e7469076e62520743b8e1c7ae51f6a3ec7b2ea5 |

Implementation branch is 4 commits ahead / 0 behind QA; 38 ahead / 0 behind main. Inherits QA guards and current UI work. No prior local checkout or unrelated local changes existed here. Shell git authentication unavailable; GitHub connector is the authenticated path for atomic commits and branch checkpoints.

Components: frontend/ (Expo SDK 57 Customer); driver-app/ (Expo Driver); backend/ (FastAPI + MongoDB); admin-web/; fleet-web/; marketing-web/; scripts/ shared validation. No infrastructure replacement.

Relevant existing contracts:
- Customer auth: Bearer JWT, require_customer; native Google/Apple Customer auth; legal acceptance gate.
- POST /api/trips/estimate → OSRM road route + active_pricing/pricing_for_pickup/calculate_price + waiting_policy.
- POST /api/trips/request → legal/service-area/booking-enabled checks, verified saved Stripe card, active-trip and concurrent user booking lock, quote/waiting policy revalidation, RideReservations authorization → dispatch.
- /api/trips/active and canonical trip state; existing Stripe 3DS helper withReservation in Customer api.ts must be preserved.
- /api/places/search and /places/reverse are existing shared geographic adapters. IMPORTANT: maps are native Mapbox, but backend address search is MapTiler → Photon → Nominatim. No existing backend Mapbox geocoder found. Reuse existing adapter initially; do not falsely claim Mapbox-backed resolution or introduce competing geocoder.
- frontend/app/(app)/assist.tsx already captures audio using expo-audio, calls legacy /ai/transcribe, parses destination with regex, searches places and presents class/price. Existing /ai/transcribe uses Emergent Whisper; /ai/chat uses legacy server AI adapter.
- Existing FCM/APNs, fleet vehicle and dispatch integrations stay authoritative; Driver/Admin/Fleet/marketing code need no Phase 1 changes.
- backend/.env.example stores placeholders; BytePlus credentials are absent from inspected current implementation. Older PR #37 is a test, not a production integration and will not be merged.

Account / provider findings:
- BytePlus console redirects to its sign-in screen; account, project, credits, regional entitlements, scoped credentials and live API behavior are not yet verified.
- Current ASR Fast Mode docs (updated Oct 12) specify X-Api-Key, resource volc.seedasr.auc_turbo, inline base64 data, no-NO Norwegian, and a single HTTP response. Not the old app-ID/secret scheme.
- Documented speech host is voice.ap-southeast-1.bytepluses.com; ModelArk examples use ark.ap-southeast.bytepluses.com/api/v3. These are evidence of documented APAC endpoints, not an approved EU deployment.
- Region decision remains pending account/service verification. No production region or data residency promise is made.
- TTS/RTC remain disabled until ASR→proposal is verified; RTC excluded from Phase 1.

Source findings do not prove current live production deployments, native builds or physical-device completion. The uploaded task text ends mid-sentence at Step 17; no additional unseen instructions are assumed.
