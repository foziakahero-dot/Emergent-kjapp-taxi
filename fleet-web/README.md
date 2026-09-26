# KJAPP Partner · Fleet Portal

Standalone løyvehaverportal for `fleet.kjappapp.no`.

## Source of truth

- Repository: `foziakahero-dot/Emergent-kjapp-taxi`
- Workspace/root directory: `fleet-web`
- Backend: existing KJAPP FastAPI/MongoDB API
- Production API: `https://github-app-builder-28.emergent.host/api`
- Design source: Figma `KJAPP — Website & Fleet Portal`
- Production domain: `fleet.kjappapp.no`

## Access model

The portal accepts only authenticated users with role `fleet_owner`.

A løyvehaver does **not** receive this role by signing up directly. The intended onboarding flow is:

1. Applicant submits the KJAPP løyvehaver application and required documents.
2. Superadmin reviews the application in `admin.kjappapp.no`.
3. Superadmin approves or rejects it.
4. Approval creates/activates the fleet and `fleet_owner` user through the existing backend flow.
5. Only then can the user authenticate here.

Admin and superadmin remain in `admin.kjappapp.no`; customers and drivers use their separate apps.

## Commercial rule

The default onboarding commission in the current backend is **10%**. Admin can set a fleet-specific `commission_rate`; trips retain the rate captured when booked, including a 0% campaign rate. The portal reads the stored rate and does not invent or override financial data.

## Real data only

The UI never seeds demo rows. It uses:

- `/fleet/me`
- `/fleet/overview`
- `/fleet/drivers`
- `/fleet/payouts`
- `/fleet/driver-invites`
- `/fleet/export/monthly`

The existing monthly XLSX export is reused as a read model for month totals and completed-trip history, so no admin endpoint or parallel database is exposed to fleet owners.

## Vercel

Create/relink the production Vercel project to this repository with **Root Directory = `fleet-web`**. `vercel.json` proxies `/api/*` to the existing KJAPP backend and sends all other routes to the Vite SPA entrypoint.

Do not point production back to the obsolete `foziakahero-dot/Kjapptaxi` repository.
