# Customer SNAR 10 AI and voice checkpoint

The new Customer AI and map-backed voice views follow source states 28/29 in the original SNAR V10 package. Existing authenticated AI, location, search, estimate and booking APIs are retained. Source examples for flight predictions, scheduled pickups, third-party passenger SMS and choosing a previous driver are unsupported; the UI offers actual immediate booking, price questions and support instead.

Booking requires valid provider coordinates, a selected real quote, canonical verified reservation card and explicit waiting-policy/authorization consent. Only explicit confirmation creates a ride. Duplicate confirmation is serialized; a lost response checks the existing active ride, changed quotes require new selection, and payment rejection opens payment methods. Future-time requests are refused, including during destination entry.

Voice uses actual microphone permission, audio recording and authenticated transcription. The listening, processing and proposal states reflect runtime state. Duration-limited recordings are transcribed once; cancellation and unmount invalidate pending work and release recording mode. Closing an active recording does not send it. Decorative bars do not pretend to measure sound. The proposal map uses actual route geometry and measured sheet insets.

The text composer is outside the scroll area so it cannot obscure confirmation. The view uses the existing theme hook and is compatible with the concurrent persisted-theme implementation.

Validation: Customer TypeScript, actual-controller behavioral tests in `scripts/verify-v10-assist.cjs`, and six React Native Web scene renders pass. Screenshots in `evidence/2026-10-13/customer-ai-voice/` compare the original prototype and fixture-driven implemented layouts. They use a plain map fixture and are not native GPS, microphone, provider, pixel-parity or device certification. The Chromium confirmation check verifies the composer does not overlap the booking action.

AI provider availability is separate from this UI checkpoint. QA explicitly suppresses the legacy provider key; neither transcription nor live AI replies is certified here. The separate BytePlus work is not activated by this change. Render QA rollout and authenticated integration are required before combined mobile builds.
