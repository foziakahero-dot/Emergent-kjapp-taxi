# KJAPP Admin API Contract

Stable API contract for the external **KJAPP Admin web app** (`admin.kjappap.no`) consuming the existing FastAPI + MongoDB backend. No new DB, no Supabase, no parallel admin logic — the admin web app calls the same `/api/*` endpoints the customer/driver apps use.

---

## 1. Production API base URL
- **Base URL:** `https://<api-host>/api`  (all routes are prefixed with `/api`; ingress routes `/api/*` → backend :8001)
- The admin frontend calls e.g. `GET {BASE}/admin/overview`.
- **OpenAPI schema:** `GET {BASE_HOST}/openapi.json` · Swagger UI `GET {BASE_HOST}/docs` (FastAPI auto-generated — use for typed client generation).

## 2. Authentication
- Same auth as customer/driver apps: **JWT Bearer** (HS256).
- Login: `POST /api/auth/login` `{email, password}` → `{token, user:{id,email,fullName,phone,role,driver_id}}`.
- Send on every admin request: `Authorization: Bearer <token>`. (Cookies are also set but cross-origin uses the **header**, not cookies.)
- Current identity: `GET /api/auth/me` → full user doc (role included).
- Brute-force protection on login (429 after repeated failures). 2FA: if `twofa_required` is returned, that account must use the web portal 2FA flow.
- **Admin bootstrap:** superadmin is seeded from env `ADMIN_EMAIL` / `ADMIN_PASSWORD`. In production `ADMIN_PASSWORD` must be ≥12 chars and non-default or startup aborts.

## 3. Roles / RBAC (server-enforced — authority)
- Roles: `superadmin`, `admin`, `fleet_owner`, `driver`, `user`.
- Guards: `require_admin` (admin|superadmin), `require_superadmin` (superadmin only), `require_fleet_owner` (fleet_owner|admin|superadmin).
- Errors: **401** missing/invalid/expired token · **403** authenticated but wrong role · **404/400** not found / bad id · **429** rate-limited.
- UI visibility is never the authority — all sensitive reads/writes are guarded server-side.

## 4. CORS
- Middleware: `allow_credentials=False`, `allow_methods=["*"]`, `allow_headers=["*"]` (Bearer header auth, no wildcard+credentials).
- Production origins (strict whitelist): `https://kjappapp.no`, **`https://admin.kjappapp.no` (CONFIRMED admin domain)**, `https://fleet.kjappapp.no`.
- Dev also allows localhost 3000/5173/4173/3001.

## 5. Pagination (standardized this round)
List endpoints accept `?page=<1..>&page_size=<1..200>` and return:
```
{ "items": [...], "page": 1, "page_size": 50, "total": 123, "total_pages": 3, "<legacy_key>": [...] }
```
`<legacy_key>` (e.g. `trips`, `drivers`, `users`, `vehicles`, `documents`, `events`, `tickets`) mirrors `items` for backward compatibility. **Prefer `items` + `total`/`total_pages`.**

## 6. Endpoint table (all under `/api`, all `require_admin` unless noted)

| Endpoint | Method | Role | Purpose | Query params | Response (top-level) | Paginated |
|---|---|---|---|---|---|---|
| `/admin/overview` | GET | admin | Dashboard KPIs | — | `{fleets,drivers,trips,finance,support,as_of}` | no |
| `/admin/live` | GET | admin | Live ops board | — | `{drivers[],trips[],as_of}` | no (poll) |
| `/admin/analytics` | GET | admin | Charts/metrics | `days`(1–90) | `{days,metrics,series[],hours[24],top_drivers[]}` | no |
| `/admin/finance` | GET | admin | Finance totals + series + per-fleet | `days`(1–180) | `{days,totals,series[],fleets[],as_of}` | no |
| `/admin/finance/export` | GET | admin | CSV export | `days` | `text/csv` (;-delimited, BOM) | file |
| `/admin/trips-full` | GET | admin | Rides table | `status`(active\|completed\|cancelled), `q`, `date_from`,`date_to`(YYYY-MM-DD), `payment_status`, `page`,`page_size` | `{items/trips,...page}` | **yes** |
| `/admin/trips/{trip_id}/timeline` | GET | admin | Ride lifecycle events | — | `{trip_id,status,events[]}` | no |
| `/admin/trips` | GET | admin | Raw trips (legacy) | `limit` | `{trips[]}` | no |
| `/admin/drivers-full` | GET | admin | Drivers table | `status`(approved\|pending\|online), `q`, `fleet_id`, `page`,`page_size` | `{items/drivers,...page}` | **yes** |
| `/admin/drivers` | GET | admin | Raw drivers (legacy) | — | `{drivers[]}` | no |
| `/admin/pending-drivers` | GET | admin | Drivers awaiting approval | — | `{drivers[]}` | no |
| `/admin/drivers/{user_id}/approve` | POST | admin | Approve/unapprove (audited) | body `{approved}` | `{ok}` | — |
| `/admin/drivers/{user_id}/set-status` | POST | admin | Approve/suspend (audited) | body `{approved}` | `{ok}` | — |
| `/admin/driver-invites` | GET/POST | admin | List/create driver invites | — | `{invites[]}` / invite doc | no |
| `/admin/users` | GET | admin | Customers/all users | `q`, `status`(active\|disabled), `page`,`page_size` | `{items/users,...page}` | **yes** |
| `/admin/vehicles` | GET | admin | Vehicles table | `q`, `vehicle_type`, `page`,`page_size` | `{items/vehicles,...page}` | **yes** |
| `/admin/documents` | GET | admin | Compliance docs + expiry status | `scope`, `q`, `page`,`page_size` | `{items/documents,...page,scopes[],summary{VALID,EXPIRING,EXPIRED,PENDING,REJECTED}}` (each doc has `review_status`,`expiry`,`compliance`) | **yes** |
| `/admin/documents/{file_id}/review` | POST | admin | Approve/reject/set expiry (audited) | body `{status(valid\|rejected\|pending),expiry?,reason?}` | `{ok,review_status}` | — |
| `/admin/fleets` | GET/POST | admin | List/create fleet (create audited) | — | `{fleets[]}` / fleet doc | no |
| `/admin/fleets-full` | GET | admin | Fleets table | `status`, `q` | `{fleets[]}` | no (≤300) |
| `/admin/fleets/{fleet_id}` | GET | admin | Fleet detail | — | `{fleet,drivers[],commission_history[],audit[],payouts[]}` | no |
| `/admin/fleets/{fleet_id}/suspend` | POST | admin | Suspend fleet (audited) | body `{reason?}` | `{ok}` | — |
| `/admin/fleets/{fleet_id}/reactivate` | POST | admin | Reactivate (audited) | — | `{ok}` | — |
| `/admin/fleets/{fleet_id}/commission` | POST | admin | Set commission (audited, versioned) | body `{commission_rate,reason?}` | `{ok}` | — |
| `/admin/fleets/attach-driver` | POST | admin | Assign driver→fleet (audited) | body `{fleet_id,driver_user_id}` | `{ok}` | — |
| `/admin/support/tickets` | GET/POST | admin | Support tickets | GET: `status`,`category`,`page`,`page_size` | `{items/tickets,...page}` / ticket | **yes** |
| `/admin/support/tickets/{id}` | PATCH | admin | Update status/priority/note (status audited) | body `{status?,priority?,note?}` | `{ok}` | — |
| `/admin/settings` | GET | admin | Platform settings | — | `{default_commission,ride_classes,features,updated_at}` | no |
| `/admin/settings` | PATCH | **superadmin** | Update settings (audited) | body `{default_commission?,ride_classes?,features?}` | `{ok}` | — |
| `/admin/audit-log` | GET | admin | Audit events | `entity_type`, `page`,`page_size` | `{items/events,...page}` | **yes** |
| `/admin/search` | GET | admin | Global search (NEW) | `q` (≥2 chars) | `{query,trips[],drivers[],customers[],fleets[]}` | no (≤10/group) |
| `/admin/refunds` | GET | admin | List refunds | `status`, `page`,`page_size` | `{items/refunds,...page}` | **yes** |
| `/admin/refunds` | POST | admin | Create refund (idempotent, audited, Stripe if charge exists) | body `{trip_id,amount?,reason}` | refund doc | — |
| `/admin/transactions` | GET | admin | Ledger derived from trips/refunds/payouts | `type`(FARE\|REFUND\|PAYOUT), `date_from`,`date_to`, `fleet_id`, `page`,`page_size` | `{items/transactions,...page}` | **yes** |
| `/admin/bonus-campaigns` | GET/POST/PATCH/DELETE | admin | Driver bonus campaigns | — | campaign docs | no |
| `/admin/bonus-payouts` | GET | admin | Bonus payouts | — | `{payouts[],total_kr}` | no |
| `/superadmin/fleet-applications` | GET | **superadmin** | Løyvehaver applications | `status?` | `{applications[]}` | no |
| `/superadmin/fleet-applications/{id}` | GET | superadmin | Application detail | — | application doc | no |
| `/superadmin/fleet-applications/{id}/approve` | POST | superadmin | Approve application | body | `{ok}` | — |
| `/superadmin/fleet-applications/{id}/reject` | POST | superadmin | Reject application | body | `{ok}` | — |

Fleet-owner–scoped (role `fleet_owner`, self fleet only): `/fleet/me`, `/fleet/overview`, `/fleet/drivers`, `/fleet/payouts`, `/fleet/export/monthly`, `/fleet/driver-invites`.

## 7. Ride status enum (single source of truth — same record for customer/driver/admin)
`searching` → `booking` → `driver_on_way` → `at_pickup` → `in_trip` → `arrived` → (`completed`|`rated`); cancellations: `cancelled` (by customer/system), `cancelled_by_driver`.
- **Active** = `searching,booking,driver_on_way,at_pickup,in_trip`.
- **Completed/earning** = `arrived,completed,rated`.
Do **not** define a second admin status model. Timeline timestamps: `created_at`, `driver_route_started_at`, `at_pickup_at`, `trip_started_at`, `arrived_at`, `rated_at`, `cancelled_at`.

## 8. Driver online-state source of truth
`users` doc fields on driver: `online` (bool), `last_lat/last_lng/last_heading`, `last_location_at`, `online_at`. Set by driver app via `POST /api/driver/online` and `POST /api/driver/location`. Online duration is derived from `driver_sessions`. Admin markers: derive AVAILABLE/ON_TRIP/OFFLINE from `online` + presence of an active trip in `/admin/live`.

## 9. Finance source of truth (backend computes; admin must NOT recompute)
- **GMV**: sum of `trips.price` for finished trips.
- **KJAPP commission/revenue**: `price * platform_commission` (platform_settings.default_commission, default 0.10).
- **Driver earnings**: `price * (1 - commission)`.
- **Fleet commission**: per-fleet `fleets.commission_rate` (versioned in `commission_rules`).
- Tips/refunds/failed/authorized/captured: see Blockers — no dedicated transactions ledger endpoint yet.
Collections: `trips`, `fleets`, `commission_rules`, `fleet_payouts`, `driver_payouts`, `bonus_payouts`, `payment_transactions`, `payment_methods`.

## 10. Fleet / licence-holder relationship model
- `fleets` = licence holder/fleet (this backend treats them as one). Fields: `name, org_number, owner_user_id, commission_rate, status(active|suspended), created_at`.
- Driver→fleet link: `users.fleet_id` (string = fleet `_id`).
- Fleet owner user: `users.role="fleet_owner"`, `users.fleet_id` set.
- Applications intake: `fleet_applications` (public submit → superadmin review).

## 11. Realtime strategy for Live Ops
- No WebSocket/SSE. `/admin/live` and `/admin/overview` are **read snapshots** with an `as_of` timestamp.
- **Recommended polling:** `/admin/live` every **5s**, `/admin/overview` every **30s**, tables on demand. Use `as_of` to show freshness. Do not fake realtime.

## 12. Known missing endpoints / backend blockers
- **Payouts management:** fleet/driver payouts are readable; no admin-wide payout *run/mark-paid* endpoint yet.
- **Admin user management:** create/invite/disable admin + role-change endpoints not present (superadmin is env-seeded via `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
- **Service areas / pricing versioning UI:** pricing lives in `platform_settings` (ride_classes multipliers + default_commission), commission changes are versioned in `commission_rules`; there is no polygon service-area model.
- **Manual ride intervention:** admin cancel/release-stuck-ride endpoint not present.
- **Vipps:** not configured (`features.vipps=false`). Stripe keys present in env (test mode); per-trip charges are not currently captured, so refunds default to audited back-office records (`provider:"manual"`) unless a `stripe_payment_intent`/`charge_id` is stored on the trip.
- **Hostname:** CONFIRMED `admin.kjappapp.no` (double p). CORS locked to it. Frontend deploy/DNS/SSL/Vercel happens **outside this backend workspace** — not deployed/verified here.

## 13. Changes made (backend hardening)
Round 1:
- Standardized pagination (`items/page/page_size/total/total_pages`) + `page`/`page_size` on: `trips-full`, `drivers-full`, `users`, `vehicles`, `documents`, `audit-log`, `support/tickets`.
- New filters: trips-full `date_from`/`date_to`/`payment_status`; drivers-full `fleet_id`; vehicles `vehicle_type`; support `category`; users `q`/`status`.
- New `GET /admin/search` global search (RBAC admin+).
- Audit added: `driver.approve`/`driver.suspend`, `driver.fleet_assign`, `fleet.create`.
- CORS + admin dev origins.

Round 2 (next action items):
- **Refunds:** `POST /admin/refunds` (idempotent — tracks `trips.refunded_total`/`refund_status`, prevents double/over-refund, attempts Stripe if a charge/intent is stored, else audited `manual` record) + `GET /admin/refunds`. Audit `refund.create`. New collection `refunds`.
- **Transactions ledger:** `GET /admin/transactions` — unified FARE/REFUND/PAYOUT rows derived from real `trips` + `refunds` + `fleet_payouts`/`bonus_payouts`, with `type`/date/fleet filters + pagination (default last 30 days).
- **Document compliance:** `GET /admin/documents` now returns per-doc `review_status`/`expiry`/`compliance` (VALID/EXPIRING(≤30d)/EXPIRED/PENDING/REJECTED) + a `summary` count object; new `POST /admin/documents/{file_id}/review` (audit `document.review`).
- **CORS locked** to confirmed `admin.kjappapp.no`.
