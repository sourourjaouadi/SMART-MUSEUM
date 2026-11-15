$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot 'middleware\config\dev.env'
if (!(Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw 'Create middleware/config/dev.env first with deployment/initialize-dev-environment.ps1.'
}

$settings = @{}
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') { $settings[$Matches[1]] = $Matches[2] }
}
if ($settings.SMART_MUSEUM_ENV -ne 'dev' -or
        $settings.JNOSQL_MONGODB_HOST -ne 'localhost:27018' -or
        $settings.JNOSQL_DOCUMENT_DATABASE -ne 'museum_m2_sandbox') {
    throw 'Refusing to prepare local HTTPS unless DEV targets only localhost:27018/museum_m2_sandbox.'
}

$mkcertCommand = Get-Command mkcert.exe -ErrorAction SilentlyContinue
if (!$mkcertCommand) {
    $package = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages') `
        -Filter mkcert.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($package) { $mkcertPath = $package.FullName }
    else { throw 'mkcert is not installed. Install it with: winget install --id FiloSottile.mkcert -e --scope user' }
} else { $mkcertPath = $mkcertCommand.Source }
$opensslCommand = Get-Command openssl.exe -ErrorAction SilentlyContinue
if (!$opensslCommand) { throw 'openssl.exe is required to package the local certificate as PKCS#12. Install OpenSSL and reopen PowerShell.' }
$opensslPath = $opensslCommand.Source

$certDir = Join-Path $env:LOCALAPPDATA 'SmartMuseum\M2-TLS'
$certPath = Join-Path $certDir 'smartmuseum-dev.pem'
$keyPath = Join-Path $certDir 'smartmuseum-dev-key.pem'
$keystorePath = Join-Path $certDir 'smartmuseum-dev.p12'
$rootCaPath = Join-Path $env:LOCALAPPDATA 'mkcert\rootCA.pem'
New-Item -ItemType Directory -Path $certDir -Force | Out-Null

# Compare the exact mkcert root certificate with Windows trust stores. This
# makes repeat runs safe when mkcert -install would otherwise retry an
# unrelated JDK-wide cacerts write after Windows user trust is already ready.
$rootIsTrusted = $false
if (Test-Path -LiteralPath $rootCaPath -PathType Leaf) {
    $fingerprintLine = & $opensslPath x509 -in $rootCaPath -noout -fingerprint -sha1
    if ($LASTEXITCODE -ne 0 -or $fingerprintLine -notmatch '=([0-9A-Fa-f:]+)$') {
        throw 'Could not read the local mkcert root certificate fingerprint.'
    }
    $rootThumbprint = ($Matches[1] -replace ':', '').ToUpperInvariant()
    foreach ($store in @('Cert:\CurrentUser\Root', 'Cert:\LocalMachine\Root')) {
        if (Get-ChildItem $store -ErrorAction SilentlyContinue | Where-Object { $_.Thumbprint -eq $rootThumbprint }) {
            $rootIsTrusted = $true
            break
        }
    }
}
if (!$rootIsTrusted) {
    # mkcert installs Windows trust for the current user. It may report a
    # separate JDK cacerts permission failure after the Windows import; accept
    # that partial result only if the exact CA is now trusted by Windows.
    & $mkcertPath -install
    if ($LASTEXITCODE -ne 0) {
        $trustedAfterInstall = $false
        if (Test-Path -LiteralPath $rootCaPath -PathType Leaf) {
            $fingerprintLine = & $opensslPath x509 -in $rootCaPath -noout -fingerprint -sha1
            if ($fingerprintLine -match '=([0-9A-Fa-f:]+)$') {
                $rootThumbprint = ($Matches[1] -replace ':', '').ToUpperInvariant()
                foreach ($store in @('Cert:\CurrentUser\Root', 'Cert:\LocalMachine\Root')) {
                    if (Get-ChildItem $store -ErrorAction SilentlyContinue | Where-Object { $_.Thumbprint -eq $rootThumbprint }) {
                        $trustedAfterInstall = $true
                        break
                    }
                }
            }
        }
        if (!$trustedAfterInstall) {
            throw 'mkcert did not install its CA into a Windows trusted root store. Do not use machine-wide trust; resolve the current-user trust setup first.'
        }
        Write-Warning 'Windows trusts the local mkcert CA; mkcert could not update the optional JDK-wide cacerts store, which this WildFly setup does not use.'
    }
}

$allFilesExist = (Test-Path $certPath) -and (Test-Path $keyPath) -and (Test-Path $keystorePath)
$anyFileExists = (Test-Path $certPath) -or (Test-Path $keyPath) -or (Test-Path $keystorePath)
if ($anyFileExists -and !$allFilesExist) {
    throw "A partial local TLS set exists in $certDir. Inspect it and complete it manually; this script will not overwrite files."
}

if ($allFilesExist) {
    if ([string]::IsNullOrWhiteSpace($settings.TLS_KEYSTORE_PASSWORD) -or
            $settings.TLS_KEYSTORE_PATH -ne $keystorePath -or !(Test-Path $rootCaPath)) {
        throw 'Existing local TLS files are not fully configured in dev.env; refusing to replace them.'
    }
    $env:TLS_KEYSTORE_PASSWORD = $settings.TLS_KEYSTORE_PASSWORD
} else {
    & $mkcertPath -cert-file $certPath -key-file $keyPath `
        smartmuseum.test admin.smartmuseum.test api.smartmuseum.test localhost 127.0.0.1
    if ($LASTEXITCODE -ne 0) { throw 'mkcert certificate generation failed.' }
    if (!(Test-Path $rootCaPath)) { throw 'mkcert root CA certificate was not found in LocalAppData.' }

    $randomBytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($randomBytes)
    $password = [Convert]::ToBase64String($randomBytes)
    $env:TLS_KEYSTORE_PASSWORD = $password
    try {
        & $opensslPath pkcs12 -export -out $keystorePath -inkey $keyPath -in $certPath `
            -name 'smartmuseum-local' -passout env:TLS_KEYSTORE_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the password-protected local PKCS#12 keystore.' }

        $newLines = @()
        $pathSeen = $false
        $passwordSeen = $false
        foreach ($line in Get-Content -LiteralPath $envFile) {
            if ($line -match '^TLS_KEYSTORE_PATH=') {
                if ($pathSeen) { throw 'Duplicate TLS_KEYSTORE_PATH entries found in dev.env.' }
                $newLines += "TLS_KEYSTORE_PATH=$keystorePath"
                $pathSeen = $true
            } elseif ($line -match '^TLS_KEYSTORE_PASSWORD=') {
                if ($passwordSeen) { throw 'Duplicate TLS_KEYSTORE_PASSWORD entries found in dev.env.' }
                $newLines += "TLS_KEYSTORE_PASSWORD=$password"
                $passwordSeen = $true
            } else { $newLines += $line }
        }
        if (!$pathSeen) { $newLines += "TLS_KEYSTORE_PATH=$keystorePath" }
        if (!$passwordSeen) { $newLines += "TLS_KEYSTORE_PASSWORD=$password" }
        $staging = "$envFile.m2-https-staging"
        Set-Content -LiteralPath $staging -Value $newLines -Encoding utf8
        Move-Item -LiteralPath $staging -Destination $envFile -Force
        $settings.TLS_KEYSTORE_PASSWORD = $password
        $settings.TLS_KEYSTORE_PATH = $keystorePath
    } finally {
        $env:TLS_KEYSTORE_PASSWORD = $null
        $password = $null
        $randomBytes = $null
        $rng.Dispose()
    }
    $settings.TLS_KEYSTORE_PATH = $keystorePath
}

# Verify the certificate chain and each hostname without bypassing TLS checks.
foreach ($hostName in @('smartmuseum.test', 'admin.smartmuseum.test', 'api.smartmuseum.test', 'localhost')) {
    & $opensslPath verify -CAfile $rootCaPath -verify_hostname $hostName $certPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Local HTTPS certificate failed chain or hostname validation for $hostName." }
}
& $opensslPath verify -CAfile $rootCaPath -verify_ip 127.0.0.1 $certPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Local HTTPS certificate failed IP validation for 127.0.0.1.' }
$env:TLS_KEYSTORE_PASSWORD = $settings.TLS_KEYSTORE_PASSWORD
try {
    & $opensslPath pkcs12 -in $keystorePath -noout -passin env:TLS_KEYSTORE_PASSWORD 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Local PKCS#12 keystore password or structure verification failed.' }
} finally { $env:TLS_KEYSTORE_PASSWORD = $null }

Write-Host 'Local HTTPS certificate, Current User CA, hostnames, and password-protected keystore are ready. Secret values were not displayed.'
