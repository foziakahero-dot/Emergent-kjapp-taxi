$ErrorActionPreference = 'Stop'

function Run-EasWorkflow {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectDir,
        [Parameter(Mandatory = $true)][string]$WorkflowPath,
        [Parameter(Mandatory = $true)][string]$Label
    )

    Write-Host ""
    Write-Host "=== $Label ==="
    Push-Location $ProjectDir
    try {
        npx --yes eas-cli@latest whoami
        if ($LASTEXITCODE -ne 0) {
            throw "Expo EAS is not authenticated for $Label. Run 'npx eas-cli@latest login' once, then rerun this script."
        }

        npx --yes eas-cli@latest workflow:run $WorkflowPath
        if ($LASTEXITCODE -ne 0) {
            throw "EAS workflow failed to start for $Label."
        }
    }
    finally {
        Pop-Location
    }
}

Run-EasWorkflow -ProjectDir 'frontend' -WorkflowPath '.eas/workflows/paid-beta-apk.yml' -Label 'SNAR Customer Paid Beta APK'
Run-EasWorkflow -ProjectDir 'driver-app' -WorkflowPath '.eas/workflows/paid-beta-apk.yml' -Label 'SNAR Driver Paid Beta APK'

Write-Host ""
Write-Host 'Both workflows were submitted directly to Expo EAS.'
