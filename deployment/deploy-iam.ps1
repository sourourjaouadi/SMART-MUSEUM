param([Parameter(Mandatory = $true)][string]$WildFlyHome, [switch]$ReplaceExisting)
$repoRoot = Split-Path -Parent $PSScriptRoot
$war = Join-Path $repoRoot 'middleware\iam\target\smart-museum-iam.war'
& (Join-Path $PSScriptRoot 'deploy-wildfly-war.ps1') -Application iam -WarPath $war -WildFlyHome $WildFlyHome -ReplaceExisting:$ReplaceExisting
