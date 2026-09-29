# KJAPP/SNAR beta backend hardening — 29 September 2026

Repository: `foziakahero-dot/Emergent-kjapp-taxi`  
Branch: `fix/beta-mobile-firebase-ops-20260926`  
Render workspace: `tea-dassqnrbc2fs73a770i0`

## GitHub to Render sync

Render API, Admin and Fleet started at `5b2f9ae5d31ff6fa3e03f684a29e0438990daf05`. GitHub was 11 commits ahead at `71cf74afa83dd0468434d145135a0d1b0df4a628`. The 11 reviewed commits were:

| SHA | Scope |
| --- | --- |
| `e3d1f0650a41d889f4f09efdd32e944de186478c` | Mandatory admin 2FA |
| `106bdb3f99e4636874ee8a8b1924135dd647484a` | 2FA regression test |
| `a4c32fe24c338aa25dc60c360d5ec1bcbeaecb1f` | Customer TestFlight API |
| `88c4123a87f7bbc59424fe2697927578c09dcf86` | Driver TestFlight API |
| `c7c316b46d6720f51bb3705f1aa05d2be9aa692c` | Customer legacy API fallback removal |
| `1613de8f2819c1ce0fda8d4f6edf4b37ccda7f6b` | Customer crash-report endpoint |
| `564d25de9eab02470d4b572e739dbc911688303e` | Driver legacy API fallback removal |
| `bcaf2c74ba7593a6a419305f3ed70c8f0a5bed9c` | Driver crash-report endpoint |
| `26d2764c35d02f0b9d76c1180d9c834f43c70510` | Branch merge |
| `26a7975766ea47b79de52dd37664829a81da24be` | Driver settings user restoration |
| `71cf74afa83dd0468434d145135a0d1b0df4a628` | Staging TestFlight profiles |

Additional commits in this hardening pass:

| SHA | Change |
| --- | --- |
| `eb8ccdd64910864507076bcf18e6ef182409b831` | Dispatch generation compare-and-set, reservation race guard, one-use reset claim, Mongo timeouts/pool/indexes, CORS, 2FA on fleet admin entry, truthful health/readiness |
| `e046cabd45ca47ff14c7298181b22ff86633bd70` | Admin and Fleet Render previews target the staging API; beta gate watches this branch and builds Fleet |
| `6101add9156cb616b95f635dc9c805a91b199a69` | Request ID, duration and route-template logs without reset tokens |
| `95a9a114fcde62d63fef823f07ca9fb45b521f61` | Parallel dispatch regression test |

## Audit and verification

- Booking uses a per-customer creation reservation and checks for active trips again after acquiring it. Driver acceptance reserves the driver before claiming the trip. This pass prevents another accept/current-trip request from clearing a fresh in-flight reservation.
- Sequential dispatch now compares the offer generation before changing the offer, and acceptance requires that generation and an unexpired offer. The focused parallel test sends one notification for two simultaneous dispatch calls.
- Stripe Checkout has a per-trip lock, a unique session ID index, verified webhook signatures and a paid-state compare-and-set. Automatic charging stays disabled. Full Stripe test-mode webhook/refund/Connect E2E was unavailable without credentials.
- Uploads enforce an 8 MB application limit and an allowlist of declared MIME types. A future P1 should validate file signatures and limit the stream before reading the entire file.
- The asynchronous Mongo client now has explicit connection, server-selection, socket and queue timeouts with a bounded pool. Dispatch and active-trip query indexes are created on startup.
- `/api/health` returns HTTP 503 if Mongo is unavailable; `/api/ready` returns HTTP 503 when required services are missing. Render's existing service configuration reports a blank health-check path even though `render.yaml` declares `/api/health`; set the service health path in Render.
- Local focused regressions: **23 passed**, Python compile succeeded. A read-only 20-request check of health and service area returned 20/20 HTTP 200 with truthful payloads (median 6.3 s, p95 6.5 s through the remote proxy). This is not a booking or payment capacity claim.
- The GitHub Actions runs for this branch ended with `startup_failure` before jobs began. CI is therefore unverified.
- Render API, Admin and Fleet were deployed at `6101add9156cb616b95f635dc9c805a91b199a69`. The API returned health 200 and Oslo service area 200; CORS preflights for Admin and Fleet staging returned 200 with matching allow-origin. `/api/ready` returned 503 as designed.

## Release blockers and configuration

- Staging readiness flags `stripe_key_configured`, `stripe_mode_safe`, `stripe_webhook_configured`, and `email_configured` are false. Configure `STRIPE_SECRET_KEY` with a **test** key, its matching `STRIPE_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, and a verified `SENDER_EMAIL`; then run payment, webhook and password-reset E2E before accepting real bookings.
- Native Apple configuration reports enabled with `no.nexorahub.kjapp.customer`. Google OAuth configuration reports disabled. Expo Push reports enabled; direct legacy FCM reports disabled. Delivery still needs a physical device test.
- `api.kjappapp.no` did not resolve from the external read-only check. Production/TestFlight beta profiles target that domain; staging TestFlight and internal profiles target the Render API. Do not distribute production-targeting builds before the canonical domain responds.
- Customer Google sign-in still uses `auth.emergentagent.com` and the backend's legacy session exchange. AI routes still import `emergentintegrations` lazily. Removing these paths requires a working replacement and migration test; they were left untouched. The separate legacy EAS profiles are likewise explicit, while normal staging profiles use Render.
- The registration endpoint currently creates a user without a confirmation or welcome email. Forgot-password uses the existing SendGrid path, which is not configured on staging. Supabase Auth email would entail an auth migration and still needs custom SMTP for ordinary users.

## Next controlled gate

1. Configure the missing Stripe test and transactional email credentials in Render; verify the sender domain.
2. Fix canonical API DNS and Render health-check path; configure Google OAuth if it is required for beta.
3. Re-run strict release smoke, an isolated booking/dispatch/payment E2E with test users and Stripe webhooks, and a representative load test on an isolated database.
4. Investigate the GitHub Actions `startup_failure` and require a passing branch gate before release.
