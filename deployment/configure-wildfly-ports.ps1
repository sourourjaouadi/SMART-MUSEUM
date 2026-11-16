param(
    [Parameter(Mandatory = $true)][string]$WildFlyHome,
    [ValidateSet('dev', 'prod')][string]$Profile = 'dev'
)

# Applies the Smart Museum port layout to standalone.xml with WildFly stopped:
# public HTTP/HTTPS on 80/443 (wildfly-standard-ports.cli) and the internal
# CORE/IAM server on 127.0.0.1:8080 (wildfly-internal-server.cli). A timestamped,
# SHA-256-verified backup of standalone.xml is written first; restore it with
# WildFly stopped to roll back.
$ErrorActionPreference = 'Stop'
$env:NOPAUSE = 'true'
$cli = Join-Path $WildFlyHome 'bin\jboss-cli.bat'
$config = Join-Path $WildFlyHome 'standalone\configuration\standalone.xml'
if (!(Test-Path -LiteralPath $cli -PathType Leaf) -or !(Test-Path -LiteralPath $config -PathType Leaf)) {
    throw 'WildFlyHome must contain bin\jboss-cli.bat and standalone\configuration\standalone.xml.'
}
foreach ($port in @(80, 443, 8080, 8443, 9990)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Port $port has a listener. Stop WildFly (and inspect any other owner) before changing its configuration."
    }
}

$backupDir = Join-Path (Split-Path $config) 'm2-backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backup = Join-Path $backupDir ('standalone-before-standard-ports-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.xml')
Copy-Item -LiteralPath $config -Destination $backup
$hash = (Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash
if ((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash -ne $hash) {
    throw 'standalone.xml backup verification failed; configuration was not changed.'
}

# The embedded (offline) server resolves ${env.TLS_KEYSTORE_*} at boot, so load the
# profile environment like start-wildfly.ps1 does, and clear its secrets afterwards.
try {
    . (Join-Path $PSScriptRoot 'Import-MuseumEnvironment.ps1') -Profile $Profile
    foreach ($script in @('wildfly-standard-ports.cli', 'wildfly-internal-server.cli')) {
        & $cli "--file=$(Join-Path $PSScriptRoot $script)"
        if ($LASTEXITCODE -ne 0) { throw "WildFly CLI script failed: $script (exit $LASTEXITCODE). Restore $backup if needed." }
    }
} finally {
    @('INGEST_SERVICE_TOKEN', 'INTER_SERVICE_TOKEN', 'JWT_SIGNING_KEY_BASE64', 'BOOTSTRAP_ADMIN_PASSWORD', 'TLS_KEYSTORE_PASSWORD') |
        ForEach-Object { [Environment]::SetEnvironmentVariable($_, $null, 'Process') }
}

$xml = [IO.File]::ReadAllText($config)
foreach ($expected in @(
        'name="http" port="${jboss.http.port:80}"',
        'name="https" port="${jboss.https.port:443}"',
        'name="internal-http" interface="internal" port="8080"',
        '<server name="internal-server" default-host="internal-host">')) {
    if (!$xml.Contains($expected)) { throw "Expected setting not found after the CLI run: $expected. Restore $backup." }
}
Write-Host "WildFly now listens on 80/443; CORE and IAM use internal-server on 127.0.0.1:8080 (management unchanged on 9990)."
Write-Host "Verified backup: $backup (SHA-256 $hash). To roll back, stop WildFly and copy it over $config."
