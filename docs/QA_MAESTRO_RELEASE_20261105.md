# SNAR QA mobile release and Maestro execution

## Latest observed results, 6 November 2026

Render QA is deployed at afd2bfaf5a5afe6f706a4ed3488a19fdc759cf6a. Subsequent bounded QA fixes and test definitions are on qa/mobile-preflight-maestro-20261105; no production deployment.

| Artifact or gate | Observed result |
| --- | --- |
| Driver Android QA APK | SUCCEEDED, 7d946fc9-55f1-4352-b41a-c9487e4daf9e, 1.0.2 (1), source afd2bfa |
| Driver iOS testflight-qa | SUCCEEDED, 065948db-d6be-4cf4-a203-7714f2d70f02, 1.0.2 (16), source afd2bfa; upload and Apple processing SUCCEEDED |
| Driver Maestro entry | PASS 1/1, workflow 01a1adae-896c-7ed4-a07e-ba7252fc8d3d; onboarding and invitation-only entry, no authenticated trip |
| Customer iOS testflight-qa | SUCCEEDED, e1208e09-3501-4278-a303-6470302dc3ad, 1.0.1 (35), source bd46585; upload/Apple processing 01a1adbf-7b3b-78eb-a540-22250db08b71 SUCCEEDED |
| Customer Android native gate | PASS, workflow 01a1adc8-e66c-7cdc-87aa-fac161f72371 on cba41f51cec00722a059c098dcc0428e9c400706 |
| Customer Android QA APK | SUCCEEDED, e3e0f65e-ee0a-470c-8466-3473708a7147, 1.0.1 (9), qa/preview/qa, source cba41f5; APK and Install control verified, build time 28m 44s |
| Customer Maestro entry | PASS 1/1, workflow 01a1aed1-de69-746a-af12-8c59f9bbb48d (2m 26s), test source bcade898; exact Customer APK above, no credentials or account creation |

The user-supplied QA Firebase export passed project, package and EAS certificate checks. The existing immutable Secret is preserved; preview-only Secret file QA_GOOGLE_SERVICES_JSON_V2 is preferred for Customer QA. No Firebase provider, production config, dependencies or lockfiles changed. The secret JSON is not in Git.

35 focused Node checks and direct QA/production file-selection assertions passed. The Customer QA hook retains TypeScript and Expo compatibility checks against installed SDK metadata; new online patch recommendations do not change the locked QA dependency set.

Customer EAS Build's separate online Expo Doctor reported 20/21 checks passing; the remaining check recommends 11 newer SDK57 patches. This is the previously investigated difference from the reviewed locked SDK metadata, not a new native identity failure. No exclusions, dependency upgrades or lockfile edits were added. The actual post-install hook and compilation succeeded. Do not report all online Doctor checks as green.

Customer Maestro observed fresh startup, the permissions screen, a second fresh launch to Google login entry, registration fields, empty-field validation and the registration Google button. It did not submit consent, authorize Google, create a customer or book a trip. Driver entry similarly does not prove invited login or a complete trip. Read-only QA health/ready requests on 6 November returned HTTP 200, ready=true, blockers=[].

TestFlight upload/processing is distinct from tester-group access, installation and physical Apple/Google sign-in. Those remain unverified. Superadmin exists, but private password reset/2FA and successful panel access remain unverified. Full authenticated registration, dispatch, trip and Stripe TEST payment remain pending.

## QA Superadmin recovery preparation, 6 November

A new private login attempt with the confirmed QA account still returned Feil innlogging. No password was visible to the agent and no retry loop was performed. Source inspection confirms that QA Admin uses the same-origin /api/auth/login route; the QA forgot-password endpoint intentionally does not issue a reset email. An existing password hash cannot be converted back to a verified plaintext password.

backend/scripts/recover_qa_superadmin.py is prepared, **not applied**. Its default invocation only verifies eligibility. The --apply mode requires operator-controlled TTY password entry and confirmation; getpass echo fallback, pipes, files, argv and environment password inputs are refused. Rejected CLI arguments are not echoed. The utility reuses the existing QA environment and live Atlas/database-identity checks, requires canonical snar_qa and exactly one qa-superadmin@snarapp.no in approved, enabled, must-reset, not-yet-2FA-enrolled bootstrap state, and refuses other accounts or established 2FA enrollment. It rotates the password atomically and invalidates previous sessions without changing roles, permissions, approval or 2FA state. The operator's confirmed new permanent password completes the password-reset requirement; private 2FA enrollment remains mandatory for Admin access.

44 local recovery/bootstrap regression tests passed with the repository's bcrypt 4.2.1, motor 3.6.0, pymongo 4.9.2 and pytest 9.1.1 versions. No live recovery, production deployment, new account or credential file was performed. Render console sign-in and operator handoff are required before any recovery can be applied.

## Validation workflow scope

Both validation workflows are manual custom jobs. Neither starts a build, account, booking, payment or submission.
They install locked dependencies, run TypeScript and Expo checks, inspect QA readiness and native identity, and generate Android/iOS native files without compilation.
Use the full reviewed commit as expected_source_sha. A local YAML parse is not an Expo runtime validation result.

## Safety and release gates

- Use only existing elitetransport/kjapp and elitetransport/kjapp-driver.
- Android build profile qa; iOS build/submit profile testflight-qa; environment preview; channel qa.
- Before a build, the reviewed source and deployed QA SHA must satisfy the existing qa-release-lock.
- Before any account mutation, runtime QA database identity must pass. On 5 November it passed on c1203c7, against the exact three approved Atlas members.
- Superadmin password, TOTP secret and backup codes stay with the operator. No bootstrap bypass or automated TOTP enrollment.
- Verify current Android signing fingerprint/Google registration and current Apple provisioning before authorizing each platform.
- Record the actual EAS build ID, project, profile, source SHA, artifact, signing metadata and final status. A workflow request alone is not a build.
- User authorized Expo build billing on 5 November. Published medium-worker rates are Android USD 1 and iOS USD 2: four first-attempt builds total USD 6 before tax. Do not upgrade plans or add workers.
- Maestro jobs have separate runtime charges. Published Expo rate is USD 0.05 per test job plus runner minutes. Use bounded runs without automatic retries.
- Android APKs can be tested in an emulator. TestFlight IPAs cannot run in an iOS Simulator: automated iOS Maestro needs a separate QA simulator build or a compatible supported device runner. Do not mislabel TestFlight installation as an automated iOS test.

## Prepared mobile flows

- frontend/.maestro/customer-registration-qa.yml: synthetic email/password registration, required consent, profile/permission progression and home.
- driver-app/.maestro/driver-invitation-only-qa.yml: password/invitation entry and absence of social login/self-signup.
- Existing customer-startup.yml remains available. customer-entry-qa.yml reuses it, opens Google login and registration entry, and checks required-field validation without entering credentials, accepting terms, authorizing OAuth or creating an account.
- Select only verified new QA APK build IDs. Do not reuse a production/apk-profile build in a Maestro job.
- Provide unique synthetic @example.invalid customer email and a short-lived password through protected runtime inputs. Do not commit real fleet contacts or credentials.
- Test traces can contain resolved input commands. Keep credential-entry traces private and short-lived; do not publish raw traces, QR codes, tokens, passwords or screenshots of secrets.
- Customer entry files were checked against source selectors and parsed locally; runtime execution passed on the signed APK as recorded above. Driver invitation entry also passed.

## Whole-flow runtime matrix

| Stage | Required runtime evidence | Current state |
| --- | --- | --- |
| Fleet application | Synthetic registration, five test documents, application visible in QA Admin | Pending |
| Superadmin review | Private operator enrollment, authenticated QA Admin, actual application approval | Pending |
| Fleet isolation | QA Fleet login; separate fleet cannot see the application, vehicles or drivers | Pending |
| Driver invitation | One synthetic driver invitation, document upload, Admin approval and correct vehicle association | Pending |
| Customer registration | Run registration flow, verify exactly one new backend account and welcome status | Prepared, not run |
| Driver app | Invitation-only entry, invited login, GPS readiness and online supply | Entry PASS 1/1; invited login/GPS/online pending |
| Booking and dispatch | Customer selects route/payment and books; actual offer reaches the QA driver | Pending |
| Trip lifecycle | Assigned, driver_on_way, at_pickup, in_trip, completed; both apps agree with server | Pending |
| Stripe test payment | Test card setup, authorization/capture policy, actual test provider status and receipt | Pending |
| Reporting | Customer history/receipt, Driver earnings and Fleet/Admin trip totals match | Pending |
| Failure paths | Duplicate submission, rejected documents, expired offer, offline/GPS/network recovery | Pending |

Admin/Fleet browser actions and API/provider readback complement native Maestro steps. Unit tests or API-created states must never be presented as mobile interaction results.
Use synthetically approved fixtures, not changes to real drivers. The user chose a QA copy of the owned fleet; obtain the real vehicle/driver mapping before preparing that copy, and suppress real invitations.

## Infrastructure

All three public Vercel domains returned HTTP 402 on 5 November. Vercel reports live=false for snar-landing, snar-admin and snar-fleet. This is consistent with the previously documented hosting suspension. Expo billing authorization does not authorize a Vercel subscription reactivation.
QA Admin and Fleet are served by Render at /api/qa-admin/ and /api/qa-fleet/.
The current workspace has no Maestro CLI, Android SDK/emulator or Xcode. Use an existing authorized cloud runner; no new Maestro subscription has been purchased.

