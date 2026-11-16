param([switch]$SkipFrontendTests)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
function Invoke-Checked([string]$File, [string[]]$Arguments, [string]$WorkingDirectory) {
    Push-Location $WorkingDirectory
    try {
        & $File @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$File $($Arguments -join ' ') failed with exit code $LASTEXITCODE." }
    } finally { Pop-Location }
}

foreach ($app in @('pwa-client', 'pwa-admin')) {
    $appPath = Join-Path $repoRoot $app
    if (-not (Test-Path (Join-Path $appPath 'node_modules\.bin\vite.cmd')) -and -not (Test-Path (Join-Path $repoRoot 'node_modules\.bin\vite.cmd'))) {
        throw "Node dependencies are missing for $app. Install from the lockfile before building."
    }
    if (-not $SkipFrontendTests) { Invoke-Checked 'npm.cmd' @('test') $appPath }
    $previousApiBaseUrl = [Environment]::GetEnvironmentVariable('VITE_API_BASE_URL', 'Process')
    $previousDataMode = [Environment]::GetEnvironmentVariable('VITE_DATA_MODE', 'Process')
    try {
        # Both PWAs use the public HTTPS API; Admin in api mode requires a real ADMIN sign-in.
        $env:VITE_API_BASE_URL = 'https://api.smartmuseum.test:8443/api'
        $env:VITE_DATA_MODE = 'api'
        Invoke-Checked 'npm.cmd' @('run', 'build') $appPath
    } finally {
        [Environment]::SetEnvironmentVariable('VITE_API_BASE_URL', $previousApiBaseUrl, 'Process')
        [Environment]::SetEnvironmentVariable('VITE_DATA_MODE', $previousDataMode, 'Process')
    }
    Invoke-Checked 'mvn.cmd' @('-f', 'deployment/pom.xml', 'package') $appPath
}
Invoke-Checked 'mvn.cmd' @('-f', 'middleware/pom.xml', 'clean', 'verify') $repoRoot

$artifacts = @(
    'pwa-client/deployment/target/smart-museum-client.war',
    'pwa-admin/deployment/target/smart-museum-admin.war',
    'middleware/core/target/smart-museum-core.war',
    'middleware/iam/target/smart-museum-iam.war',
    'middleware/api/target/smart-museum.war'
)
foreach ($artifact in $artifacts) {
    $path = Join-Path $repoRoot $artifact
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Expected WAR was not created: $artifact" }
    $file = Get-Item -LiteralPath $path
    Write-Host ("Built {0} ({1} bytes, SHA-256 {2})" -f $artifact, $file.Length, (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash)
}
