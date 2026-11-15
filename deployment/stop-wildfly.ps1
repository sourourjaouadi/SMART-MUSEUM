param(
    [string]$WildFlyHome = $env:WILDFLY_HOME,
    [Parameter(Mandatory = $true)]
    [switch]$ConfirmStop
)

$ErrorActionPreference = 'Stop'
$env:NOPAUSE = 'true'
if (-not $ConfirmStop) { throw 'Stopping WildFly requires the explicit -ConfirmStop switch.' }
if (-not $WildFlyHome -or -not (Test-Path -LiteralPath (Join-Path $WildFlyHome 'bin\jboss-cli.bat') -PathType Leaf)) {
    throw 'Set -WildFlyHome or WILDFLY_HOME to the installed WildFly 42 directory.'
}
& (Join-Path $WildFlyHome 'bin\jboss-cli.bat') '--connect' '--command=:shutdown'
if ($LASTEXITCODE -ne 0) { throw "WildFly shutdown command failed with code $LASTEXITCODE." }
Write-Host 'WildFly shutdown request sent.'
