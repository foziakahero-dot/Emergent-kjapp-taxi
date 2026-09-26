param(
  [ValidateSet("customer","driver","all")]
  [string]$Target = "all",

  [ValidateSet("android","ios","all")]
  [string]$Platform = "all",

  [switch]$Wait,
  [ValidateSet("beta/oslo-production-ready","fix/beta-mobile-firebase-ops-20260926")]
  [string]$ExpectedBranch = "beta/oslo-production-ready"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
function Run-Step([string]$Name, [scriptblock]$Action) {
  Write-Host ""
  Write-Host "=== $Name ===" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

function Run-EasWorkflow([string]$RelativePath, [string]$Workflow, [string]$Label) {
  $dir = Join-Path $Root $RelativePath
  Push-Location $dir
  try {
    $npxArgs = @("--yes", "--package", "eas-cli@latest", "eas", "workflow:run", ".eas/workflows/$Workflow", "--non-interactive")
    if ($Wait) { $npxArgs += "--wait" }
    Run-Step "$Label" { npx @npxArgs }
  }
  finally {
    Pop-Location
  }
}

Push-Location $Root
try {
  Run-Step "Verify release branch" {
    $branch = git branch --show-current
    Write-Host "Branch: $branch"
    if ($branch -ne $ExpectedBranch) {
      Write-Error "Expected $ExpectedBranch, got $branch"
      exit 2
    }

    $dirty = git status --porcelain
    if ($dirty) {
      Write-Error "Working tree has uncommitted changes. Commit/stash before signed beta builds."
      exit 3
    }

    git fetch origin $ExpectedBranch
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $local = git rev-parse HEAD
    $remote = git rev-parse "origin/$ExpectedBranch"
    Write-Host "Local : $local"
    Write-Host "Remote: $remote"
    if ($local -ne $remote) {
      Write-Error "Local branch is not identical to GitHub. Run: git pull --ff-only origin $ExpectedBranch"
      exit 4
    }
  }

  Run-Step "Mobile lockfiles" {
    $missing = @()
    foreach ($path in @("frontend\package-lock.json", "driver-app\package-lock.json")) {
      if (-not (Test-Path (Join-Path $Root $path))) { $missing += $path }
    }
    if ($missing.Count -gt 0) {
      Write-Error ("Missing committed mobile lockfile(s): " + ($missing -join ", "))
      Write-Error "Run: powershell -ExecutionPolicy Bypass -File .\scripts\prepare_mobile_lockfiles.ps1"
      exit 5
    }
  }

  Run-Step "Static beta policy" { python scripts/beta_static_policy.py }
  Run-Step "Expo authentication" { npx eas-cli@latest whoami }

  if ($Platform -eq "android" -or $Platform -eq "all") {
    if ($Target -eq "customer" -or $Target -eq "all") {
      Run-EasWorkflow "frontend" "android-apk.yml" "Customer Android beta APK"
    }
    if ($Target -eq "driver" -or $Target -eq "all") {
      Run-EasWorkflow "driver-app" "android-apk.yml" "Driver Android beta APK"
    }
  }

  if ($Platform -eq "ios" -or $Platform -eq "all") {
    if ($Target -eq "customer" -or $Target -eq "all") {
      Run-EasWorkflow "frontend" "testflight-beta.yml" "Customer iOS beta -> TestFlight"
    }
    if ($Target -eq "driver" -or $Target -eq "all") {
      Run-EasWorkflow "driver-app" "testflight-beta.yml" "Driver iOS beta -> TestFlight"
    }
  }

  Write-Host ""
  Write-Host "EAS beta workflow(s) started successfully." -ForegroundColor Green
  Write-Host "Next release gate: docs/PHYSICAL_BETA_QA.md"
}
finally {
  Pop-Location
}
