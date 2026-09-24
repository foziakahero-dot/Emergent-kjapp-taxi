param(
  [switch]$SkipInstall,
  [switch]$SkipExpoDoctor
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Step([string]$Name, [scriptblock]$Action) {
  Write-Host ""
  Write-Host "=== $Name ===" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

function NpmGate([string]$RelativePath, [string]$Label, [switch]$Build) {
  $dir = Join-Path $Root $RelativePath
  Push-Location $dir
  try {
    if (-not $SkipInstall) {
      Step "$Label dependencies" { npm install --no-audit --no-fund }
    }
    Step "$Label TypeScript" { npx tsc --noEmit }
    if (-not $SkipExpoDoctor -and ($RelativePath -eq "frontend" -or $RelativePath -eq "driver-app")) {
      Step "$Label Expo Doctor" { npx expo-doctor@latest }
      Step "$Label Expo config" { npx expo config --type public }
    }
    if ($Build) {
      Step "$Label build" { npm run build }
    }
  }
  finally {
    Pop-Location
  }
}

Write-Host "KJAPP local beta gate" -ForegroundColor Green
Write-Host "Root: $Root"
Write-Host "This validates source only. It does not deploy, merge, charge cards or modify production data."

Push-Location $Root
try {
  Step "Git branch" {
    $branch = git branch --show-current
    Write-Host "Branch: $branch"
    if ($branch -ne "beta/oslo-production-ready") {
      Write-Error "Run this gate from beta/oslo-production-ready. Current: $branch"
      exit 2
    }
  }

  Step "Git diff check" { git diff --check }

  Step "Backend Python compile" { python -m compileall -q backend }

  if (Test-Path (Join-Path $Root "backend\tests")) {
    Step "Backend focused unit tests" {
      python -m pytest -q backend/tests/test_security_regressions_unit.py
    }
  }

  NpmGate "admin-web" "Admin" -Build
  NpmGate "marketing-web" "Marketing" -Build
  NpmGate "frontend" "Customer"
  NpmGate "driver-app" "Driver"

  Write-Host ""
  Write-Host "LOCAL BETA GATE PASSED" -ForegroundColor Green
  Write-Host "Next: signed EAS APK/TestFlight builds + docs/PHYSICAL_BETA_QA.md"
}
finally {
  Pop-Location
}
