# KJAPP Oslo Beta Environment Checklist

Use this checklist for the controlled Oslo beta backend deployment. Do not paste secret values into Git, tickets, screenshots or chat.

## Required runtime

- `APP_ENV=production`
- `MONGO_URL` — controlled production/beta Mongo connection
- `DB_NAME` — KJAPP database name
- `JWT_SECRET` — strong random secret, minimum 32 characters
- `ADMIN_EMAIL` — real superadmin account
- `ADMIN_PASSWORD` — strong initial/rotation password, minimum 12 characters

Production startup intentionally refuses weak/default JWT/admin credentials.

## Reverse proxy / rate limiting

The backend rate limiter uses the client IP. Before beta deployment verify how the hosting layer exposes the original client address.

- Keep `TRUST_PROXY=false` unless the backend is definitely behind a controlled proxy that overwrites `X-Forwarded-For`.
- If the controlled hosting proxy requires forwarded-client-IP handling, enable `TRUST_PROXY=true` only after confirming callers cannot inject an arbitrary forwarded address.
- After deployment, test two separate phones/networks against a harmless rate-limited endpoint to confirm users do not unintentionally share one proxy bucket.

## Customer / web identity

- `KJAPP_PUBLIC_WEB_ORIGIN=https://kjappapp.no`
- `PASSWORD_RESET_WEB_BASE=https://kjappapp.no`
- `APPLE_BUNDLE_ID=no.nexorahub.kjapp.customer`
- `KJAPP_LEGAL_VERSION=2026-09` — current beta consent version; only increment after the corresponding approved privacy/terms text is published

Optional web Apple OAuth later:
- `APPLE_CLIENT_ID` — Services ID only when the web flow is enabled

## Email

For real reset/invite/receipt email delivery:
- `SENDGRID_API_KEY`
- `SENDER_EMAIL=noreply@kjappapp.no`

If SendGrid is missing, the backend reports delivery unavailable without logging the email body or one-time reset/invite token.

## Stripe beta

Required for payment testing:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Keep:
- `KJAPP_AUTO_CHARGE_ENABLED=false`

until the dedicated Stripe test-mode success / requires-action / failure / duplicate-retry run is green.

## Oslo launch controls

Recommended controlled beta:
- `KJAPP_SERVICE_AREA_ENFORCE=true`
- `KJAPP_SERVICE_AREA_CENTER_LAT=59.9139`
- `KJAPP_SERVICE_AREA_CENTER_LNG=10.7522`
- `KJAPP_SERVICE_AREA_RADIUS_KM=45`
- `KJAPP_PICKUP_ARRIVAL_RADIUS_M=400`
- `KJAPP_DROPOFF_ARRIVAL_RADIUS_M=800`
- `KJAPP_NO_SHOW_WAIT_MINUTES=5`
- `KJAPP_DRIVER_ETA_REFRESH_SECONDS=20`

The Admin booking kill switch must be OPEN only while beta rides are intentionally allowed.

## Demo/synthetic data

Production code already forces demo seeding off. Also set explicitly:
- `ENABLE_DEMO_DATA=false`

Platform setting `features.demo_trips` defaults to false on the beta branch.

Before first beta ride verify Admin does not show legacy synthetic/demo drivers as live.

## Object storage / current Emergent dependency

Until the post-beta backend migration:
- `EMERGENT_LLM_KEY` / current integration configuration must support the existing private object-store path used for fleet/driver documents.
- Uploaded documents must remain private and role-gated through `/api/files/{path}`.

Do not migrate storage at the same time as the beta release.

## Optional / feature integrations

Configure only if the feature is enabled for the beta:
- AI provider / Emergent integration settings used by KJAPP Assist
- map/geocoding provider settings
- SendGrid
- Stripe Connect fleet account configuration

A non-critical AI outage must not block booking, dispatch, GPS or payment state.

## Driver identity verification

The Driver selfie-ID flow is staged behind an enforcement flag.

During initial QA:
- `KJAPP_DRIVER_IDENTITY_REQUIRED=false`
- Driver can submit a fresh front-camera selfie.
- KJAPP Admin reviews the selfie against existing profile/driver ID material.
- Fleet owners see verification status only; they cannot open the raw identity selfie.

After physical QA and privacy/retention validation:
- set `KJAPP_DRIVER_IDENTITY_REQUIRED=true` to require status `verified` before Driver approval and operational Driver endpoints can be used.
- set `KJAPP_IDENTITY_SELFIE_RETENTION_DAYS=30` (or the approved retention period, 1–365 days).

Retention endpoints are superadmin-only:
- `GET /api/admin/identity-verifications/retention` reports eligible/retained counts.
- `POST /api/admin/identity-verifications/purge-expired` defaults to `{"dry_run": true}`; use dry-run first.
- only terminal `verified`, `retry_required` and `superseded` records older than the configured period are eligible.
- `pending_review` selfies are excluded.
- database paths are removed only after the object-store delete call succeeds; audit/status metadata remains.

The beta implementation does **not** make an automatic negative decision from face matching. `retry_required` requests another selfie/review without automatically suspending the Driver account.

Before public release, verify one real dry-run and one controlled physical object deletion against the deployed Emergent object store. A successful database update alone must not be treated as proof that the image bytes were physically deleted.

## Mobile beta configuration

Customer:
- Android package: `no.kjapp.app`
- iOS bundle: `no.nexorahub.kjapp.customer`
- Expo project: `3631002e-5b25-4847-b5d8-05ec2ef304b5`

Driver:
- Android package: `no.kjapp.driver`
- iOS bundle: `no.nexorahub.kjapp.driver`
- Expo project: `1dec8949-0423-4fbf-a080-0703f93519d7`

TestFlight/APK beta profile:
- API target: `https://github-app-builder-28.emergent.host`

Long-lived production profile:
- API target: `https://api.kjappapp.no`

Do not point public store builds at `api.kjappapp.no` until that hostname is live and smoke-tested.

## Apple / EAS

In Apple Developer / EAS credentials:
- App ID `no.nexorahub.kjapp.customer`
  - Push Notifications
  - Sign in with Apple
- App ID `no.nexorahub.kjapp.driver`
  - Push Notifications
  - background location / remote notification capabilities generated from app config

Never commit:
- Apple password
- APNs .p8 private key
- distribution certificate private key
- Expo access token

## Direct EAS beta artifact path

GitHub Actions currently fails before jobs start, so signed artifacts can be launched directly through EAS Workflows from the reviewed branch.

Guarded Windows helper from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run_eas_beta_builds.ps1 -Target all -Platform android -Wait
powershell -ExecutionPolicy Bypass -File .\scripts\run_eas_beta_builds.ps1 -Target all -Platform ios -Wait
```

The helper refuses to run unless:
- current branch is `beta/oslo-production-ready`
- working tree is clean
- local HEAD exactly matches `origin/beta/oslo-production-ready`
- the static beta policy passes
- EAS CLI authentication is valid

Direct equivalents:

```powershell
cd frontend
npx eas-cli@latest workflow:run .eas/workflows/android-apk.yml --non-interactive --wait
npx eas-cli@latest workflow:run .eas/workflows/testflight-beta.yml --non-interactive --wait

cd ..\driver-app
npx eas-cli@latest workflow:run .eas/workflows/android-apk.yml --non-interactive --wait
npx eas-cli@latest workflow:run .eas/workflows/testflight-beta.yml --non-interactive --wait
```

The iOS workflow builds the signed beta and submits it to TestFlight. Configure the Apple / App Store Connect connection in EAS before running it.

## Pre-deploy source gate

Preferred:
- GitHub `KJAPP Beta Gate` green

Current fallback while GitHub Actions startup is unavailable:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\beta_local_gate.ps1
```

Required output:
- backend compile PASS
- focused backend security regressions PASS
- Admin build PASS
- Marketing build PASS
- Customer TypeScript / Expo Doctor / config PASS
- Driver TypeScript / Expo Doctor / config PASS

## Post-deploy smoke

Run against the deployed beta API:

```powershell
$env:KJAPP_SMOKE_API="https://github-app-builder-28.emergent.host"
python backend/scripts/release_smoke.py
```

Then verify:
- `GET /api/health`
- `GET /api/ready`
- `GET /api/service-area`
- Apple auth config
- native push config

## Final beta gate

After signed mobile builds are installed:
1. Run `docs/PHYSICAL_BETA_QA.md`.
2. Complete at least one real controlled Customer -> Driver ride.
3. Verify locked-screen Driver push.
4. Verify Driver background GPS.
5. Verify restart/network recovery.
6. Verify Stripe test-mode payment.
7. Verify Admin and Fleet show the same canonical trip/earnings.
8. Resolve/retest every P0/P1.
9. Mark PR #44 ready for review.
10. Merge to `main`.
11. Keep the separately planned backend-ownership migration for the post-beta phase.
