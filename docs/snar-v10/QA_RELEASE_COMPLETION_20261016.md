# SNAR QA continuation — 16 October 2026

The prior backend-only release was PR #104 / 6afd4f1. It ran on the existing paid
Render service snar-api-qa, My Workspace tea-dassqnrbc2fs73a770i0,
srv-db61otlckfvc73bqp480, https://api-qa.snarapp.no. Compute verified as
0.5c-512mb; no compute upgrade or workspace subscription change was performed.

## Implemented in this continuation

- Remove the extra waiting checkbox from ordinary Customer booking and Assist.
  Keep visible waiting/reservation information and the final booking action.
  Preserve canonical quote tokens, stale-price re-review, duplicate protection,
  card verification, bank authorization before dispatch and real settlement.
- Expose public Render commit/environment in health/readiness so an old API cannot
  pass the new APK release lock.
- Separate manual Customer and Driver workflows using EAS CLI 25.0.0 and existing
  managed signing. Exact reviewed commit, workflow commit and live QA backend must
  match. No production URL or automatic native build trigger is accepted.
- Check EAS build project/profile/platform/source before publishing an APK and its
  hash. Customer APK signing must match SNAR_CUSTOMER_QA_ANDROID_SHA1 (GitHub variable,
  the actual SHA-1 registered in Google Cloud), not a newly generated debug key.
- QA Android requires a dedicated QA_GOOGLE_SERVICES_JSON EAS file secret when push
  is required. Production Firebase config cannot silently substitute for it.
  QA/testflight-qa profiles request this check; QA iOS OAuth no longer inherits
  production configuration. Remove the literal {{ git_sha }} QA environment value;
  native config records the actual EAS_BUILD_GIT_COMMIT_HASH.

## Confirmed incomplete — do not report as finished

- Google Cloud auth/clients returned Site Unavailable twice in this browser.
  Android OAuth signing registration and Customer iOS OAuth are unverified.
- Resend is signed in. qa-mail.snarapp.no was Not Started; verification was requested
  and is Pending. The account displays an unpaid invoice. No DNS record, API key,
  sender credential, invoice payment or actual delivery was completed here.
  Prior Uniweb sign-in was declined; no declined credential request was retried.
- No OPENAI_API_KEY/QA_OPENAI_API_KEY or Astra DB endpoint/token was found in this
  environment or likely project env files. OpenAI's required reuse/create decision
  is unresolved. New AI chat/Astra integration is not implemented. The prior live
  AI endpoint returned explicit 503; do not activate legacy Emergent as a substitute.
- Google Pay native code is present, test-only; live QA activation must be verified
  after saving QA_GOOGLE_PAY_ENABLED=true. Apple merchant remains unconfigured.
- Existing EAS authentication, dedicated QA Firebase files and registered Customer
  signing fingerprint must be present before the workflows can build correctly.

## Native release scope

The user's latest instruction makes new APKs conditional on the requested work
being complete. No new APK/iOS/TestFlight/store build is authorized while the above
provider work is incomplete. Do not silently omit those requirements to produce a
partial APK. No main merge or production backend deployment is included.

Workflow paths: .github/workflows/customer-apk-hotfix.yml (Customer),
.github/workflows/android-build.yml (Driver); reusable qa-android-eas.yml.
Use the QA branch with its full reviewed/deployed commit and BUILD_QA_APK input.
The old phase5-qa-apks.yml automatic/local debug-signing builder is retired.
