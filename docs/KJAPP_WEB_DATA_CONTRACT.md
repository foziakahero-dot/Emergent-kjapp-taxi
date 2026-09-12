# KJAPP Web + Fleet — Data Contract and Minimal Backend Delta

Status: IMPLEMENTATION CONTRACT

Goal: connect the locked marketing/fleet web experience to the existing KJAPP backend with the smallest possible amount of backend change.

No new external integrations are introduced here.

---

# 1. Existing backend that should be reused

## Authentication

Reuse current KJAPP auth.

Required calls:

- `POST /api/auth/login`
- `GET /api/auth/me`
- current password reset flow
- existing 2FA challenge where enabled

Fleet authorization remains server-side through `require_fleet_owner` and the user’s `fleet_id`.

Client route guards are UX only.

---

# 2. Existing fleet endpoints

The current backend already provides:

- `GET /api/fleet/me`
- `GET /api/fleet/overview`
- `GET /api/fleet/drivers`
- `GET /api/fleet/payouts`
- `GET /api/fleet/export/monthly?year=YYYY&month=M`
- `GET /api/fleet/driver-invites`
- `POST /api/fleet/driver-invites`

These remain the primary data source.

## `/fleet/me`

Use for:

- company name
- organisation number
- fleet status where present
- commission rate
- basic company identity

Phase 1 Bedrift can remain read-first. Do not add a generic settings endpoint merely to make every field editable.

## `/fleet/overview`

Current response already supplies:

- `drivers_total`
- `drivers_online`
- `today.gross`
- `today.trips`
- `today.net`
- `week.gross`
- `week.trips`
- `week.net`
- `commission_pct`

Use these directly. Do not recompute commission/net values in the browser.

## `/fleet/drivers`

Current driver data includes the fleet’s own drivers and adds:

- `today_income`
- `today_trips`

Driver documents/password hashes are not to be exposed by the new UI.

Online map markers may use real:

- `online`
- `last_lat`
- `last_lng`
- `last_heading`

Only render a vehicle if valid coordinates exist.

## `/fleet/payouts`

Use for the payout history on Økonomi.

Do not create client-side payout records.

## `/fleet/export/monthly`

Existing backend already creates an `.xlsx` workbook with:

- summary
- driver breakdown
- trips

Phase 1 UI should call this endpoint directly and label the CTA generically as `Last ned månedsrapport` or specifically as Excel.

Do not advertise PDF/CSV until fleet-scoped endpoints for those formats actually exist.

## `/fleet/driver-invites`

Keep the current invite model.

POST payload already supports:

- `car`
- `plate`
- `vehicle_type`
- `note`
- `email`

The new portal should reuse it exactly instead of creating another driver onboarding workflow.

---

# 3. Fleet login

## Login success

After normal auth, resolve `/auth/me`.

Allowed:

- `fleet_owner`
- admin/superadmin only if existing policy intentionally permits support access

Wrong-role users must see a clear portal mismatch and be logged out or sent away from protected routes.

## No demo behaviour

Production marketing/fleet build must not expose seeded demo credentials or one-click demo login.

---

# 4. Oversikt data mapping

| UI | Source |
|---|---|
| Turer i dag | `/fleet/overview` → `today.trips` |
| Omsetning i dag | `/fleet/overview` → `today.gross` |
| Aktive/påloggede sjåfører | `/fleet/overview` → `drivers_online` |
| Totale sjåfører | `/fleet/overview` → `drivers_total` |
| Uke omsetning | `/fleet/overview` → `week.gross` |
| Uke turer | `/fleet/overview` → `week.trips` |
| Uke netto | `/fleet/overview` → `week.net` |
| KJAPP provisjon | derive display from backend `commission_pct` and backend-returned totals, not a hardcoded rate |
| Map vehicles | `/fleet/drivers` real coordinates |

### One missing piece: latest trips

The locked Overview includes a short latest-trips list, but there is currently no dedicated fleet-scoped trips endpoint.

Do not use `/admin/trips-full` from the fleet client.

Minimal backend work is defined in section 8 below.

---

# 5. Sjåfører data mapping

## Active drivers tab

Source: `GET /fleet/drivers`.

Columns:

- Sjåfør → `fullName`
- Bil → `car` + `plate`
- Status → `online`
- Turer i dag → `today_trips`
- Omsetning → `today_income`

Search can initially be client-side because the fleet driver list is expected to be small. No new search endpoint is required in phase 1.

## Invites tab

Source: `GET /fleet/driver-invites`.

Create: `POST /fleet/driver-invites`.

UI status should be based on real fields such as:

- `used`
- `email_sent`
- `expires_at`

Copy-link action uses the real returned invite token/link format.

---

# 6. Økonomi data mapping

## Summary

Use backend-derived overview totals for current period where possible.

Phase 1 should not invent a financial analytics engine.

For the top three cards:

- Omsetning
- KJAPP provisjon
- Netto

The simplest first implementation can use the current week from `/fleet/overview`:

- gross = `week.gross`
- net = `week.net`
- commission amount = `week.gross - week.net`

Clearly label the period as `Denne uken`.

## Payouts

Use `GET /fleet/payouts`.

## Monthly export

Use `GET /fleet/export/monthly`.

Do not add Tripletex, Fiken, PowerOffice, accounting APIs or automatic bookkeeping in phase 1.

---

# 7. Bedrift data mapping

Source: `GET /fleet/me` plus current authenticated user where needed.

Show only values that actually exist.

Recommended phase-1 sections:

- company name
- organisation number
- current fleet relationship/status if available
- commission rate
- owner/account contact from authenticated user where safe
- count of linked drivers from overview

No self-service commission edit.
No role management.
No API keys.
No billing suite.

If the current backend lacks an editable field, display it read-only and instruct the partner to contact KJAPP for changes.

---

# 8. Minimal backend delta required for locked fleet portal

Only two backend gaps should be solved for this web phase.

## 8.1 Add fleet-scoped trips endpoint

Required because the locked product has both `Turer` and `Siste turer`, while fleet owners must never call admin endpoints.

Add:

`GET /api/fleet/trips`

Auth:

`require_fleet_owner`

Scope:

1. resolve current user’s `fleet_id`
2. get driver IDs where `users.role=driver` and `users.fleet_id=<own fleet>`
3. query only trips where `driver_id` belongs to those IDs

Parameters:

- `period`: optional `today|7d|30d`, default `7d`
- `status`: optional `all|active|completed|cancelled`
- `q`: optional trip/address search
- `page`: default 1
- `page_size`: default 50, max 100

Response:

```json
{
  "items": [
    {
      "trip_id": "...",
      "created_at": "...",
      "driver_id": "...",
      "driver_name": "...",
      "pickup_address": "...",
      "dropoff_address": "...",
      "status": "completed",
      "price": 289
    }
  ],
  "page": 1,
  "page_size": 50,
  "total": 1,
  "total_pages": 1
}
```

Do not return customer phone/e-mail or internal admin fields to the fleet table unless a later business requirement explicitly needs them.

Use the same ride status model already used by the backend.

## 8.2 Simplify public løyvehaver lead intake without requiring documents

Current public application flow is:

1. `/fleet-applications/draft`
2. upload five required document types
3. `/fleet-applications/submit`
4. status becomes `pending`
5. superadmin can review it

The locked marketing page intentionally does **not** require documents in the first form.

Do not force the old five-document step back into the public marketing page.

Smallest coherent backend change:

### Extend the existing application record rather than create a second CRM/lead database.

Add optional fields to `FleetApplicationDraftRequest`:

- `license_count`
- `vehicle_count`
- `area`
- `source` (server/default should be controlled, e.g. `marketing`)

Add one explicit lightweight submit action for the existing record, for example:

`POST /api/fleet-applications/interest`

Payload:

```json
{
  "upload_token": "..."
}
```

Behaviour:

- current `draft` → `interest`
- set `submitted_at`
- notify superadmin
- no documents required
- record stays in the **same** `fleet_applications` collection

Superadmin list should include `interest` as an initial-contact state.

After KJAPP has spoken with the licence holder, the existing document/onboarding process can continue on the same application record.

This is not a second lead system and does not add a third-party integration.

Alternative implementation is acceptable if it keeps the same collection and same admin review surface. Do not create HubSpot/CRM/Zapier just to capture the form.

---

# 9. Public application field mapping

Locked form:

| Public field | Backend field |
|---|---|
| Navn | `contact_name` |
| Bedriftsnavn | `company_name` |
| Organisasjonsnummer | `org_number` |
| Telefon | `contact_phone` |
| E-post | `contact_email` |
| Antall løyver | `license_count` (minimal extension) |
| Antall biler | `vehicle_count` (minimal extension) |
| Område/by | `area` (minimal extension) |

Do not collect bank account on the first public form.
Do not collect five compliance documents on the first public form.

---

# 10. Polling / freshness

Fleet portal does not need complex realtime infrastructure in phase 1.

Use simple polling only where operationally useful:

- `/fleet/drivers`: roughly every 10–15 seconds while Overview is visible
- `/fleet/overview`: roughly every 30 seconds while visible
- `/fleet/trips`: load on page/filter change; optional slow refresh if page remains open
- finance/company: on demand

Pause/slow polling when page is not visible where practical.

No WebSocket/SSE project is required for this phase.

---

# 11. Error/data integrity rules

- never substitute mock numbers after an API error
- preserve last known data only if UI clearly indicates refresh failed
- otherwise show error state
- map never invents coordinates
- zero is real and must be rendered as zero
- unknown company/compliance values show `Ikke tilgjengelig`, not fabricated defaults
- client must never be trusted for fleet scoping

---

# 12. Security acceptance

Before production:

- customer token → `/fleet/*` returns 403
- driver token → `/fleet/*` returns 403
- fleet A cannot receive fleet B drivers/trips/invites/payouts
- unauthenticated portal route redirects to `/login`
- no customer PII leaks into fleet trip list beyond the exact locked operational need
- application intake is rate-limited/validated appropriately
- admin domain remains separate and unchanged

---

# 13. Minimalism decision

For Phase 1, explicitly do not add:

- CRM
- accounting integration
- live chat platform
- support suite
- web booking
- customer web accounts
- business intelligence stack
- third-party workflow automation
- fleet mobile app
- separate vehicle-management module

The existing KJAPP backend plus the two small backend deltas above are enough to ship the locked web/fleet scope.