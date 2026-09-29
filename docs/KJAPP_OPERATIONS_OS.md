# KJAPP Operations OS

Status: implementation branch `feature/kjapp-operations-os-20260929`.

Target UI: `https://admin.kjappapp.no/operations-os` after review, merge and deployment.

## Purpose

KJAPP Operations OS is the safe control plane for routine post-launch changes. It is deliberately narrower than the full Admin Settings, Pricing, Finance and Integration surfaces.

The goal is that low-risk operational changes can be made in minutes without a new APK/TestFlight build, while pricing, payments, authentication, database, dispatch and native changes keep their dedicated release gates.

## Remote config

Public read endpoint:

`GET /api/config/runtime?app=customer|driver`

Server-controlled values:
- Customer home prompt and hint
- Support/help/privacy/terms destinations
- Maintenance/update metadata
- Non-sensitive global status copy
- Safe operational feature state

Customer currently consumes the home prompt and hint.
Driver settings currently consume help/privacy/terms/support destinations.

If the runtime endpoint is unavailable, both apps keep safe hard-coded fallbacks.

## Quick feature flags

Operations OS may publish only:
- `booking_enabled`
- `ai_chat`

`booking_enabled` is enforced server-side by the trip request endpoint.
`ai_chat` is enforced server-side by the AI chat endpoint.

Pricing/surge and payment/Vipps controls are intentionally not writable through quick publish. Use the dedicated Admin Pricing/Settings/Integration flows.

`demo_trips` can never be enabled from Operations OS.

## Versioning and rollback

Every publish:
1. Ensures the existing state has a rollbackable baseline.
2. Reserves a unique history version.
3. Uses compare-and-swap against the current live version.
4. Rejects concurrent writers with HTTP 409.
5. Writes an audit event.

Rollback creates a new version; history is never rewritten.

## AI Senior Engineer

The AI page is a change planner, not a production shell.

With `OPENAI_API_KEY` configured on the backend, it uses `KJAPP_ADMIN_AI_MODEL` (default `gpt-5.6-sol`).
Without a key or when the provider fails, a deterministic rules planner remains available.

AI may directly propose/apply only allow-listed runtime config and:
- `booking_enabled`
- `ai_chat`

A superadmin must explicitly approve a plan, then explicitly apply it.

Pricing, payments, auth, database, Stripe, dispatch, backend code, OTA and native changes are advisory only and must go through the repository/release pipeline.

No shell command, GitHub mutation or deployment credential is exposed to the AI planner.

## Release Center

The release registry tracks:
- app/system
- config / OTA / native / backend / web
- staging / production
- version/source ref
- approval/publishing/published/failed/rolled-back state

This first version is a control/approval ledger. It does not pretend that OTA is configured.

## OTA status

EAS Update is NOT active yet.

Before enabling OTA for the two Expo apps:
1. Install `expo-updates` with the Expo SDK-compatible version in each app.
2. Run `eas update:configure` for Customer and Driver.
3. Commit the generated app config + lockfile changes.
4. Add explicit preview/production channels.
5. Build one new native binary for each app containing expo-updates.
6. Test preview OTA on physical devices.
7. Add a guarded production publish workflow.

Do not manually edit package-lock metadata to fake this setup.

## Deployment order

1. Backend unit/regression checks.
2. Admin TypeScript/build check.
3. Merge PR to the active beta branch.
4. Deploy backend.
5. Verify `/api/health`, `/api/ready`, `/api/config/runtime`.
6. Rebuild/deploy Admin.
7. Verify Operations OS as superadmin including 2FA.
8. Test config publish and rollback.
9. Only then enable any production workflow.
