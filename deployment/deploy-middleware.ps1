param(
    [Parameter(Mandatory = $true)][string]$WildFlyHome,
    [Parameter(Mandatory = $true)][string]$VerifiedApiBackup,
    [Parameter(Mandatory = $true)][string]$ExpectedApiBackupSha256,
    [switch]$ReplaceExisting
)
$ErrorActionPreference = 'Stop'
if (-not $ReplaceExisting) { throw 'Deploying middleware requires explicit -ReplaceExisting after reviewing the target WildFly deployment directory.' }
$repoRoot = Split-Path -Parent $PSScriptRoot
$artifacts = @(
    (Join-Path $repoRoot 'middleware\core\target\smart-museum-core.war'),
    (Join-Path $repoRoot 'middleware\iam\target\smart-museum-iam.war'),
    (Join-Path $repoRoot 'middleware\api\target\smart-museum.war')
)
foreach ($artifact in $artifacts) { if (-not (Test-Path -LiteralPath $artifact -PathType Leaf)) { throw "Build artifact missing: $artifact. Run mvn -f middleware/pom.xml clean verify first." } }
$deployments = Join-Path $WildFlyHome 'standalone\deployments'
if (-not (Test-Path -LiteralPath $deployments -PathType Container)) { throw 'WildFlyHome must contain standalone\deployments.' }
$backup = (Resolve-Path -LiteralPath $VerifiedApiBackup -ErrorAction Stop).Path
$backupHash = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash
if ($backupHash -ne $ExpectedApiBackupSha256.ToUpperInvariant()) { throw 'The verified API backup does not match its supplied SHA-256.' }
$currentApi = Join-Path $deployments 'smart-museum.war'
if (Test-Path -LiteralPath $currentApi -PathType Leaf) {
    if ((Get-FileHash -LiteralPath $currentApi -Algorithm SHA256).Hash -ne $backupHash) { throw 'The current API deployment differs from the verified rollback backup; no applications were deployed.' }
}
& (Join-Path $PSScriptRoot 'deploy-core.ps1') -WildFlyHome $WildFlyHome -ReplaceExisting
& (Join-Path $PSScriptRoot 'deploy-iam.ps1') -WildFlyHome $WildFlyHome -ReplaceExisting
& (Join-Path $PSScriptRoot 'deploy-api.ps1') -WildFlyHome $WildFlyHome -VerifiedApiBackup $VerifiedApiBackup -ExpectedApiBackupSha256 $ExpectedApiBackupSha256 -ReplaceExisting
Write-Host 'CORE, IAM, and API WARs deployed. Confirm each deployment in WildFly before runtime checks.'
