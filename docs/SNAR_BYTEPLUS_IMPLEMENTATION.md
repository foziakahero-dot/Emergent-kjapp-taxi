# SNAR BytePlus voice — implementation and continuation

## Saved work
Branch: feature/byteplus-voice-booking-20261013.
Base: 9e7469076e62520743b8e1c7ae51f6a3ec7b2ea5 (latest verified V10 screens).
Baseline checkpoint: fa4b0137f30407ea7870d3c2bc9c20d7307d0b3e.
Backend checkpoint: c04ef58a1583dd7543dbf0fac2d6a62e98aeafd3.
Later Customer and final validation commits are descendants on this same branch.

Implementation is reviewable source, NOT an activated production integration.

## Implemented
- BytePlus Speech Fast Mode adapter using current X-Api-Key contract, inline audio, Norwegian no-NO, volc.seedasr.auc_turbo.
- AAC/M4A/WebM/WAV input normalized to mono 16kHz PCM WAV using ffmpeg; four MB input, 30s duration, eight-second conversion timeout, temporary files deleted; no remote media URLs.
- ModelArk JSON intent adapter with strict Pydantic schema, explicit timeout, no model tools/mutations and sanitized errors. No provider retry after ambiguous outcomes.
- Authenticated, rate-limited /api/ai/voice/config and POST /booking, /booking/proposal, /booking/confirm under /api/ai/voice.
- Server-owned expiring sessions containing real address candidates; user explicitly selects pickup and destination; addresses extracted by model must appear in customer utterance.
- Proposal uses canonical EstimateRequest/trip_estimate and TripRequest models. Real backend prices, road geometry, waiting policy and pricing version; luggage/special needs preserved; XL recommendation and passenger capacity guard.
- Separate explicit true boolean confirmation + waiting consent. Immutable server proposal prevents fare/user/address/client tampering. Atomic Mongo state claim prevents parallel confirmation. Successful repeats use existing trip; uncertain/failed creation cannot be replayed.
- Existing Stripe saved-card, legal consent, service-area, active-trip, booking-enabled, price-change checks, 3DS, authorization and dispatch reused through request_trip and withReservation.
- Existing Assist UI extended with candidate selection, vehicle, proposal, disclosed free/per-minute/capped waiting fee and maximum reservation, consent, confirmation, edit and active-trip recovery.
- Recording stops on background/unmount; scratch recording removed after processing. Manual input and ordinary home booking remain available. Old Assist/transcribe/chat remain when feature is disabled.
- Minimal verified backend correction: trip_estimate/request_trip previously fabricated route distances on OSRM failure. Both now return 503; request_trip releases user booking lock before returning. No other dispatch/payment behavior changed.
- No Driver/Admin/Fleet/web redesign or infrastructure migration.

## Configuration (server only)
SNAR_BYTEPLUS_VOICE_ENABLED=false (default; retain until live QA is complete).
BYTEPLUS_SEED_SPEECH_API_KEY, BYTEPLUS_SPEECH_ENDPOINT,
BYTEPLUS_ARK_API_KEY, BYTEPLUS_ARK_MODEL, BYTEPLUS_ARK_ENDPOINT.
Blank placeholders are in backend/.env.example. No secret value was added to source or Expo settings.

Explicitly configure approved regional endpoints. Documentation currently describes:
- Speech: https://voice.ap-southeast-1.bytepluses.com/api/v3/auc/bigmodel/recognize/flash
- ModelArk base: https://ark.ap-southeast.bytepluses.com/api/v3
These are documented APAC hosts, NOT a final region selection or EU residency guarantee. Never choose a region automatically. EU service availability, endpoint/auth compatibility, account entitlements and processing arrangements must be checked in the signed-in account before activating. DPA/data-residency/latency decisions remain unverified.

Runtime requires ffmpeg on PATH. Verify it on the isolated QA host; add it to the current backend build image if missing, without replacing hosting. Speech development key comes from the current console, not old app-ID/access-token/secret examples. Ark model ID must be selected from that account and verified for JSON-mode support.

## Validation
- 48 passing Python tests: 21 voice-specific tests, plus 27 existing waiting-fare/reservation tests. Uses repository-pinned FastAPI 0.115.6 / Pydantic 2.10.3 / httpx 0.28.1.
- Rendered React behavior: candidate choices before pricing, no mutation from proposal, canonical displayed price/baggage, consent, synchronous double-tap lock, failed-confirm recovery through canonical active trip.
- Changed TS/TSX syntax/transpilation and Python compile pass.
- Tests use local provider/database fixtures; these are NOT live BytePlus/Mongo/Stripe or native-device evidence.
- Full mobile semantic TypeScript/build, startup against real QA Mongo, signed native builds, pixel/device verification, live speech/dialects/latency and physical trip/payment are still open.

Run:
python -m pytest -q backend/tests/test_voice_booking.py backend/tests/test_waiting_fares.py backend/tests/test_ride_reservations.py
node scripts/verify-byteplus-voice.cjs
python -m compileall -q backend

## Blocking account step
BytePlus console is at sign-in. No logged-in project, region, credit/quota or credential was verified. Complete secure sign-in in the existing cloud tab; do not paste passwords or API keys into chat. Then:
1. Inspect account projects and select/create SNAR-AI-DEV.
2. Verify Speech/Ark availability by region, especially EU requirements. Check supported Norwegian ASR and later TTS voice; record final region decision.
3. Create scoped development credentials and configure only the QA backend server, using secure secret handling.
4. Verify ffmpeg, real Mongo TTL indexes/startup, full mobile TypeScript/export/build and the disabled-feature fallback first.
5. Exercise generated/local test audio, then consented Norwegian test speech: Oslo S → Gardermoen + two large bags; ambiguous pickup, no GPS, noise and address edits.
6. Verify proposal creates no trip; change fare/settings before confirmation; expire proposal; concurrent confirm; card/3DS/retry/cancel; controlled QA driver flow.
7. Only after ASR→proposal is reliable, implement and validate TTS. RTC is excluded from Phase 1.
8. Keep production disabled until region/account and physical-device gates pass.

No merge to main, production deployment, APK/IPA, public release, RTC setup, payment transaction or operational test trip was performed.

## Geographic adapter limitation
Map rendering is Mapbox, but current shared backend address search is MapTiler/Photon/Nominatim. This integration reuses that existing adapter. Do not claim Mapbox geocoding. Any future consolidation to Mapbox should be a separate verified change shared with ordinary booking; do not introduce a second competing voice geocoder.

## Sources inspected
- https://docs.byteplus.com/en/docs/byteplusvoice/asraudiofile-flash (updated 2026-10-12; full rendered API read)
- https://docs.byteplus.com/en/docs/byteplusvoice/speechtotextv2
- https://docs.byteplus.com/en/docs/modelark/structured-output-beta
- https://docs.byteplus.com/en/docs/ModelArk/BytePlus_ModelArk_Data_Processing (search excerpt; full region/contract verification still open)
- https://docs.expo.dev/versions/v57.0.0/sdk/audio/ (required by frontend/AGENTS.md)

