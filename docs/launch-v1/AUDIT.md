# SNAR Launch Candidate V1 audit

Audit performed 26 October 2026, Europe/Oslo. No native builds or deployments started.

## Source selection

- Repository: `foziakahero-dot/Emergent-kjapp-taxi`, default branch `main`.
- Inspected checkout: `release/onboarding-live-base-20261020`, clean, HEAD `02ed5c061d34f80f5b255a2f270a4903aa3c271e`.
- Candidate: `launch/snar-v1-final-20261026`, branched from that inspected production source.
- Most recently committed remote branch: `qa/snar-v10-phase5-staging-e2e`, `72550f4`. Recency is not completeness: its diff removes production payment-mode isolation, onboarding email work, Driver GPS preflight and Google web fixes, and restores Driver social auth. It also introduces a four-item Customer dock, conflicting with this task's three-item navigation.
- PRs 127/129 contain divergent Customer snapshots. Bulk copying would delete current live-car recovery/assignment modules, approved vehicle assets and regression tests. Preserve current modules and port only demonstrated fixes.
- Recent production work: `02ed5c0` Google web token flow, `20e1093` disabled Driver social identity, `d4f0d95` Driver GPS/online and payment safeguards.

## Layout and stack

| Component | Path / implementation |
|---|---|
| Customer | `frontend/`, Expo Router, React Native 0.86, Expo 57, TypeScript, Geist |
| Driver | `driver-app/`, same stack, separate app and EAS project |
| API | `backend/server.py`, FastAPI, Motor/MongoDB, modular reservations/live cars/commerce |
| Admin | `admin-web/`, Vite/React; preserve mandatory 2FA |
| Fleet | `fleet-web/`, Vite/React |
| Landing | `marketing-web/` and `landing-next/` where present |
| Shared behavior | Root `scripts/`; duplicated native components, no root shared package workspace |
| Native configuration | Both `app.config.js`, `eas.json`, package manifests and lockfiles |

Both app `AGENTS.md` files require Expo 57 documentation before edits; versioned reference read. Existing stack supports native entrance animations, safe areas, secure token storage and platform-specific wallet adapters.

## Infrastructure verified

Confirmed Render workspace: `tea-dassqnrbc2fs73a770i0` (My Workspace).

| Environment | API | Service / actual live commit |
|---|---|---|
| Production | `https://api.kjappapp.no` | `kjapp-beta-api`, `srv-datbvsid0e5s73bg0s30`, paid `0.5c-512mb`, live `02ed5c0` |
| QA | `https://api-qa.snarapp.no` | `snar-api-qa`, `srv-db61otlckfvc73bqp480`, paid `0.5c-512mb`, live `3a7e1de` (18 October) |

Both `/api/health` return 200 and database true. Production `/api/ready` returns 503; QA returns 200, which does not establish launch readiness. Both services have automatic deployment disabled.

Vercel lists `snar-admin`, `snar-fleet`, `snar-landing`, `snar-fleet-qa`. Netlify also retains `kjappapp-no` (www.snarapp.no), `snar-admin-qa`, `snar-fleet-qa`. Project existence is verified; exact deployed website source/domain ownership still requires checking and is not inferred from project names.

## Integration findings

- API URLs use `EXPO_PUBLIC_BACKEND_URL`, default production. QA EAS profiles explicitly use QA. No native build is started to change this.
- Password auth uses `/auth/login`, client-specific role filtering, JWT, revocation and native SecureStore. Driver email/phone/password is already present; no Driver social buttons in chosen source.
- Customer login is email/password, not phone-first. Neither live API exposes Customer/Driver OTP config. Legacy Driver OTP contract tests reference functions absent from current source. Do not invent SMS success or automatically attach ambiguous legacy phone accounts.
- Customer Google native/web verified identity endpoints exist. Google iOS client ID is absent in both live configs. Production Driver config correctly disables Google and Apple; stale QA config enables both.
- Apple native auth configuration is present; physical iOS runtime/entitlements remain unverified.
- Production `/payments/native/config` reports disabled, no publishable key, wallets disabled. QA cards enabled in test mode, both wallets disabled. Never claim wallets runtime-ready.
- Stripe reservations authorize before dispatch; capture/completion and stored-card return adapters already exist. Preserve live/test isolation and historical trip values.
- Mapbox is platform-specific, with existing fallback map implementations. Driver live locations and Customer snapshots use authenticated eligibility/radius filters and Socket.IO. Actual-hook regressions cover stale removal, 5 km exclusion, own-location exclusion and assigned identity.
- Dispatch `RideSearch` and canonical trip states are shared: `payment_authorizing`, `searching`/`booking`, `driver_on_way`, `at_pickup`, `in_trip`, `arrived`, `completed`/`rated`, `cancelled`. Preserve these names. Offer deadlines are server-driven; do not substitute a local timer.
- Expected dedicated Driver offer WebSocket helpers are absent. Existing polling and shared Socket.IO are present. A missing optional transport is distinguished from broken canonical dispatch.
- Online already preflights real GPS, vehicle/compliance and confirms server summary. End-to-end online to Customer visibility has not been demonstrated in this session.
- Resend-capable `email_delivery.py` and onboarding outbox exist. SMTP/provider delivery is not exercised in this audit.
- New-trip pricing still uses percentage commission defaults despite the requested subscription business model. Do not rewrite historical financial snapshots or silently mutate production fleet agreements.

## Baseline checks

- `npm ci --no-audit --no-fund`: PASS in both apps.
- `npx tsc --noEmit`: PASS in both apps.
- Focused backend tests: 94 PASS, 10 FAIL (missing legacy Driver OTP and dedicated offer socket helpers).
- Live-car actual-hook, payment import, asset checks: PASS.
- Search panel test: FAIL in stale renderer stubs (`SheetFrame` undefined); investigate actual panel layout separately.
- Expo dependency validation: Driver reports seven patch-version mismatches; Customer online check hit proxy timeout. No package downgrade or blind SDK migration.
- Lint script absent in both app manifests. Runtime and device checks pending.

## Implementation sequence

1. Add a truthful phone-first Customer login using provider-backed OTP, preserve password/social alternatives and legal gates. Handle unavailable SMS and ambiguous accounts safely. No DB index migration without inspecting existing identity constraints.
2. Reduce initial Home surface, stabilize compact/expanded search, retain approved category assets and live-car modules; minimal Customer navigation and secondary AI entry.
3. Simplify Driver Home around status, canonical readiness and one online action; preserve password-only auth and shared trip lifecycle.
4. Fix actual regressions uncovered by tests. Align Expo patch dependencies using versioned package metadata. Keep subscription mismatch explicit until all booking/settlement paths are consistent.
5. Static and isolated behavioral tests, local web smoke where possible, read-only deployed endpoint checks. Record every unverified native/device/provider behavior as blocked.
6. Commit logical changes and publish reviewable candidate. No design-freeze declaration until runtime and full cross-app gates pass. No APK/AAB/IPA/TestFlight.
