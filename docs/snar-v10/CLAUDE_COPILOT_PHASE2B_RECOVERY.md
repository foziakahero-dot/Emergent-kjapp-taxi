# Claude / Copilot Task — Finish SNAR Phase 2B Recovery

You are working in `foziakahero-dot/Emergent-kjapp-taxi` on branch:

`recovery/snar-mobile-v10-phase2b`

## Goal

Finish recovery of the lost Work baseline `integration/snar-mobile-v10` / `a43bdc1bb783e0d1bb5ed28e4131d8137ca8d25a` and make the critical hash verifier pass.

Do not start the new Figma/SNAR10 visual migration yet.

## Hard prohibitions

Do not:

- redesign any screen
- merge to `main`
- deploy any web/backend service
- build APK/IPA or submit TestFlight
- run EAS Update / OTA
- mutate a real database
- run real Stripe/provider transactions
- rotate or print secrets
- replace locked Customer/Driver/backend business logic with older versions
- use Supabase
- remove a test or weaken an assertion to make the suite pass

## First commands

```powershell
git fetch origin
git switch recovery/snar-mobile-v10-phase2b
git pull --ff-only origin recovery/snar-mobile-v10-phase2b
git status
python scripts/verify_phase2b_recovery.py
```

Read before editing:

- `docs/snar-v10/PHASE2B_RECOVERY_STATUS.md`
- `scripts/recover_phase2b_server.py`
- `scripts/verify_phase2b_recovery.py`

## Backend server

Run:

```powershell
python scripts/recover_phase2b_server.py
```

The server recovery is accepted **only** if the script reports blob:

`b62557eef59b9b4e6f7a52a5ab7b528626bf350c`

The source before recovery must be locked Backend blob:

`92c0a76e2cea2c46f096ea4478c0c1b89a3c4fea`

Preserve the Backend-head `offer_trip_to_next_driver` implementation. Do not replay the older dispatch function wholesale.

## Remaining reconciled tests/config

Use the target hashes printed by `scripts/verify_phase2b_recovery.py` as immutable acceptance criteria.

Reconciliation intent:

1. `test_beta_trip_integrity_contract.py`
   - preserve ownership/role/fail-closed earnings assertions
   - canonical vehicle access uses `vehicle_access_query`
   - cover assigned, selected and fleet-wide access within own active fleet

2. `test_beta_trip_lifecycle_contract.py`
   - booking begins `payment_authorizing` / `authorizing`
   - only after successful authorization can it become reserved/searching
   - preserve ownership, unpaid-completion and receipt assertions

3. `test_security_regressions_unit.py`
   - retain original security guards
   - fake Mongo behavior must match current CAS/search-round signatures
   - add two Driver accept race tests
   - add parallel one-use password reset: one succeeds, one rejects, only one password/session-revocation write wins

4. `test_receipt_identity_recheck_contract.py`
   - execute `_commission_for_trip` with `ensure_receipt_snapshot`
   - explicit zero/promo `commission_rate` is immutable
   - if booked commission is missing, use approved platform fallback rather than a later fleet agreement

5. `test_fleet_live_identity_contract.py`
   - preserve fleet-owner scoping and identity/private-file safety
   - align with restored admin-2FA/private-read guards

6. `test_mobile_server_truth_contract.py`
   - preserve Customer active-trip restore, uncertain booking recovery and Driver accept reconciliation
   - keep receipt/rating behavior server-truth/paid-state driven

7. `frontend/customer-build-gate.json`
   - inherited historical build authorization must remain revoked
   - no profile is authorized by this recovery

8. `driver-app/src/lib/nativeRuntime.ts`
   - preserve Driver source behavior exactly
   - only guard notification-handler installation so a native notification module startup error cannot crash Driver startup

9. `driver-app/app.config.js`
   - preserve Driver Apple/Google native setup
   - add the approved Firebase Android file-secret hook/fail-closed build check

10. `.github/workflows/ios-build.yml`
    - legacy ungated builder must remain disabled/manual placeholder
    - no native compile/submit step in this recovered baseline

## Required verification

Keep editing only the unresolved files until:

```powershell
python scripts/verify_phase2b_recovery.py
```

prints:

`PHASE 2B HASH RECOVERY PASS`

Then run:

```powershell
.\scripts\finish_phase2b_recovery.ps1
```

Do not claim success unless the hash verifier, backend compile, recorded backend test boundary, Customer TypeScript and Driver TypeScript all pass.

After success, commit but do not merge to main:

```powershell
.\scripts\finish_phase2b_recovery.ps1 -Commit -Push
```

Report the final recovery commit SHA and exact test totals. Then stop. Phase 3/Figma begins only after Phase 2C certification.
