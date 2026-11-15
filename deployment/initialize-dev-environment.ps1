param(
    [string]$OutputPath,
    [switch]$CreateBootstrapAdmin,
    [switch]$RotateSecrets,
    [string]$AdminName,
    [string]$AdminEmail,
    [string]$AdminPassword
)

$ErrorActionPreference = 'Stop'
if (-not $OutputPath) {
    $OutputPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'middleware\config\dev.env'
}
if ((Test-Path -LiteralPath $OutputPath) -and -not $RotateSecrets) { throw 'The DEV environment file already exists. It was not overwritten. Use -RotateSecrets to rotate its secrets explicitly.' }
$template = Join-Path (Split-Path -Parent $PSScriptRoot) 'middleware\config\dev.env.example'
$lines = Get-Content -LiteralPath $template
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$token = [Convert]::ToBase64String($bytes)
$rng.GetBytes($bytes)
$signingKey = [Convert]::ToBase64String($bytes)
$lines = $lines -replace '^INGEST_SERVICE_TOKEN=.*$', "INGEST_SERVICE_TOKEN=$token"
$lines = $lines -replace '^JWT_SIGNING_KEY_BASE64=.*$', "JWT_SIGNING_KEY_BASE64=$signingKey"

if ($CreateBootstrapAdmin -or $AdminName -or $AdminEmail -or $AdminPassword) {
    $name = if ($AdminName) { $AdminName } else { Read-Host 'Sandbox administrator display name' }
    $email = if ($AdminEmail) { $AdminEmail } else { Read-Host 'Sandbox administrator email' }
    $password = if ($AdminPassword) {
        $AdminPassword
    } else {
        $securePassword = Read-Host 'Sandbox administrator password (minimum 12 characters)' -AsSecureString
        [Net.NetworkCredential]::new('', $securePassword).Password
    }
    $passwordBytes = [Text.Encoding]::UTF8.GetByteCount($password)
    if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($email) -or
            $password.Length -lt 12 -or $passwordBytes -gt 72) {
        $password = $null
        throw 'Bootstrap values are incomplete, or the password is outside the allowed 12-character to 72-byte range. No file was written.'
    }
    $lines = @($lines | ForEach-Object {
        if ($_ -like 'BOOTSTRAP_ADMIN_NAME=*') { 'BOOTSTRAP_ADMIN_NAME=' + $name }
        elseif ($_ -like 'BOOTSTRAP_ADMIN_EMAIL=*') { 'BOOTSTRAP_ADMIN_EMAIL=' + $email }
        elseif ($_ -like 'BOOTSTRAP_ADMIN_PASSWORD=*') { 'BOOTSTRAP_ADMIN_PASSWORD=' + $password }
        else { $_ }
    })
    $password = $null
}

New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null
$temporary = "$OutputPath.m2-staging"
try {
    Set-Content -LiteralPath $temporary -Value $lines -Encoding utf8
    Move-Item -LiteralPath $temporary -Destination $OutputPath -Force
} catch {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    throw
} finally {
    $token = $null
    $signingKey = $null
    $password = $null
    $AdminPassword = $null
    $bytes = $null
    $rng.Dispose()
}
Write-Host "$(if(Test-Path -LiteralPath $OutputPath){'Created or rotated'}else{'Created'}) ignored DEV environment file. Secret values were not displayed."
