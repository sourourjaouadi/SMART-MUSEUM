param([string]$WarPath, [Parameter(Mandatory = $true)][string]$WildFlyHome, [switch]$ReplaceExisting)
if (-not $WarPath) {
    $WarPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'pwa-admin\deployment\target\smart-museum-admin.war'
}
& (Join-Path $PSScriptRoot 'deploy-wildfly-war.ps1') -Application admin -WarPath $WarPath -WildFlyHome $WildFlyHome -ReplaceExisting:$ReplaceExisting
