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
