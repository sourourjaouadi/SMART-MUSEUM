param(
    [string]$Email,
    [SecureString]$Password,
    [string]$OutputPath = (Join-Path $env:LOCALAPPDATA 'SmartMuseum\M2-TLS\acceptance-admin.json'),
    [switch]$Force,
    [switch]$VerifyLogin
)

# Writes the local credential file used by deployment/test-m2-runtime.ps1:
# {"email": "...", "password": "..."} for YOUR sandbox ADMIN account (the one created
# from BOOTSTRAP_ADMIN_* in your own dev.env). The file stays outside the repository,
# is readable only by the current Windows user, and its values are never printed.
# Each developer creates their own; no credential is shared through Git.
$ErrorActionPreference = 'Stop'
if (-not $Email) { $Email = Read-Host 'Sandbox ADMIN email (BOOTSTRAP_ADMIN_EMAIL in your dev.env)' }
$Email = $Email.Trim()
if ($Email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Enter a valid email address. No file was written.' }
if (-not $Password) { $Password = Read-Host 'Sandbox ADMIN password' -AsSecureString }
if ((Test-Path -LiteralPath $OutputPath) -and -not $Force) {
    throw "$OutputPath already exists. It was not overwritten. Use -Force to replace it."
}

$plain = [Net.NetworkCredential]::new('', $Password).Password
try {
    if ($plain.Length -lt 12) { throw 'The password must have at least 12 characters. No file was written.' }

    if ($VerifyLogin) {
        # Same trust as the browser: the local mkcert CA in the Windows user store.
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $body = @{ email = $Email; password = $plain } | ConvertTo-Json -Compress
        try {
            $login = Invoke-RestMethod -Method Post -Uri 'https://api.smartmuseum.test/api/auth/login' `
                -ContentType 'application/json' -Body $body
        } catch {
            throw 'Login with these credentials failed (wrong email/password, or WildFly/the API is not running). No file was written.'
        } finally { $body = $null }
        if ($login.user.role -ne 'ADMIN') { throw 'These credentials belong to a non-ADMIN account. No file was written.' }
    }

    $directory = Split-Path -Parent $OutputPath
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $temporary = "$OutputPath.staging"
    try {
        # Restrict the file to the current user before writing the secret into it.
        [IO.File]::WriteAllText($temporary, '')
        $me = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        $acl = New-Object System.Security.AccessControl.FileSecurity
        $acl.SetAccessRuleProtection($true, $false)
        $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($me, 'Read, Write', 'Allow')))
        Set-Acl -LiteralPath $temporary -AclObject $acl
        $json = @{ email = $Email; password = $plain } | ConvertTo-Json -Compress
        [IO.File]::WriteAllText($temporary, $json, [Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temporary -Destination $OutputPath -Force
    } catch {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
        throw
    } finally { $json = $null }
} finally {
    $plain = $null
}
Write-Host "Acceptance credential file written for $Email (readable only by the current user)$(if ($VerifyLogin) { '; ADMIN login verified' }). The password was not displayed."
