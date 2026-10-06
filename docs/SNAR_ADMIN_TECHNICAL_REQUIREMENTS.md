# SNAR Admin Technical Requirements

Status: normative beta requirements for Admin Control Center. Runtime items remain UNVERIFIED until tested against the deployed SNAR API and production/preview Admin build.

## Status values
- VERIFIED_SOURCE: confirmed in current source/contract only.
- PARTIAL: implementation exists but one or more required behaviours are incomplete.
- UNVERIFIED_RUNTIME: source exists but deployed/runtime evidence is still required.
- MISSING: required implementation not found.

| ID | Priority | Requirement | Current status | Test method | Acceptance criteria |
|---|---|---|---|---|---|
| ADM-DEPLOY-001 | P0 | Production Admin shall use the canonical SNAR API at `https://api.kjappapp.no/api`. | VERIFIED_SOURCE | inspect build config + browser network | No request from `admin.kjappapp.no` goes to legacy Emergent API hosts. |
| ADM-DEPLOY-002 | P0 | Every production Admin deploy shall be traceable to branch, commit SHA and deploy ID. | PARTIAL | Netlify deploy metadata | Production deploy records source commit/branch or an equivalent immutable artifact reference. |
| ADM-AUTH-001 | P0 | Only `admin`/`superadmin` sessions may access Admin routes. | VERIFIED_SOURCE | RBAC regression | Customer/Driver/Fleet roles receive 401/403 and no Admin payload. |
| ADM-AUTH-002 | P0 | Required privileged 2FA shall be enforced server-side and reflected in Admin UI. | VERIFIED_SOURCE | login + 2FA regression | Privileged account without required second factor cannot obtain unrestricted Admin session. |
| ADM-DRV-001 | P0 | Admin shall list/search/filter drivers from canonical `/admin/drivers-full` data. | VERIFIED_SOURCE | deployed API + UI | Counts, status, fleet, car and identity match backend state. |
| ADM-DRV-002 | P0 | Approve/suspend Driver shall update canonical backend state and immediately reconcile Admin UI. | PARTIAL | Admin action + `/auth/me`/Driver session check | Admin reflects server response and Driver operational eligibility changes without stale state. |
| ADM-DRV-003 | P0 | Online status shall require fresh GPS; stale/missing GPS must not show Driver as online. | VERIFIED_SOURCE | stale GPS test | Driver disappears from online/live classification after freshness window. |
| ADM-DRV-004 | P1 | Driver capabilities shall persist and refresh from canonical backend state. | VERIFIED_SOURCE | toggle + refetch | Capability remains correct after reload/new session. |
| ADM-ID-001 | P0 | Identity/selfie review shall be authenticated, private and Admin-reviewable when enabled. | VERIFIED_SOURCE | upload/review/access-control test | Only authorized Admin can review; another Driver cannot fetch selfie/private file. |
| ADM-FLT-001 | P0 | Admin shall list/create/open/suspend/reactivate fleets from canonical backend data. | VERIFIED_SOURCE | fleet regression | Changes are visible in Admin and Fleet Web from same backend state. |
| ADM-FLT-002 | P0 | Commission changes shall persist with audit history and be used by finance/settlement logic. | VERIFIED_SOURCE | change rate + finance test | New applicable rides use correct frozen commission basis; historical paid rides remain immutable. |
| ADM-FLT-003 | P0 | Driver invitations shall be bound to the intended fleet and never silently succeed when delivery/creation fails. | PARTIAL | invite success/failure regression | Fleet ID/token are correct; failure stays visible; copy-link fallback exists when mail delivery fails. |
| ADM-VEH-001 | P0 | Vehicle records and assignment shall be fleet-scoped and canonical. | VERIFIED_SOURCE | cross-fleet assignment test | A Driver cannot be assigned or select a vehicle owned by another fleet. |
| ADM-DOC-001 | P0 | Admin shall review/reject/pending compliance documents and optionally set expiry. | VERIFIED_SOURCE | document review test | Review state persists, audit is recorded, eligibility reacts when policy requires. |
| ADM-TRIP-001 | P0 | Admin trip operations shall use server-authoritative trip state and be audited. | VERIFIED_SOURCE | cancel/release/adjust/refund regression | Invalid transitions fail; successful interventions are visible after canonical refetch. |
| ADM-PAY-001 | P0 | Stripe/finance controls shall never expose server secrets to the browser. | VERIFIED_SOURCE | source/build secret scan | No secret/restricted key appears in Admin source, bundle or browser responses. |
| ADM-PAY-002 | P1 | Stripe Connect status shall distinguish not connected, onboarding/restricted and payout-ready fleets. | VERIFIED_SOURCE | Stripe test-account matrix | Admin status matches Stripe/backend snapshot. |
| ADM-PERF-001 | P0 | Admin shall not blank already-loaded screens during same-query refresh. | VERIFIED_SOURCE | network throttling + refresh | Cached rows/data remain visible while refresh runs. |
| ADM-PERF-002 | P0 | Stale/out-of-order requests shall not overwrite newer filter/search results. | VERIFIED_SOURCE | rapid filter/search test | Latest request wins; old response is ignored. |
| ADM-PERF-003 | P1 | Only Live operations may use short polling by default; normal tables should refetch on demand/focus/invalidation. | PARTIAL | browser network audit | No unnecessary recurring requests from standard tables. |
| ADM-PERF-004 | P1 | Heavy Admin backend endpoints shall avoid N+1 queries and unbounded collection scans. | UNVERIFIED_RUNTIME | Mongo/query profiling | Latency remains within agreed beta threshold at expected fleet/driver volume. |
| ADM-ERR-001 | P0 | Admin actions shall show understandable Norwegian error states and must not claim writes succeeded without server confirmation. | PARTIAL | force 401/403/409/422/429/500/offline | User sees actionable status and failed mutation is not represented as saved. |
| ADM-BRAND-001 | P1 | All user-facing Admin branding shall display SNAR; legacy internal compatibility IDs may remain. | PARTIAL | static scan + visual QA | No visible KJAPP labels remain in production Admin. |
| ADM-AUDIT-001 | P0 | Privileged mutations shall create audit entries with actor/action/entity/timestamp. | VERIFIED_SOURCE | mutation + audit query | Every required mutation is traceable in audit log. |

## P0 release gate
Admin is not beta-ready while any P0 requirement is open in runtime. Source existence alone does not prove production behaviour.

Required runtime chain for every critical mutation:

`Admin action -> canonical FastAPI response -> MongoDB canonical state -> affected Driver/Fleet/Customer surface reflects the same state`.

## Current audit notes
- The active Render/backend branch already contains the canonical production API base in `admin-web/src/api.ts`.
- The published Netlify Admin deploy inspected during this audit was a manual upload without branch/commit metadata, so deploy provenance is currently insufficient for ADM-DEPLOY-002.
- Admin data hooks have been hardened on the audit branch to preserve loaded data during same-query refresh and reject stale out-of-order responses.
- Do not deploy this audit branch until TypeScript/build/runtime checks pass and concurrent Claude work has been reconciled.
