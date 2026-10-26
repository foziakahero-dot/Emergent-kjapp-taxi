# Controlled SNAR QA — Phase 0 baseline

## Source and isolation

Remote fetched before edits: `foziakahero-dot/Emergent-kjapp-taxi`, branch `qa/snar-v10-phase5-staging-e2e`, SHA `e9f3069dce6816c58362431b733caad128069eb0`.
The original checkout remains at `f1194ca` with uncommitted Customer changes, a modified marketing image and a deleted account-triage document. Those changes were preserved. This audit uses a separate detached worktree from the remote SHA.

Recent remote commits: `e9f3069` QA panel routing; `a0b1287` native payment-screen guard/map distance type; `4bcd1d5` map/card work; `3a7e1de` REST recovery and pickup ETA; `15ae0ed` Google Pay availability.

| Component | Path | QA configuration | Production configuration |
| --- | --- | --- | --- |
| Customer | `frontend/` | `eas.json` profiles `qa`, `testflight-qa`: `https://api-qa.snarapp.no` | `https://api.kjappapp.no` |
| Driver | `driver-app/` | same QA profiles and API | `https://api.kjappapp.no` |
| Admin | `admin-web/` | named QA branch: same-origin `/api`, QA gateway | `admin.snarapp.no`, Vercel `snar-admin`, production API |
| Fleet | `fleet-web/` | named QA branch: same-origin `/api`, QA gateway | `fleet.snarapp.no`, Vercel `snar-fleet`, production API |
| Backend | `backend/` | Render `snar-api-qa`, `srv-db61otlckfvc73bqp480` | Render `kjapp-beta-api`, `srv-datbvsid0e5s73bg0s30` |

Render workspace: My Workspace `tea-dassqnrbc2fs73a770i0`. QA compute is paid `0.5c-512mb`, one instance, Frankfurt; build plan `starter`. Latest live QA deploy is `3a7e1de`, not the latest branch head. Auto-deploy is disabled. Production backend deploy is `9ee2e2b`; production Admin/Fleet still use `main` at `6f2c2d9`.

Live checks: QA and current production `/api/ready` returned 200/ready. Both report `document_storage_backend=mongodb`, `email_configured=false` (the SendGrid-backed fleet flow; not proof of Resend status). `https://api.snarapp.no/api/health` returned 503. No production URL was changed.

## Baseline checks

- Customer and Driver `tsc --noEmit`: passed.
- Admin Vite build and Fleet TypeScript/Vite build: passed. Admin emits a bundle-size warning above 500 kB.
- Backend `compileall`: passed.
- Payment screen native/web/SSR import regression: passed.
- Panel QA/production routing, private binary document and multipart forwarding regression: passed.
- Existing V10 screen behavior checkpoint script: passed. This is a mocked component harness, not physical-device verification.
- Focused backend suite: initially 88 passed / 1 failed. Failure was the isolated manual-fleet test namespace missing `asyncio`; production already imports it. Fixed that test fixture without changing production handlers, then reran the suite.
- Customer Expo dependency check: passed. Driver online check timed out at the HTTP proxy; offline fallback says dependencies are current but explicitly warns that offline validation is unreliable. Online Driver dependency verification remains open.
- Mobile package manifests/locks did not change between the original checkout and audited remote head. Existing installed dependencies were reused via local, uncommitted links.

## Existing implementation inspected

- Native Customer map: `MapboxMap.native.tsx`; raster/web fallbacks also exist. Vehicles currently use `V10VehicleMarker.tsx` through `MapMarkers.tsx`; the Customer position uses the separate `PositionDot`.
- Live supply: authenticated Driver location API, `backend/live_cars.py`, `frontend/src/lib/liveCars.ts` and `useAvailableCars.ts`. Existing constants are 5 km, 2-second GPS freshness and 0.5-second backend reconciliation. Eligibility and device behavior still require phases 4–5; code presence is not live proof.
- Category graphics are duplicated between `VehicleAsset.tsx` (legacy 3D art) and `V10CategoryImage.tsx` (old photographs/SUV image). Backend IDs are `ai-first`, `enkelt`, `trygg`, `premium`, `suv`. `trygg` is 7-seat XL and must not silently become SUV. `suv` is currently 5 seats.
- Dispatch uses `ride_search.py`: 30-second interval, two attempts and 60-second search limit. Full sequential-offer behavior remains to be verified in phase 6.
- Payment uses native Stripe PaymentSheet, server reservation before dispatch and server capture/reconciliation in `ride_reservations.py`. Full Stripe QA capture/receipt/earnings validation remains open.
- The user verified Customer booking → Driver receipt/acceptance on physical devices. Completion, automatic capture and earnings have not been certified by that observation.
- Fleet public intake was exercised earlier against QA: synthetic company `SNAR SYNTHETIC QA 20261019T204840Z`, five PDFs uploaded, pending status, repeated submission refused and anonymous file access refused. Admin approval and Fleet browser login remain unverified.

## Attached visual sources

| File | Interpretation after visual inspection | Size / format | SHA-256 |
| --- | --- | --- | --- |
| `3417(1).png` | white hatchback → Economy | 1254×1254 RGBA, alpha 0–255 | `920e52cba67dfe718a90ced86c2d1e18431be625603732895095ab0792457595` |
| `3418(1).png` | white sedan → Premium | 1254×1254 RGBA, alpha 0–255 | `a6679ccb90e44d9087ba8bafb1bc2862a8702bd9162398ce2cbcc16e5f9eae1b` |
| `3419(1).png` | white SUV → SUV | 1254×1254 RGBA, alpha 0–255 | `42d4be84b4f98b956184c7a4fbf9119ed830f33eb0339ea41a7802160bfaf317` |

Only these three assets were attached and available in this worktree's upload source. The fourth live-marker PNG with red status indicator is missing. Do not claim it was imported or generate a substitute without resolving the source.

## Open gates

1. Missing fourth live-marker asset; phase 1 cannot be certified complete for all four images.
2. QA Admin credentials are unknown. The user's earlier request to create a QA admin in Render was interrupted before any successful mutation was returned; no new admin creation is confirmed. Keep authentication and approval controls intact.
3. Fleet application/approval/invitation email delivery is not configured in QA. Local mock email tests do not establish delivery.
4. Online Driver dependency check and native visual/device testing are pending.
5. Phases 1–12 require separate evidence and checkpoints. No APK, IPA, EAS build, TestFlight submission or production rollout is authorized by this baseline.

Current recommendation: **NOT READY FOR BUILD**. This is the phase 0 baseline, not the final phase 12 report.
