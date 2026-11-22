param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'prod')]
    [string]$Profile,
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) {
    $EnvFile = Join-Path $repoRoot "middleware\config\$Profile.env"
}
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    throw "Environment file not found. Copy middleware/config/$Profile.env.example to middleware/config/$Profile.env and fill it locally."
}

$allowed = @(
    'SMART_MUSEUM_ENV', 'JNOSQL_MONGODB_HOST', 'JNOSQL_DOCUMENT_DATABASE',
    'CORE_SERVICE_URL', 'IAM_SERVICE_URL', 'INTER_SERVICE_TOKEN',
    'INGEST_SERVICE_TOKEN',
    'JNOSQL_MONGODB_USER', 'JNOSQL_MONGODB_PASSWORD', 'JNOSQL_MONGODB_AUTHENTICATION_MECHANISM', 'JNOSQL_MONGODB_AUTHENTICATION_DATABASE', 'JWT_SIGNING_KEY_BASE64', 'JWT_ISSUER',
    'JWT_ACCESS_TOKEN_SECONDS', 'CORS_ALLOWED_ORIGINS', 'BOOTSTRAP_ADMIN_NAME',
    'BOOTSTRAP_ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_PASSWORD', 'SEED_DEVICES', 'MQTT_BROKER_URI',
    'TLS_KEYSTORE_PATH', 'TLS_KEYSTORE_PASSWORD'
)
$allowed | ForEach-Object { [Environment]::SetEnvironmentVariable($_, $null, 'Process') }
$seen = @{}
foreach ($line in Get-Content -LiteralPath $EnvFile) {
    $trimmed = $line.TrimStart()
    if (-not $trimmed.Trim() -or $trimmed.StartsWith('#')) { continue }
    if ($trimmed -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$') {
        throw 'Environment file contains a line that is not NAME=value.'
    }
    $name = $Matches[1]
    $value = if ($name -eq 'BOOTSTRAP_ADMIN_PASSWORD') { $Matches[2] } else { $Matches[2].Trim() }
    if ($name -notin $allowed) { throw "Environment file contains an unsupported variable name: $name" }
    if ($seen.ContainsKey($name)) { throw "Environment file contains a duplicate variable name: $name" }
    $seen[$name] = $true
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}
if ($env:SMART_MUSEUM_ENV -ne $Profile) { throw "SMART_MUSEUM_ENV must match selected profile '$Profile'." }

$required = @(
    'JNOSQL_MONGODB_HOST', 'JNOSQL_DOCUMENT_DATABASE', 'INGEST_SERVICE_TOKEN',
    'CORE_SERVICE_URL', 'IAM_SERVICE_URL', 'INTER_SERVICE_TOKEN',
    'JWT_SIGNING_KEY_BASE64', 'JWT_ISSUER', 'JWT_ACCESS_TOKEN_SECONDS',
    'CORS_ALLOWED_ORIGINS', 'SEED_DEVICES', 'MQTT_BROKER_URI', 'TLS_KEYSTORE_PATH', 'TLS_KEYSTORE_PASSWORD'
)
$missing = @($required | Where-Object { [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_, 'Process')) })
if ($missing.Count -gt 0) { throw "Required environment variables are missing: $($missing -join ', ')" }

Write-Host "Loaded $Profile configuration variables into this PowerShell process. Secret values were not displayed."
