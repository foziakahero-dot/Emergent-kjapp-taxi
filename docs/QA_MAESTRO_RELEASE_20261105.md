# SNAR QA mobile release and Maestro execution

Status: prepared, not executed. Current Render QA is c1203c73dff87910d3c6186e0bddd253e603129b.
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
- Existing customer-startup.yml remains available.
- Select only verified new QA APK build IDs. Do not reuse a production/apk-profile build in a Maestro job.
- Provide unique synthetic @example.invalid customer email and a short-lived password through protected runtime inputs. Do not commit real fleet contacts or credentials.
- Test traces can contain resolved input commands. Keep credential-entry traces private and short-lived; do not publish raw traces, QR codes, tokens, passwords or screenshots of secrets.
- These files were checked against source selectors and parsed locally. They have not run on a device.

## Whole-flow runtime matrix

| Stage | Required runtime evidence | Current state |
| --- | --- | --- |
| Fleet application | Synthetic registration, five test documents, application visible in QA Admin | Pending |
| Superadmin review | Private operator enrollment, authenticated QA Admin, actual application approval | Pending |
| Fleet isolation | QA Fleet login; separate fleet cannot see the application, vehicles or drivers | Pending |
| Driver invitation | One synthetic driver invitation, document upload, Admin approval and correct vehicle association | Pending |
| Customer registration | Run registration flow, verify exactly one new backend account and welcome status | Prepared, not run |
| Driver app | Invitation-only entry, invited login, GPS readiness and online supply | Entry flow prepared; runtime pending |
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
