# SNAR Admin and Fleet QA continuation

Customer booking and Driver acceptance were verified on physical devices by Usman on 19 October. Completion, payment capture and receipt were not confirmed by that report.

## Confirmed deployment boundary

- Production admin.snarapp.no and fleet.snarapp.no are Vercel projects snar-admin and snar-fleet, source 6f2c2d9, using api.kjappapp.no.
- QA mobile apps use api-qa.snarapp.no. QA trips must be inspected through QA panels.
- Automatic previews from a0b1287 were READY but their frontend API configuration fell back to /__preview_api_disabled__. Their presence was not evidence of working QA panels.
- This change configures the exact QA branch at build time and routes its gateway to api-qa.snarapp.no. Other previews remain disabled; production stays on the existing production backend.
- Fleet local development no longer references an Emergent host.

## Validation and next steps

- Build both panels with VERCEL_GIT_COMMIT_REF=qa/snar-v10-phase5-staging-e2e.
- Run node scripts/panel-proxy-routing.test.mjs.
- After deploy verify the frontend API base and /api/health through both gateways before signing in.
- Then verify a synthetic fleet application and its five documents, manual approval, Fleet login, Driver invitation, assigned vehicle and scoped trip visibility.
- Production application review remains unverified: the browser showed the admin login and secure credential entry was declined. No production applications have been approved/rejected or modified.
- Existing production readiness reported document_storage_backend=mongodb. Historical Emergent documents have not been inventoried. Do not delete legacy storage or change the production API domain during this QA task.
