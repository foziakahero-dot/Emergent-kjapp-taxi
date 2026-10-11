param()

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Make-Lockfile([string]$RelativePath, [string]$Label) {
  $dir = Join-Path $Root $RelativePath
  Push-Location $dir
  try {
    Write-Host ""
    Write-Host "=== $Label package-lock ===" -ForegroundColor Cyan
    npm install --package-lock-only --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
      throw "$Label package-lock generation failed with exit code $LASTEXITCODE"
    }
    $lock = Join-Path $dir "package-lock.json"
    if (-not (Test-Path $lock)) {
      throw "$Label package-lock.json was not created"
    }
    Write-Host "OK: $RelativePath/package-lock.json" -ForegroundColor Green
  }
  finally {
    Pop-Location
  }
}

Make-Lockfile "frontend" "Customer"
Make-Lockfile "driver-app" "Driver"

Write-Host ""
Write-Host "Mobile lockfiles are ready." -ForegroundColor Green
Write-Host "Review and commit BOTH lockfiles before the next signed EAS build:"
Write-Host "  frontend/package-lock.json"
Write-Host "  driver-app/package-lock.json"
git status --short -- frontend/package-lock.json driver-app/package-lock.json
