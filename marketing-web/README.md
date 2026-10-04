# SNAR Marketing Web

Public website for `kjappapp.no`.

## Routes

- `/` — customer-facing SNAR landing page
- `/loyvehaver` — løyvehaver/partner information
- `/loyvehaver/soknad` — controlled partner application + document upload

## Architecture

The website is intentionally separate from the Customer/Driver mobile apps and from the admin/fleet portals.

- Public site: `kjappapp.no`
- Fleet owner portal: `fleet.kjappapp.no`
- SNAR admin: `admin.kjappapp.no`
- API: `https://api.kjappapp.no/api`

The application flow reuses the existing production API:

1. `POST /api/fleet-applications/draft`
2. `POST /api/upload/public`
3. `POST /api/fleet-applications/submit`
4. Superadmin reviews the application in `admin.kjappapp.no`
5. Only after approval is the `fleet_owner` account/fleet created and Fleet access enabled.

## Commission

Public copy is locked to **10% SNAR serviceavgift** for approved fleet owners.

## Local build

```bash
npm install
npm run typecheck
npm run build
```

## Netlify

Production site: `kjappapp-no` on Netlify.

- Root directory: `marketing-web`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Production domain: `kjappapp.no`

Do not publish preview work over the production deploy before review.

Optional environment override:

`VITE_API_BASE_URL=https://api.kjappapp.no/api`

Production backend CORS already includes `https://kjappapp.no`.
