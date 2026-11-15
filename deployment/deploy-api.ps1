param(
    [string]$WarPath,
    [Parameter(Mandatory = $true)][string]$WildFlyHome,
    [Parameter(Mandatory = $true)][string]$VerifiedApiBackup,
    [Parameter(Mandatory = $true)][string]$ExpectedApiBackupSha256,
    [switch]$ReplaceExisting
)
if (-not $WarPath) {
    $WarPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'middleware\api\target\smart-museum.war'
}
& (Join-Path $PSScriptRoot 'deploy-wildfly-war.ps1') -Application api -WarPath $WarPath -WildFlyHome $WildFlyHome -VerifiedApiBackup $VerifiedApiBackup -ExpectedApiBackupSha256 $ExpectedApiBackupSha256 -ReplaceExisting:$ReplaceExisting
