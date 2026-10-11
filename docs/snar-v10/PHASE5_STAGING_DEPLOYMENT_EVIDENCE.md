# Phase 5 Staging Deployment Evidence

**Status: BLOCKED — no QA backend service or QA database was available to deploy to.**

| Evidence item | Result |
|---|---|
| Target API hostname | `https://api-qa.snarapp.no` |
| DNS | **BLOCKED** — name did not resolve during this run. |
| QA service identity / provider URL | **NOT PROVISIONED** — repository contains no authoritative active-host configuration; Render CLI/service credentials are unavailable. |
| QA database | **NOT PROVISIONED** — no separate Mongo URI or database credentials available. |
| Branch requested for deployment | `qa/snar-v10-phase5-staging-e2e` |
| Deployment | **NOT RUN** — no service was created or modified. |
| `/api/health` | **NOT RUN** — no resolved QA endpoint. Expected route checks Mongo liveness. |
| `/api/ready` | **NOT RUN** — no resolved QA endpoint. Requires isolated DB, QA mode, QA-only Stripe test configuration, admin/JWT setup, service-area config and isolated web origin. |
| Database seed | **NOT RUN** — without the QA database this would be unsafe. No data was inserted anywhere. |
| Production | **NOT contacted or modified** — no production DNS/API/database request, migration, deployment, or setting change. |

The API router exposes `/api/health` and `/api/ready`; the existing release smoke client calls `/api/ready`. The repo has a Render-oriented requirements file, but no Render blueprint or service ID that authorizes a safe new deployment. No alternate provider hostname was available.

To proceed, provision a distinct QA backend service and `snar_qa` Mongo database using the service's secure variable store, then create only the `api-qa.snarapp.no` DNS record. Keep `APP_ENV=qa`, `ENABLE_DEMO_DATA=false`, and `KJAPP_AUTO_CHARGE_ENABLED=false`. The startup guard refuses obvious production Mongo/Stripe settings; the readiness route is intended to remain 503 until QA-only payment and web-origin configuration is complete.
