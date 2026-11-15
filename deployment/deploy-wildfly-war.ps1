param(
    [Parameter(Mandatory = $true)][ValidateSet('client', 'admin', 'api')][string]$Application,
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
$deploymentStart = [DateTime]::UtcNow
Copy-Item -LiteralPath $warPath -Destination $staging -Force
if ((Get-FileHash -LiteralPath $warPath -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $staging -Algorithm SHA256).Hash) {
    Remove-Item -LiteralPath $staging -Force
    throw 'Staged WAR hash mismatch; deployment was not changed.'
}
if (Test-Path -LiteralPath $deployedMarker) { Remove-Item -LiteralPath $deployedMarker -Force }
if (Test-Path -LiteralPath $failedMarker) { Remove-Item -LiteralPath $failedMarker -Force }
Move-Item -LiteralPath $staging -Destination $destination -Force
$deploymentOk = $false
$env:NOPAUSE = 'true'
for ($attempt = 0; $attempt -lt 45; $attempt++) {
    if ((Test-Path -LiteralPath $failedMarker) -and (Get-Item -LiteralPath $failedMarker).LastWriteTimeUtc -ge $deploymentStart) {
        break
    }
    if ((Test-Path -LiteralPath $deployedMarker) -and (Get-Item -LiteralPath $deployedMarker).LastWriteTimeUtc -ge $deploymentStart) {
        $deploymentOk = $true
        break
    }
    $cliOutput = & $cli '--connect' "--command=deployment-info --name=$expectedName" 2>$null
    if ($LASTEXITCODE -eq 0 -and ($cliOutput -match "$expectedName\s+$expectedName\s+\S+\s+true\s+OK")) {
        $deploymentOk = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $deploymentOk) {
    if ($rollbackPath -and (Test-Path -LiteralPath $rollbackPath)) {
        Copy-Item -LiteralPath $rollbackPath -Destination $staging -Force
        Move-Item -LiteralPath $staging -Destination $destination -Force
        throw "$expectedName did not deploy successfully. The previous WAR was restored from the verified backup; inspect the WildFly log and marker files."
    }
    throw "$expectedName did not deploy successfully. Inspect the WildFly log and marker files."
}
Write-Host "$expectedName deployed successfully according to the WildFly deployment marker."
