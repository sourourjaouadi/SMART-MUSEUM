param([Parameter(Mandatory = $true)][string]$WildFlyHome)

$ErrorActionPreference = 'Stop'
$env:NOPAUSE = 'true'
$cli = Join-Path $WildFlyHome 'bin\jboss-cli.bat'
if (-not (Test-Path -LiteralPath $cli -PathType Leaf)) { throw 'WildFlyHome must contain bin\jboss-cli.bat.' }
foreach ($script in @('wildfly-pwa-hosts.cli', 'wildfly-m2-api-host.cli')) {
    $path = Join-Path $PSScriptRoot $script
    & $cli '--connect' "--file=$path"
    if ($LASTEXITCODE -ne 0) { throw "WildFly CLI script failed: $script (exit $LASTEXITCODE)." }
}
Write-Host 'WildFly Client, Admin and API virtual-host CLI scripts completed. Inspect host aliases and deployments.'
