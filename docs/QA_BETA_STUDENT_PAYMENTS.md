# QA: early completion, receipts, students and panels

This release is source work for the isolated QA environment. It does not activate
Stripe live, email/SMS providers, production, or mobile builds.

## Trip completion and payment

The assigned driver can finish a started trip before the destination or without
fresh GPS. The server records the reason and actual location when available.
The stored agreed fare, including accepted waiting charges, is preserved. Driver
asks for confirmation for both card and cash; location alone never marks a trip
paid. Cash remains due until explicit receipt of the full amount. Reserved cards
use the existing idempotent capture; other cards retain the existing payment
feature flags. No commission or refund policy changes.

Paid trips create the existing receipt snapshot, now including manual-end audit
fields. New receipts have bounded email retries (eight attempts, backoff, leases
and per-recipient sent markers). Email being unconfigured does not consume retry
attempts. Backfill does not automatically email historical receipts. Finance
admins with existing 2FA can see receipts and queue missing delivery again.
Delivery confirmation is provider acceptance, not proof of arrival in an inbox.

## Student verification

Customer: Konto → SNAR Student. Upload a readable JPEG/PNG/WebP up to 5 MB,
institution, proof validity date within one year, and explicit consent. EXIF is
removed and images are limited to 1600 px. Proofs are private and inaccessible
after seven days, with Mongo TTL cleanup. Processing deletes the reviewed proof.
Superseded upload revisions expire separately. Customers can withdraw; account
erasure removes student data and the existing GDPR export includes current proof.

Operations admins with existing 2FA review proof against the customer name and
expiry date. Decisions require a reason and the current application revision.
Uploads do not grant eligibility; expired/revoked/rejected applications do not
qualify. No email-domain inference or automatic account matching is used.

No discount rate, student fare category or free ride is enabled. Owner must choose
benefit, budget and funding before implementing server-side quote/booking rules.
Student approval alone must never alter payment amounts. Corporate accounts are
outside this release.

## Hosting the QA panels

The current Vercel panel URLs returned HTTP 402 DEPLOYMENT_DISABLED during audit.
This change prepares hosting on the existing QA API without a new service/plan.
Render includes Node/npm in native runtimes; repository Node is pinned in
`.node-version`. Keep APP_ENV=qa, the existing QA branch and start command.

Set the QA service build command to:

```sh
bash scripts/build-render-qa.sh
```

The build installs locked panel dependencies and exports QA-only bundles. After
a verified QA deploy, entry points are `/api/qa-admin/` and `/api/qa-fleet/` on
the QA API host. They use the same-origin `/api`, not the production proxy.
Fleet supports browser-history deep links; missing assets stay 404. QA mounts
are absent outside APP_ENV=qa. Existing role checks, 2FA and fleet isolation
remain in force. No tokens/credentials are embedded in bundles.

Changing this file or merging code does not change Render's build settings.
Verify real hosting separately; do not claim these URLs work before deployment.

## Validation and beta gate

Run isolated backend tests, Customer/Driver TypeScript, both panel builds, and
`node --test scripts/student-verification-ui.test.cjs scripts/cash-payment-ui.test.cjs scripts/customer-phone-signup-ui.test.cjs scripts/driver-navigation.test.cjs`.
Legacy `test_iter*.py` use external demo servers and are excluded from isolated
testing; do not point them at a shared or production backend.

Physical beta gate: two phones, fresh GPS/live cars, early finish for cash and
reserved card, explicit cash collection, interrupted network/retry, no duplicate
capture/receipt, review/expiry/withdrawal, panel roles and 2FA, actual email receipt
once configured. Source tests, web compilation, installed APK and physical trip
tests are separate evidence. Prior mobile build pause remains in effect.

Measure student verification → first completed ride → repeat ride and cost per
active customer. Downloads alone do not establish useful or sustainable growth.
