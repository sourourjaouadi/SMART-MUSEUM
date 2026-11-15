param(
    [Parameter(Mandatory = $true)][ValidateSet('client', 'admin', 'api', 'core', 'iam')][string]$Application,
    [Parameter(Mandatory = $true)][string]$WarPath,
    [Parameter(Mandatory = $true)][string]$WildFlyHome,
    [switch]$ReplaceExisting,
    [switch]$Rollback,
    [string]$VerifiedApiBackup,
    [string]$ExpectedApiBackupSha256
)

$ErrorActionPreference = 'Stop'
$names = @{
    client = 'smart-museum-client.war'
    admin  = 'smart-museum-admin.war'
    api    = 'smart-museum.war'
    core   = 'smart-museum-core.war'
    iam    = 'smart-museum-iam.war'
}
$warPath = (Resolve-Path -LiteralPath $WarPath -ErrorAction Stop).Path
$deployments = Join-Path $WildFlyHome 'standalone\deployments'
$cli = Join-Path $WildFlyHome 'bin\jboss-cli.bat'
if (-not (Test-Path $deployments -PathType Container) -or -not (Test-Path $cli -PathType Leaf)) {
    throw 'WildFlyHome must point to a WildFly installation with standalone deployments and jboss-cli.bat.'
}
$expectedName = $names[$Application]
if (-not $Rollback -and [IO.Path]::GetFileName($warPath) -ne $expectedName) { throw "$Application WAR must be named $expectedName." }
$destination = Join-Path $deployments $expectedName
$rollbackPath = $null
if (Test-Path -LiteralPath $destination) {
    if (-not $ReplaceExisting) { throw "$expectedName already exists. Inspect it, then rerun with -ReplaceExisting to create a backup before replacement." }
    if ($Application -eq 'api' -and -not $Rollback) {
        if (-not $VerifiedApiBackup -or -not $ExpectedApiBackupSha256) {
            throw 'Replacing the existing API requires -VerifiedApiBackup and -ExpectedApiBackupSha256.'
        }
        $backup = (Resolve-Path -LiteralPath $VerifiedApiBackup -ErrorAction Stop).Path
        $backupHash = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash
        if ($backupHash -ne $ExpectedApiBackupSha256.ToUpperInvariant()) { throw 'The supplied API backup does not match the expected SHA-256.' }
        $currentHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
        if ($currentHash -ne $backupHash) { throw 'The current API deployment does not match the verified rollback backup.' }
    }
    $backupRoot = Join-Path $WildFlyHome 'standalone\m2-backups'
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $rollbackPath = Join-Path $backupRoot "$stamp-$expectedName"
    Copy-Item -LiteralPath $destination -Destination $rollbackPath
    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $rollbackPath -Algorithm SHA256).Hash) {
        throw 'Pre-deployment backup verification failed; deployment was not changed.'
    }
} elseif ($Application -eq 'api') {
    if (-not $VerifiedApiBackup -or -not $ExpectedApiBackupSha256) {
        throw 'API deployment requires the verified old backend WAR as a rollback artifact, even when the scanner WAR is absent.'
    }
}

if ($Application -eq 'api' -and -not (Test-Path -LiteralPath $destination)) {
    $backup = (Resolve-Path -LiteralPath $VerifiedApiBackup -ErrorAction Stop).Path
    if ((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash -ne $ExpectedApiBackupSha256.ToUpperInvariant()) {
        throw 'The supplied API backup does not match the expected SHA-256.'
    }
    $rollbackPath = $backup
}

$staging = "$destination.m2-staging"
$deployedMarker = "$destination.deployed"
$failedMarker = "$destination.failed"
Copy-Item -LiteralPath $warPath -Destination $staging -Force
if ((Get-FileHash -LiteralPath $warPath -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $staging -Algorithm SHA256).Hash) {
    Remove-Item -LiteralPath $staging -Force
    throw 'Staged WAR hash mismatch; deployment was not changed.'
}
if (Test-Path -LiteralPath $deployedMarker) { Remove-Item -LiteralPath $deployedMarker -Force }
if (Test-Path -LiteralPath $failedMarker) { Remove-Item -LiteralPath $failedMarker -Force }
Move-Item -LiteralPath $staging -Destination $destination -Force
$deploymentOk = $false
$lastStatus = 'WildFly has not reported deployment status yet.'
$cliCheckIntervalSeconds = 15
$deploymentTimeoutSeconds = 120
$startedAt = [DateTime]::UtcNow
$nextCliCheck = $startedAt
$env:NOPAUSE = 'true'
while (([DateTime]::UtcNow - $startedAt).TotalSeconds -lt $deploymentTimeoutSeconds) {
    # The old markers were removed before the scanner was triggered, so marker
    # existence is sufficient. Comparing filesystem timestamps to UtcNow can
    # miss a successful deployment on filesystems with coarse timestamp resolution.
    if (Test-Path -LiteralPath $failedMarker) {
        $lastStatus = Get-Content -LiteralPath $failedMarker -Raw -ErrorAction SilentlyContinue
        break
    }
    if (Test-Path -LiteralPath $deployedMarker) {
        $deploymentOk = $true
        break
    }

    # Scanner markers are authoritative for this file based deployment. Query
    # WildFly's management model occasionally as a fallback, using JSON rather
    # than parsing the human-readable deployment-info table.
    if ([DateTime]::UtcNow -ge $nextCliCheck) {
        $statusCommand = "--command=/deployment=$($expectedName):read-attribute(name=status)"
        $cliOutput = & $cli '--connect' '--output-json' $statusCommand 2>$null
        $cliExitCode = $LASTEXITCODE
        $nextCliCheck = [DateTime]::UtcNow.AddSeconds($cliCheckIntervalSeconds)
        if ($cliExitCode -eq 0) {
            try {
                $statusResponse = ($cliOutput -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction Stop
                if ($statusResponse.outcome -eq 'success' -and $statusResponse.result -eq 'OK') {
                    $deploymentOk = $true
                    break
                }
                $lastStatus = ($cliOutput -join ' ').Trim()
            } catch {
                $lastStatus = 'WildFly returned an unreadable JSON deployment status.'
            }
        } else {
            $lastStatus = ($cliOutput -join ' ').Trim()
        }
    }
    Start-Sleep -Seconds 2
}
if (-not $deploymentOk) {
    if ($rollbackPath -and (Test-Path -LiteralPath $rollbackPath)) {
        Copy-Item -LiteralPath $rollbackPath -Destination $staging -Force
        Move-Item -LiteralPath $staging -Destination $destination -Force
        throw "$expectedName did not deploy successfully. The previous WAR was restored from the verified backup. Last WildFly status: $lastStatus"
    }
    throw "$expectedName did not deploy successfully. Last WildFly status: $lastStatus"
}
Write-Host "$expectedName deployed successfully and WildFly reports status OK."
