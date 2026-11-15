param(
    [Parameter(Mandatory = $true)][string]$WildFlyHome,
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if (!$EnvFile) { $EnvFile = Join-Path $repoRoot 'middleware\config\dev.env' }
if (!(Test-Path -LiteralPath $EnvFile -PathType Leaf)) { throw 'DEV environment file is missing.' }
$settings = @{}
foreach ($line in Get-Content -LiteralPath $EnvFile) {
    if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') { $settings[$Matches[1]] = $Matches[2] }
}
if ($settings.SMART_MUSEUM_ENV -ne 'dev' -or
        $settings.JNOSQL_DOCUMENT_DATABASE -ne 'museum_m2_sandbox' -or
        $settings.TLS_KEYSTORE_PATH -notmatch '\.p12$' -or
        !(Test-Path -LiteralPath $settings.TLS_KEYSTORE_PATH -PathType Leaf) -or
        [string]::IsNullOrWhiteSpace($settings.TLS_KEYSTORE_PASSWORD)) {
    throw 'DEV sandbox and local PKCS#12 settings must be ready before configuring WildFly HTTPS.'
}

$config = Join-Path $WildFlyHome 'standalone\configuration\standalone.xml'
if (!(Test-Path -LiteralPath $config -PathType Leaf)) { throw 'WildFlyHome must contain standalone\configuration\standalone.xml.' }
$xmlText = [IO.File]::ReadAllText($config)
$expectedResource = '<file path="${env.TLS_KEYSTORE_PATH}"/>'
if ($xmlText.Contains('name="museumLocalDevKS"')) {
    if (!$xmlText.Contains($expectedResource) -or
            !$xmlText.Contains('ssl-context="museumLocalDevSSC"')) {
        throw 'M2 HTTPS resources already exist but do not match the expected environment-backed setup; inspect manually.'
    }
    Write-Host 'WildFly already references the separate M2 local HTTPS keystore and SSL context.'
    return
}
if (Get-NetTCPConnection -State Listen -LocalPort 9990 -ErrorAction SilentlyContinue) {
    throw 'WildFly management is listening. Stop WildFly cleanly before changing standalone.xml.'
}

$keyStore = @'
                    <key-store name="museumLocalDevKS">
                        <credential-reference clear-text="${env.TLS_KEYSTORE_PASSWORD}"/>
                        <implementation type="PKCS12"/>
                        <file path="${env.TLS_KEYSTORE_PATH}"/>
                    </key-store>
'@
$keyManager = @'
                    <key-manager name="museumLocalDevKM" key-store="museumLocalDevKS">
                        <credential-reference clear-text="${env.TLS_KEYSTORE_PASSWORD}"/>
                    </key-manager>
'@
$sslContext = @'
                    <server-ssl-context name="museumLocalDevSSC" key-manager="museumLocalDevKM"/>
'@
foreach ($entry in @(@('<key-stores>', $keyStore), @('<key-managers>', $keyManager), @('<server-ssl-contexts>', $sslContext))) {
    if ([regex]::Matches($xmlText, [regex]::Escape($entry[0])).Count -ne 1) {
        throw "Expected exactly one Elytron XML element $($entry[0]); no configuration was changed."
    }
    $xmlText = $xmlText.Replace($entry[0], $entry[0] + $entry[1])
}
$oldListener = 'ssl-context="applicationSSC"'
if ([regex]::Matches($xmlText, [regex]::Escape($oldListener)).Count -ne 1) {
    throw 'Expected one HTTPS listener using applicationSSC; no configuration was changed.'
}
$xmlText = $xmlText.Replace($oldListener, 'ssl-context="museumLocalDevSSC"')
$parsed = New-Object System.Xml.XmlDocument
$parsed.LoadXml($xmlText)

$backupDir = Join-Path (Split-Path $config) 'm2-backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backup = Join-Path $backupDir ('standalone-before-m2-tls-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.xml')
Copy-Item -LiteralPath $config -Destination $backup
$sourceHash = (Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash
if ((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash -ne $sourceHash) {
    throw 'WildFly standalone.xml backup verification failed; configuration was not changed.'
}
$staging = "$config.m2-staging"
[IO.File]::WriteAllText($staging, $xmlText, [Text.UTF8Encoding]::new($false))
$verify = New-Object System.Xml.XmlDocument
$verify.Load($staging)
Move-Item -LiteralPath $staging -Destination $config -Force
Write-Host "WildFly HTTPS configuration updated. Verified backup: $backup (SHA-256 $sourceHash). The original applicationKS/applicationKM/applicationSSC resources were preserved."
