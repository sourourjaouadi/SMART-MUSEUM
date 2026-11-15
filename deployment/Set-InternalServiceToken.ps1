param(
    [string]$EnvFile,
    [switch]$Rotate
)
$ErrorActionPreference = 'Stop'
if (-not $EnvFile) { $EnvFile = Join-Path (Split-Path -Parent $PSScriptRoot) 'middleware\config\dev.env' }
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) { throw 'DEV environment file not found. Create it with initialize-dev-environment.ps1 first.' }
$lines = @(Get-Content -LiteralPath $EnvFile)
$matches = @($lines | Where-Object { $_ -match '^INTER_SERVICE_TOKEN=' })
if ($matches.Count -gt 1) { throw 'DEV environment file contains duplicate INTER_SERVICE_TOKEN entries; no changes were made.' }
if ($matches.Count -eq 1 -and $matches[0].Substring('INTER_SERVICE_TOKEN='.Length).Trim() -and -not $Rotate) {
    Write-Host 'INTER_SERVICE_TOKEN is already configured. No file changes were made.'
    exit 0
}
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes); $token = [Convert]::ToBase64String($bytes) } finally { $rng.Dispose(); $bytes = $null }
$updated = if ($matches.Count -eq 1) {
    @($lines | ForEach-Object { if ($_ -match '^INTER_SERVICE_TOKEN=') { 'INTER_SERVICE_TOKEN=' + $token } else { $_ } })
} else {
    @($lines + ('INTER_SERVICE_TOKEN=' + $token))
}
$temporary = "$EnvFile.m2-staging"
try {
    Set-Content -LiteralPath $temporary -Value $updated -Encoding utf8
    Move-Item -LiteralPath $temporary -Destination $EnvFile -Force
} catch {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    throw
} finally { $token = $null; $updated = $null }
Write-Host 'Configured INTER_SERVICE_TOKEN in the ignored DEV env file. Its value was not displayed.'
