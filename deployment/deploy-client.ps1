param([string]$WarPath, [Parameter(Mandatory = $true)][string]$WildFlyHome, [switch]$ReplaceExisting)
if (-not $WarPath) {
    $WarPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'pwa-client\deployment\target\smart-museum-client.war'
}
& (Join-Path $PSScriptRoot 'deploy-wildfly-war.ps1') -Application client -WarPath $WarPath -WildFlyHome $WildFlyHome -ReplaceExisting:$ReplaceExisting
