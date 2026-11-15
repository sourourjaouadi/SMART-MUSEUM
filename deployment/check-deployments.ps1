param([string]$WildFlyHome = $env:WILDFLY_HOME)

$ErrorActionPreference = 'Stop'
$env:NOPAUSE = 'true'
if (-not $WildFlyHome -or -not (Test-Path -LiteralPath (Join-Path $WildFlyHome 'bin\jboss-cli.bat') -PathType Leaf)) {
    throw 'Set -WildFlyHome or WILDFLY_HOME to the installed WildFly 42 directory.'
}
& (Join-Path $WildFlyHome 'bin\jboss-cli.bat') '--connect' '--command=deployment-info'
if ($LASTEXITCODE -ne 0) { throw "WildFly deployment status query failed with code $LASTEXITCODE." }
