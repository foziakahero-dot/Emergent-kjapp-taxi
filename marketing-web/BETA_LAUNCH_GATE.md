# SNAR Oslo Beta — launch gate (draft)

This branch adds **/beta** as a dedicated marketing page. It reuses the *existing* `BetaWaitlist` modal (passenger role by default); it does not create an independent registration database or change the mobile applications.

## Current application flow (code inspected)

1. User opens `/beta` and selects **Søk om beta-tilgang**.
2. The existing modal validates name, phone, email, city and contact consent.
3. Browser posts JSON to `POST /api/waitlist`.
4. Site handler `marketing-web/api/waitlist.js` should proxy to `POST /api/marketing/waitlist` in SNAR backend.
5. Backend stores the interest in MongoDB `beta_waitlist` (idempotent; global rate limit).
6. Admin lists applications at `/beta-waitlist` via `/admin/beta-waitlist`.

## NOT verified / blockers before go-live

- **Endpoint routing:** `marketing-web/vercel.json` currently rewrites `/api/:path*` to the old `api.kjappapp.no` host. It may bypass the local `/api/waitlist` function. Confirm correct routing and update configuration deliberately; do not use the old default accidentally.
- **Environment:** Vercel's landing project has no visible configured SNAR API URL environment variable. Verify the expected Render QA or production base URL and that waitlist records land in the corresponding isolated database. Do not submit real user PII until verified.
- **Actual access control:** Admin statuses are currently `new`, `contacted`, `archived`. None provides proven beta authorization or verified phone allowlisting. Implement & test separate invitation/approval logic before distributing builds.
- **Email:** Confirmation delivery is not verified. Check sender domain and email service.
- **Legal:** Verify the published privacy notice and consent text with the responsible company.
- **Incentives:** No free trips, referral promotions or 100 kr credits are activated by this branch. Avoid public promises until approved and implemented.
- **Mobile QA:** Customer/Driver build gate, payment, maps and dispatch untouched. Do not infer app readiness from a working marketing preview.

## Review gate

- `cd marketing-web && npm ci && npm run build` (TypeScript + Vite).
- Check desktop and 360px mobile layout, focus/keyboard navigation, privacy link, successful and failed requests.
- Verify submission in the correct MongoDB environment and display in SNAR Admin with a synthetic test identity; clean up that test record afterward.
- Keep draft PR unmerged until runtime end-to-end test is documented.

## Verified 2026-11-03

- Render QA `api-qa.snarapp.no/api/health` returned `status=ok`, `db=true`, environment `qa`, commit `c9650af8e6ffa3005ba7571ffee363ffab673069`.
- Read-only `/api/ready` returned `ready=true`, `qa_mode=true`, `qa_database_isolated=true`, `production_mode=false`, `email_configured=true`, no blockers. This check verifies a QA-named database, not an end-to-end write to the Atlas QA project.
- The separate Atlas `SNAR Phase 5 QA` / `snar-qa` cluster exposes database `snar_qa` and `beta_waitlist` (initial count 0).
- The React `/beta` route successfully built and rendered in a Netlify branch deploy. `/beta-intake` required dedicated preview serverless routing; a Netlify function and redirect have been added.
- Preview QA intake fails closed unless the Netlify Functions env var `SNAR_BETA_QA_INTAKE_ENABLED=true` is configured for an approved preview. Vercel preview intake separately requires `VERCEL_ENV=preview` and the same toggle. Do not enable it for production.
- Vercel preview build request failed with HTTP 402 due overdue team balance. No Vercel release occurred.
- Automated browser submission could not start because TinyFish wallet has insufficient funds. **No synthetic registration has been submitted yet.** Do not label the end-to-end gate as passed.

## Next QA steps, without bypassing gates

1. After verifying the connected QA backend and preview routing, run `SNAR_QA_SMOKE_CONFIRM=YES node marketing-web/scripts/qa-beta-smoke.mjs` from a trusted developer machine. This is a one-time, explicitly opt-in POST to the QA API only.
2. Verify the returned synthetic identity key in `snar_qa.beta_waitlist` on the QA Atlas cluster, and in the authenticated QA Admin beta-waitlist. Remove exactly this synthetic record and related QA email outbox record, without touching production.
3. Enable the preview-only intake toggle for a restricted test; submit the form through the deployed `/beta` preview and verify the same database/admin flow.
4. Only once (1)–(3) pass, design and implement the **separate** passenger allowlist/approval and invitation features in QA. Existing `new/contacted/archived` admin status changes do not grant mobile access. Preserve customer and driver release gates.
