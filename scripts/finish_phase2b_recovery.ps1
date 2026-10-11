param(
  [switch]$Commit,
  [switch]$Push
)

$ErrorActionPreference = 'Stop'
$branch = 'recovery/snar-mobile-v10-phase2b'
$repo = 'foziakahero-dot/Emergent-kjapp-taxi'

function Fail([string]$Message) {
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
}

try { git rev-parse --is-inside-work-tree | Out-Null } catch { Fail 'Run this inside the SNAR Git repository.' }
$current = (git branch --show-current).Trim()
if ($current -ne $branch) { Fail "Expected branch $branch, current branch is $current" }

$dirty = git status --porcelain
if ($dirty) {
  Write-Host $dirty
  Fail 'Working tree must be clean before recovery. Commit/stash intentional work first.'
}

Write-Host 'Fetching locked source history...' -ForegroundColor Cyan
git fetch origin `
  main `
  fix/beta-mobile-firebase-ops-20260926 `
  fix/customer-search-mapbox-stripe-20261004 `
  audit/driver-snar-p0-20261005

$main = (git rev-parse origin/main).Trim()
if ($main -ne '6f2c2d96e7290fb1b3331906e752958e1db4c356') {
  Write-Host "Current origin/main is $main (newer movement is allowed), but recovery stays anchored to the locked Phase 2B main." -ForegroundColor Yellow
}

Write-Host 'Recovering approved backend guards...' -ForegroundColor Cyan
python scripts/recover_phase2b_server.py
if ($LASTEXITCODE -ne 0) { Fail 'backend/server.py did not reach the recorded Phase 2B blob.' }

Write-Host 'Checking exact Phase 2B critical hashes...' -ForegroundColor Cyan
python scripts/verify_phase2b_recovery.py
if ($LASTEXITCODE -ne 0) {
  Fail 'One or more critical recovery files still differ. Use docs/snar-v10/PHASE2B_RECOVERY_STATUS.md; do not build, deploy or start Figma migration.'
}

Write-Host 'Compiling backend...' -ForegroundColor Cyan
python -m compileall -q backend
if ($LASTEXITCODE -ne 0) { Fail 'Backend compile failed.' }

$tests = @(
  'backend/tests/test_security_regressions_unit.py',
  'backend/tests/test_navigation_settings_unit.py',
  'backend/tests/test_mobile_commerce.py',
  'backend/tests/test_ride_reservations.py',
  'backend/tests/test_ride_search.py',
  'backend/tests/test_waiting_fares.py',
  'backend/tests/test_trip_cancellation.py',
  'backend/tests/test_early_ride_ending.py',
  'backend/tests/test_customer_profile.py',
  'backend/tests/test_manual_fleet_onboarding.py',
  'backend/tests/test_fleet_invitation_delivery.py',
  'backend/tests/test_partner_approval.py',
  'backend/tests/test_stripe_connect_setup.py',
  'backend/tests/test_operations_os_unit.py',
  'backend/tests/test_integration_settings.py',
  'backend/tests/test_fleet_automation.py',
  'backend/tests/test_internal_ride_testing.py',
  'backend/tests/test_marketing_waitlist_unit.py',
  'backend/tests/test_beta_trip_integrity_contract.py',
  'backend/tests/test_beta_trip_lifecycle_contract.py',
  'backend/tests/test_real_trip_integrity_contract.py',
  'backend/tests/test_receipt_identity_recheck_contract.py',
  'backend/tests/test_fleet_live_identity_contract.py',
  'backend/tests/test_mobile_server_truth_contract.py',
  'backend/tests/test_settlement_truth_contract.py'
)

Write-Host 'Running recorded Phase 2B backend test boundary...' -ForegroundColor Cyan
python -m pytest -q --disable-warnings $tests
if ($LASTEXITCODE -ne 0) { Fail 'Phase 2B backend regression boundary is not green.' }

Write-Host 'Running Customer typecheck...' -ForegroundColor Cyan
Push-Location frontend
try {
  if (-not (Test-Path node_modules)) { npm ci }
  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { Fail 'Customer TypeScript check failed.' }
} finally { Pop-Location }

Write-Host 'Running Driver typecheck...' -ForegroundColor Cyan
Push-Location driver-app
try {
  if (-not (Test-Path node_modules)) { npm ci }
  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { Fail 'Driver TypeScript check failed.' }
} finally { Pop-Location }

Write-Host 'PHASE 2B RECOVERY CODE GATE PASS' -ForegroundColor Green
Write-Host 'No APK/IPA, deploy, OTA, database mutation or provider action was performed.' -ForegroundColor Green

if ($Commit) {
  git add backend/server.py backend/tests frontend/customer-build-gate.json driver-app/src/lib/nativeRuntime.ts driver-app/app.config.js .github/workflows/ios-build.yml
  if (-not (git diff --cached --quiet)) {
    git commit -m 'fix(recovery): complete verified Phase 2B local reconciliations'
  }
}

if ($Push) {
  if (-not $Commit) { Fail '-Push requires -Commit so only a reviewed commit is pushed.' }
  git push origin HEAD:$branch
  if ($LASTEXITCODE -ne 0) { Fail 'Push failed.' }
  Write-Host "Pushed verified recovery to $repo / $branch" -ForegroundColor Green
}
