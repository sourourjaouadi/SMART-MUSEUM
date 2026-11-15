param([Parameter(Mandatory = $true)][string]$WildFlyHome, [switch]$ReplaceExisting)
$repoRoot = Split-Path -Parent $PSScriptRoot
$war = Join-Path $repoRoot 'middleware\core\target\smart-museum-core.war'
& (Join-Path $PSScriptRoot 'deploy-wildfly-war.ps1') -Application core -WarPath $war -WildFlyHome $WildFlyHome -ReplaceExisting:$ReplaceExisting
