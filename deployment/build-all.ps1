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
    Invoke-Checked 'npm.cmd' @('run', 'build') $appPath
    Invoke-Checked 'mvn.cmd' @('-f', 'deployment/pom.xml', 'package') $appPath
}
Invoke-Checked 'mvn.cmd' @('-f', 'middleware/pom.xml', 'clean', 'verify') $repoRoot

$artifacts = @(
    'pwa-client/deployment/target/smart-museum-client.war',
    'pwa-admin/deployment/target/smart-museum-admin.war',
    'middleware/api/target/smart-museum.war'
)
foreach ($artifact in $artifacts) {
    $path = Join-Path $repoRoot $artifact
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Expected WAR was not created: $artifact" }
    $file = Get-Item -LiteralPath $path
    Write-Host ("Built {0} ({1} bytes, SHA-256 {2})" -f $artifact, $file.Length, (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash)
}
