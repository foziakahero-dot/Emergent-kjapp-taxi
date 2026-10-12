# SNAR Phase 5 — resume checkpoint, 2026-10-12 22:45 Europe/Oslo

## Continue here; do not restart

Task 1 (QA build safety) and task 2 (QA CNAME/TLS) remain completed.
Task 3 is now completed: QA Mongo and isolated Stripe credentials pass live readiness.
Task 4 is partially completed: canonical build preflight and Stripe webhook delivery tests pass; APK and full ride/device E2E remain blocked.

Next action: resolve the existing GitHub Actions billing lock through an authorized human payment path, or use an authenticated local/EAS QA builder. Then run the existing QA build workflow on `qa/snar-v10-phase5-staging-e2e`, inspect both APKs, and execute the remaining synthetic ride/device tests. Do not reprovision resources, reseed users, reset credentials, repeat completed code tests, merge main, or deploy production.

## Verified current state

| Item | Result |
|---|---|
| QA branch | `qa/snar-v10-phase5-staging-e2e` |
| Source reviewed / deployed | `a9074efeb3a28c64ea1901b87a3a92924a96848a`; the commit containing this checkpoint is documentation only |
| Render service / ID | `snar-api-qa` / `srv-db61otlckfvc73bqp480` |
| Render workspace | `tea-dassqnrbc2fs73a770i0` (My Workspace) |
| Render hostname | https://snar-api-qa.onrender.com |
| Latest live deploy | `dep-db6k9dqj9qps73condqg`, live 20:37:56 UTC |
| Canonical QA API / TLS | https://api-qa.snarapp.no; standard TLS verification, direct responses, no production redirect |
| MongoDB | Separate project SNAR Phase 5 QA / cluster snar-qa / database `snar_qa`; current readiness confirms isolation and connectivity |
| Database user / network | Prior verified QA-only user `snar_qa_render`, readWrite on snar_qa; Render Frankfurt CIDRs only; unchanged |
| Canonical health | HTTP 200, status=ok, db=true, 20:40:25 UTC |
| Canonical readiness | HTTP 200, ready=true, status=ready, blockers=[], 20:39:39 UTC |
| Safety checks | qa_mode=true, qa_database_isolated=true, production_mode=false, demo_data_disabled=true, auto_charge_enabled=false |
| Stripe QA sandbox | SNAR Phase5 QA, `acct_1UPpL4K6MSfv9nTe`, sandbox/test only |
| QA webhook / ID | https://api-qa.snarapp.no/api/stripe/webhook / `we_1UPpVqK6MSfv9nTe2tihIztJ` |
| Webhook API version / events | 2026-09-30.endive / ten Checkout and PaymentIntent events |
| Stripe credentials | Saved QA secret/publishable/webhook variable names present; live readiness confirms secret, signing secret and test mode. Values were not printed or committed |
| Original sandbox | Kjappapp sandbox `acct_1TG3m12eKdaX7ani`; existing webhooks untouched and not used for these fixtures |
| Build backend preflight | Existing repository `phase5-qa-backend-preflight.cjs` ran against canonical QA origin, exit 0: qa=true, database=true, stripeTestMode=true |
| Synthetic seed | Prior verified 3 Customers + 3 Drivers, 1 Fleet, 3 assigned vehicles; preserved, no reseeding |
| Live account smoke | Prior certified 34 PASS / 0 FAIL, carried forward, not repeated |
| Other providers | No new OAuth, push, email, identity or Mapbox certification. Email false in readiness; prior provider restrictions/suppression remain |
| Customer QA build ID / APK link | NOT BUILT / none |
| Driver QA build ID / APK link | NOT BUILT / none |
| Both configured QA API targets | Exactly https://api-qa.snarapp.no; APK runtime verification NOT RUN |
| QA01–QA28 physical totals | PASS 0 / FAIL 0 / BLOCKED 28 / NOT RUN 0; API/webhook checks do not change physical test totals |
| Complete Customer → Driver ride/payment | NOT RUN / BLOCKED pending QA builds and device test setup |
| Two-Driver concurrency | Runtime/device NOT RUN; previous code contracts PASS, carried forward |
| App restart/recovery | Device NOT RUN; previous code contracts PASS, carried forward |
| Customer receipt | Completed paid SNAR ride NOT RUN |
| Driver earnings | Completed paid SNAR ride NOT RUN |
| Visual QA | Native captures 0; prior MATCHED 0 / PARTIAL 5 / BLOCKED 60 / NOT RUN 2 |
| Backend regression | Prior 323 PASS + 7 subtests / 0 FAIL; no business logic changed and suite not needlessly repeated |
| Customer / Driver TypeScript | Prior PASS / PASS, carried forward |
| Design / Driver summary / QA guards | Prior Customer PASS / 4 PASS / 12 PASS, carried forward |
| API audits | Prior Customer 241 routes / 83 contracts / 0 unmapped; Driver 61/61 mapped / 0 unmapped |
| Build blocker | GitHub UI: “GitHub Actions workflows can't be executed on this repository. Your account's billing is currently locked. Please update your payment information.” |
| Latest observed Actions run | `38299948737`, a9074ef, startup_failure, no APK; no pointless rerun attempted |
| Alternative builder availability | This resumed scratch runtime has Java/Node but no Android SDK/adb, EAS executable or EXPO_TOKEN. No paid purchase, permission expansion or billing change made |
| Final decision | **NO-GO for controlled beta** until actual QA artifacts and complete ride/payment/device certification pass |

## New Stripe delivery evidence

Only the active new SNAR Phase5 QA sandbox was used. Stripe Shell triggered the vendor's disposable synthetic fixtures; these are not SNAR ride payments.

- `stripe trigger payment_intent.succeeded`: succeeded. `payment_intent.created` and `payment_intent.succeeded` both delivered to the QA endpoint with HTTP 200 at 20:41:18 UTC.
- Successful event: `evt_3UPq24K6MSfv9nTe1zetbF8k`. Resending that event delivered HTTP 200 at 20:42:31 UTC. This certifies repeat delivery handling, not paid-trip settlement idempotency.
- An unsigned synthetic webhook POST was rejected with HTTP 400 / Invalid signature at 20:42:44 UTC.
- `stripe trigger checkout.session.completed`: succeeded. PaymentIntent created/succeeded and Checkout completed all delivered HTTP 200 at 20:43:15 UTC.
- Checkout event `evt_1UPq3yK6MSfv9nTefTqeQKet` received HTTP 200 with status=ignored: fixture metadata has no corresponding SNAR payment transaction, so the handler does not mark a ride paid. This is the expected safe boundary.
- Six signed delivery attempts returned 200 (including one resend); one unsigned probe returned 400.
- Stripe Dashboard delivery statuses and Render request logs corroborate these results.
- Fixtures were test-mode USD vendor examples. No NOK fare, Connect transfer, real payout, SNAR receipt or Driver earnings result is inferred from them.

## Protection and handoff

Production database and backend were untouched. No Stripe live transaction, real payout, production deployment, main merge, OTA, store release or TestFlight submission occurred. Existing sandbox webhooks were not changed. No production push, SMS or email was sent.

Human Render sign-in was resumed securely. The Stripe variables were already saved when the environment page was inspected; this resume did not transfer Mongo credentials or recreate Stripe keys. Secrets and tokens remain outside Git.

The old dated reports retain historical failures for provenance. This checkpoint supersedes their current-state claims about missing Mongo, missing DNS/TLS or missing isolated Stripe configuration. Preserve the completed three tasks; continue only the remaining build and E2E work.
