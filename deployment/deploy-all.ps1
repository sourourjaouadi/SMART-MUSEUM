param(
    [Parameter(Mandatory = $true)][string]$WildFlyHome,
    [Parameter(Mandatory = $true)][string]$VerifiedApiBackup,
    [Parameter(Mandatory = $true)][string]$ExpectedApiBackupSha256,
    [switch]$ReplaceExisting
)

$ErrorActionPreference = 'Stop'
if (-not $ReplaceExisting) { throw 'Deploying all applications requires -ReplaceExisting because M1 WARs are already deployed.' }
$repoRoot = Split-Path -Parent $PSScriptRoot
$deployments = Join-Path $WildFlyHome 'standalone\deployments'
$expected = @{
    'smart-museum-client.war' = Join-Path $repoRoot 'pwa-client\deployment\target\smart-museum-client.war'
    'smart-museum-admin.war' = Join-Path $repoRoot 'pwa-admin\deployment\target\smart-museum-admin.war'
    'smart-museum.war' = Join-Path $repoRoot 'middleware\api\target\smart-museum.war'
}
foreach ($entry in $expected.GetEnumerator()) {
    if (-not (Test-Path -LiteralPath $entry.Value -PathType Leaf)) { throw "Required artifact is missing: $($entry.Value)" }
    if (-not (Test-Path -LiteralPath (Join-Path $deployments $entry.Key) -PathType Leaf)) { throw "Expected existing deployment is missing: $($entry.Key); inspect WildFly before continuing." }
}
$backupPath = (Resolve-Path -LiteralPath $VerifiedApiBackup -ErrorAction Stop).Path
$backupHash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash
$currentApiHash = (Get-FileHash -LiteralPath (Join-Path $deployments 'smart-museum.war') -Algorithm SHA256).Hash
if (($backupHash -ne $ExpectedApiBackupSha256.ToUpperInvariant()) -or ($currentApiHash -ne $backupHash)) {
    throw 'The current API deployment and verified rollback backup must match before any application is replaced.'
}
& (Join-Path $PSScriptRoot 'deploy-api.ps1') -WildFlyHome $WildFlyHome -VerifiedApiBackup $VerifiedApiBackup -ExpectedApiBackupSha256 $ExpectedApiBackupSha256 -ReplaceExisting
& (Join-Path $PSScriptRoot 'deploy-client.ps1') -WildFlyHome $WildFlyHome -ReplaceExisting
& (Join-Path $PSScriptRoot 'deploy-admin.ps1') -WildFlyHome $WildFlyHome -ReplaceExisting
Write-Host 'All three WARs were copied. Confirm WildFly deployment status before runtime testing.'
