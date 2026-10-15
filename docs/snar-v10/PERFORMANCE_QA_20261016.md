# QA performance investigation — 16 October 2026

## Release hold
No new APK, iOS, TestFlight or store builds are authorized until the outstanding QA work is reviewed. This change only deploys the QA backend. Mobile changes are source-only pending a later approved build.

## Baseline and scope
Base commit: efcb288de8a2f63c618743a77d8a7f30d186e76f.
API: https://api-qa.snarapp.no, Render service srv-db61otlckfvc73bqp480 in My Workspace.
The service was verified on paid 0.5c-512mb compute ($7/month). No additional compute upgrade was performed.

The earlier 6–7 second curl timings were NOT backend execution timings. Render request logs for those exact health/readiness timestamps reported 5–10 ms. Detailed curl measurements included 5.26–5.90 seconds before TLS/proxy connection setup completed, both on the custom hostname and the onrender hostname. This supports a test-network overhead explanation; it does not measure a phone's total latency or rule out mobile issues.
Historical login requests on the previous Free instance took 1.62–1.72 seconds at Render. Trip estimate samples took 160–929 ms. These are small samples, not a load-test result or an after-upgrade login benchmark.

## Implemented
- Password hashing/checking in async server handlers is awaited in worker threads, including native OAuth new-user creation. Same bcrypt implementation and cost; rate limits, RBAC, disabled-account rejection and 2FA remain intact. This prevents one password check from blocking unrelated requests; it does not eliminate password-check CPU time.
- Added Server-Timing app duration response header and request IDs. Requests exceeding one second are logged with route template, status and duration, without query strings, auth headers or request bodies.
- Home and Messages consume the active-trip state already polled by GlobalCustomerShell. Removed their separate periodic active-trip requests. The shared poll stops while the app is in the background and resumes on activation. The existing 2.5 second foreground cadence is retained.
- Updated an existing source-contract assertion to follow the shared trip state. Also corrected a pre-existing stale receipt assertion to include its existing stronger arrived-status guard; receipt code was not changed.

## Validation
- 77 focused backend tests passed, including concurrent login/health response and invalid/disabled login rejection; security, QA isolation, mobile commerce, support and trip-source contracts.
- Customer TypeScript passed; git diff --check passed.
- No credentials, provider keys or real payments were used for these tests.
- Live post-deploy timing and deploy ID are to be recorded in the follow-up evidence.

## Not certified
No new physical-device timing, signed mobile build, full load test, Google/Apple account acceptance, wallet payment, AI response or end-to-end ride was certified. These remain separate QA requirements.

## Next steps
Measure login and trip p50/p95 during controlled device QA using request IDs and Server-Timing. Fix GPS/manual pickup and startup recovery; finish social auth, AI/support and wallet acceptance. Consider event-driven trip/location updates only after the correctness baseline and measured polling limits justify it. Do not add Redis, autoscaling or another database as a speculative performance fix.
