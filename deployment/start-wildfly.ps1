param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'prod')]
    [string]$Profile,
    [string]$WildFlyHome = $env:WILDFLY_HOME,
    [string]$EnvFile,
    [switch]$UseParentEnvironment
)

$ErrorActionPreference = 'Stop'
$env:NOPAUSE = 'true'
if (-not $WildFlyHome -or -not (Test-Path -LiteralPath (Join-Path $WildFlyHome 'bin\standalone.bat') -PathType Leaf)) {
    throw 'Set -WildFlyHome or WILDFLY_HOME to the installed WildFly 42 directory.'
}
$clearImportedSecrets = -not $UseParentEnvironment
try {
    if ($UseParentEnvironment) {
        if ($EnvFile) { throw '-EnvFile and -UseParentEnvironment cannot be used together.' }
        if ($env:SMART_MUSEUM_ENV -ne $Profile) { throw "The externally supplied SMART_MUSEUM_ENV must match '$Profile'." }
    } elseif ($EnvFile) {
        . (Join-Path $PSScriptRoot 'Import-MuseumEnvironment.ps1') -Profile $Profile -EnvFile $EnvFile
    } else {
        . (Join-Path $PSScriptRoot 'Import-MuseumEnvironment.ps1') -Profile $Profile
    }

    foreach ($port in @(80, 443, 8080, 9990)) {
        $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
        if ($listener) { throw "Port $port already has a listener. Inspect it before starting WildFly." }
    }

    Push-Location (Join-Path $WildFlyHome 'bin')
    try {
        & '.\standalone.bat' '-c' 'standalone.xml'
        if ($LASTEXITCODE -ne 0) { throw "WildFly exited with code $LASTEXITCODE." }
    } finally {
        Pop-Location
    }
} finally {
    if ($clearImportedSecrets) {
        @('INGEST_SERVICE_TOKEN', 'INTER_SERVICE_TOKEN', 'JWT_SIGNING_KEY_BASE64', 'BOOTSTRAP_ADMIN_PASSWORD', 'TLS_KEYSTORE_PASSWORD') |
            ForEach-Object { [Environment]::SetEnvironmentVariable($_, $null, 'Process') }
    }
}
