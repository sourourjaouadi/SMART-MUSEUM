param(
    [Parameter(Mandatory = $true)][string]$WildFlyHome,
    [Parameter(Mandatory = $true)][string]$VerifiedApiBackup,
    [Parameter(Mandatory = $true)][string]$ExpectedApiBackupSha256,
    [switch]$ConfirmRollback
)

$ErrorActionPreference = 'Stop'
if (-not $ConfirmRollback) { throw 'API rollback requires the explicit -ConfirmRollback switch.' }
$backup = (Resolve-Path -LiteralPath $VerifiedApiBackup -ErrorAction Stop).Path
if ((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash -ne $ExpectedApiBackupSha256.ToUpperInvariant()) {
    throw 'The API rollback file does not match the expected SHA-256.'
}
$wrapper = Join-Path $PSScriptRoot 'deploy-wildfly-war.ps1'
& $wrapper -Application api -WarPath $backup -WildFlyHome $WildFlyHome -VerifiedApiBackup $backup -ExpectedApiBackupSha256 $ExpectedApiBackupSha256 -ReplaceExisting -Rollback
