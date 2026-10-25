# KJAPP agent instructions

These instructions apply to all coding/review agents working in this repository during the mobile pixel-perfect pass.

## Current source of truth
- The already-approved KJAPP mobile design in Emergent is the visual source of truth.
- This is not a redesign task.
- Do not make stylistic substitutions or generic UI simplifications.
- Do not claim pixel-perfect unless the target screen has been visually compared against the approved Emergent reference.

## Mobile apps
- Customer: `frontend/`
- Driver: `driver-app/`
- Customer package/bundle id: `no.kjapp.app`
- Driver package/bundle id: `no.kjapp.driver`

## Backend contract
- FastAPI + MongoDB backend stays unchanged unless fixing a verified backend bug.
- Production backend: `https://github-app-builder-28.emergent.host`
- API base: `/api`
- Do not migrate to Supabase.
- Do not add fake/demo data.

## Preserve production fixes
Do not regress commit `968df84b6291a8acaca8ad3952d4bfecbedb5ead`:
- labeled interactive maps
- real location marker
- pan/pinch/zoom/recenter
- map controls accessible above sheets
- customer account deletion from Profile
- same interactive map behavior in Driver

## Work method
1. Work screen-by-screen, not by broad redesign.
2. Inspect the target Emergent reference first.
3. Preserve API/auth/business logic.
4. Match layout, typography, spacing, dimensions, radii, colors, opacity, icons and states exactly.
5. Use real loading/empty/error states.
6. Report exact files changed and any unresolved visual mismatch.
7. Do not merge this branch into `main` until mobile visual QA is complete.

See `docs/EMERGENT_PIXEL_PERFECT_SPEC.md` for the full screen checklist and acceptance contract.
