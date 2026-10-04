# KJAPP backend ownership migration plan

Status: **planned after Oslo beta stabilization**.  
Current live backend remains the Emergent-hosted FastAPI/Mongo deployment until the beta branch is validated and merged.

## Goal

Move KJAPP to infrastructure controlled by NexoraHub/KJAPP without changing the public API contract used by:

- Customer app
- Driver app
- admin.kjappapp.no
- fleet.kjappapp.no
- kjappapp.no

The permanent client-facing API hostname should be:

`https://api.kjappapp.no`

Clients should not permanently depend on an Emergent-specific hostname. During migration, `api.kjappapp.no` can initially point/proxy to the existing Emergent backend, then later be repointed to the new backend without requiring a new mobile app release.

## Do not migrate before beta gate

Before infrastructure migration:

1. Finish `beta/oslo-production-ready`.
2. Run Customer + Driver native QA.
3. Run the deterministic Oslo ride E2E.
4. Validate Stripe, push, GPS and recovery.
5. Merge reviewed beta changes to `main`.
6. Deploy that known-good version to the existing environment.
7. Create database backup/export.

This keeps product bugs separate from infrastructure migration bugs.

## Current Emergent-specific dependencies

The core ride platform is already portable FastAPI + MongoDB. Remaining platform coupling is limited and identifiable:

### Object storage
`backend/server.py` currently uses the Emergent object-store integration for uploaded driver/fleet documents.

Migration target:
- S3-compatible storage (AWS S3, Cloudflare R2 or equivalent)
- private bucket
- server-side authenticated reads
- preserve existing document metadata and paths

### AI
AI translation / speech endpoints currently use `emergentintegrations` with `EMERGENT_LLM_KEY`.

Migration target:
- provider abstraction
- direct OpenAI API or another selected provider
- AI failure must never block ride booking, dispatch, payment or driver GPS

### Google authentication
Customer Google Sign-In still has a legacy Emergent-managed session path (`auth.emergentagent.com` / Emergent session exchange). The backend already contains a KJAPP-owned Google Authorization Code + PKCE flow (`/api/auth/google/config` and `/api/auth/google/code`), but the current Customer client still uses the legacy session path.

Migration target:
- configure KJAPP-owned `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- switch Customer Google Sign-In to the existing KJAPP-owned PKCE endpoints
- verify Android/iOS redirect URIs and account linking
- keep legal-consent gating for newly linked OAuth accounts
- retire the legacy Emergent Google session exchange only after native Google login is physically verified

Do not combine this auth cutover with the first backend-host migration window unless it has already passed its own device test.

### Database
Current application contract is MongoDB through Motor.

Recommended first migration:
- keep MongoDB to minimize risk
- migrate to a KJAPP-controlled MongoDB Atlas/project
- do **not** combine the infrastructure move with a MongoDB → PostgreSQL rewrite

A database-engine rewrite can be a later project if there is a concrete reason.

## Target topology

```
Customer iOS/Android ─┐
Driver iOS/Android ───┤
Admin web ────────────┼── https://api.kjappapp.no
Fleet web ────────────┤               │
Marketing web ────────┘               ▼
                               KJAPP FastAPI
                                  │   │
                                  │   ├── Stripe
                                  │   ├── Expo Push/APNs/FCM
                                  │   ├── SendGrid
                                  │   └── AI provider
                                  ▼
                          KJAPP-controlled MongoDB
                                  │
                                  ▼
                         KJAPP-controlled object store
```

## Migration phases

### Phase 1 — stable API hostname
- Configure `api.kjappapp.no`.
- Initially route it to the known-good current backend.
- Verify `/api/health`, auth, booking and admin endpoints.
- Change production mobile/web build environments to `https://api.kjappapp.no`.
- Only after this is verified should store builds be treated as final production candidates.

### Phase 2 — portable backend runtime
- Containerize `backend/server.py`.
- Separate runtime-only dependencies from development/test packages.
- Add explicit health/readiness checks.
- Document every required environment variable.
- Run the exact same test suite against the container.

### Phase 3 — storage decoupling
- Introduce a storage provider interface.
- Copy existing documents to KJAPP-controlled object storage.
- Verify document upload/read/admin review.
- Keep old storage read-only during rollback window.

### Phase 4 — Auth + AI decoupling
- Move Customer Google Sign-In from the legacy Emergent session path to the existing KJAPP-owned Google PKCE flow.
- Verify Google account linking on physical iOS/Android builds before removing the legacy endpoint.
- Replace Emergent-specific AI calls behind a provider interface.
- Preserve current API responses for mobile clients.
- Keep AI non-critical to ride operations.

### Phase 5 — Mongo migration
- Freeze/coordinate writes for final cutover or use a replication/sync approach.
- Export and restore collections plus indexes.
- Validate counts for users, trips, fleets, payment transactions, documents and audit logs.
- Run the full E2E suite against the new database.

### Phase 6 — shadow verification
Before DNS cutover:
- deploy the new backend on a temporary private hostname
- run smoke + E2E tests
- compare critical API results against the current backend where safe
- verify Stripe webhook signature handling
- verify Expo push
- verify admin/fleet RBAC

### Phase 7 — cutover
- lower DNS TTL in advance
- point `api.kjappapp.no` to the new backend
- run immediate production smoke checks
- monitor errors, latency, dispatch and payment webhooks
- keep the previous backend available for rollback during the agreed rollback window

## Rollback rule

Migration is reversible until the old environment is intentionally retired.

Rollback:
1. restore `api.kjappapp.no` routing to the prior backend
2. stop writes to the failed target
3. reconcile any writes created during the migration window
4. investigate before retrying

## Important release decision

**Do not ship long-lived App Store / Play Store builds hard-coded to the Emergent hostname if `api.kjappapp.no` can be established first.**

A KJAPP-owned API hostname lets the backend provider change later without forcing every customer and driver to install a new app version.
