param([switch]$ConfirmSandboxWrites)

$ErrorActionPreference = 'Stop'
if (-not $ConfirmSandboxWrites) {
    throw 'This acceptance run creates test users, Thing Descriptions, and measurements in museum_m2_sandbox. Rerun with -ConfirmSandboxWrites only for the isolated DEV database.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot 'middleware\config\dev.env'
$settings = @{}
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') { $settings[$Matches[1]] = $Matches[2] }
}
if ($settings.SMART_MUSEUM_ENV -ne 'dev' -or
        $settings.JNOSQL_MONGODB_HOST -ne 'localhost:27018' -or
        $settings.JNOSQL_DOCUMENT_DATABASE -ne 'museum_m2_sandbox') {
    throw 'Refusing acceptance writes unless DEV points only to localhost:27018/museum_m2_sandbox.'
}

$credentialsFile = Join-Path $env:LOCALAPPDATA 'SmartMuseum\M2-TLS\acceptance-admin.json'
$caFile = Join-Path $env:LOCALAPPDATA 'mkcert\rootCA.pem'
if (!(Test-Path $credentialsFile) -or !(Test-Path $caFile)) {
    throw 'The local acceptance ADMIN credential file or mkcert CA file is missing.'
}
$credentials = Get-Content -LiteralPath $credentialsFile -Raw | ConvertFrom-Json
$openssl = (Get-Command openssl.exe -ErrorAction Stop).Source
$results = [System.Collections.Generic.List[object]]::new()
$runId = [Guid]::NewGuid().ToString('N').Substring(0, 10)

function Send-M2HttpsRequest([string]$HostName, [string]$Method, [string]$Path,
        [hashtable]$Headers = @{}, [string]$Body = $null) {
    $request = "$Method $Path HTTP/1.1`r`nHost: ${HostName}:8443`r`nConnection: close`r`n"
    foreach ($key in $Headers.Keys) { $request += "$key`: $($Headers[$key])`r`n" }
    if ($null -ne $Body) {
        if (-not $Headers.ContainsKey('Content-Type')) { $request += "Content-Type: application/json`r`n" }
        $request += "Content-Length: $([Text.Encoding]::UTF8.GetByteCount($Body))`r`n`r`n$Body"
    } elseif ($Method -in @('POST', 'PUT', 'PATCH', 'DELETE')) {
        $request += "Content-Length: 0`r`n`r`n"
    } else { $request += "`r`n" }

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $response = $request | & $script:openssl s_client -quiet -connect "${HostName}:8443" `
        -servername $HostName -verify_hostname $HostName -verify_return_error -CAfile $script:caFile 2>$null
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    if ($exitCode -ne 0) { throw "TLS verification or HTTPS request failed for ${HostName}${Path}." }
    return ($response -join "`n")
}

function Get-M2Status([string]$Response) {
    $match = [regex]::Match($Response, 'HTTP/1\.[01] (\d{3})')
    if (!$match.Success) { return 0 }
    return [int]$match.Groups[1].Value
}

function Get-M2Header([string]$Response, [string]$Name) {
    return [regex]::Match($Response, "(?im)^$([regex]::Escape($Name)): ([^\r\n]+)").Groups[1].Value.Trim()
}

function Get-M2Body([string]$Response) {
    $match = [regex]::Match($Response, "(?s)\r?\n\r?\n(.*)$")
    if (!$match.Success) { return '' }
    return $match.Groups[1].Value.Trim()
}

function Assert-M2Status([string]$Name, [string]$HostName, [string]$Method, [string]$Path,
        [int]$Expected, [hashtable]$Headers = @{}, [string]$Body = $null) {
    $response = Send-M2HttpsRequest $HostName $Method $Path $Headers $Body
    $actual = Get-M2Status $response
    $script:results.Add([pscustomobject]@{Check=$Name;Status=$actual;Pass=($actual -eq $Expected)})
    Write-Host "$Name => HTTP $actual"
    if ($actual -ne $Expected) { throw "$Name expected HTTP $Expected but received $actual." }
    return $response
}

function New-RandomPassword {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes); return [Convert]::ToBase64String($bytes) }
    finally { $rng.Dispose(); $bytes = $null }
}

function ConvertTo-Base64Url([byte[]]$Bytes) {
    return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Copy-M2Map([System.Collections.IDictionary]$Source) {
    $copy = [ordered]@{}
    foreach ($key in $Source.Keys) { $copy[$key] = $Source[$key] }
    return $copy
}

function Update-SandboxUser([string]$UserId, [string]$Field, [string]$Value) {
    if ($Field -notin @('status', 'role')) { throw 'Unsupported sandbox user test field.' }
    $js = "const r=db.users.updateOne({userId: '$UserId'}, {`$set: {${Field}: '$Value'}}); print(r.matchedCount)"
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = & docker.exe exec museum-m2-sandbox-mongo mongosh --quiet museum_m2_sandbox --eval $js 2>$null
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    if ($exitCode -ne 0 -or (($out -join '').Trim() -ne '1')) {
        throw "Could not update the test account $Field in museum_m2_sandbox."
    }
}

# TLS, health, virtual host, and internal/public route separation.
foreach ($item in @(
    @{Host='localhost';Path='/core/health';Name='CORE health'},
    @{Host='localhost';Path='/iam/health';Name='IAM health'},
    @{Host='api.smartmuseum.test';Path='/api/health';Name='API health'})) {
    $response = Assert-M2Status $item.Name $item.Host GET $item.Path 200
    $health = Get-M2Body $response | ConvertFrom-Json
    if ($health.status -ne 'UP' -or $health.mongo -ne 'UP') { throw "$($item.Name) returned unhealthy JSON." }
}
foreach ($item in @(
    @{Host='smartmuseum.test';Path='/';Name='Client root'},
    @{Host='admin.smartmuseum.test';Path='/';Name='Admin root'})) {
    $response = Assert-M2Status $item.Name $item.Host GET $item.Path 200
    if ((Get-M2Header $response 'Content-Type') -notmatch 'text/html') { throw "$($item.Name) did not return HTML." }
}
$manifest = Assert-M2Status 'Client manifest' 'smartmuseum.test' GET '/manifest.webmanifest' 200
if ((Get-M2Header $manifest 'Content-Type') -notmatch 'application/manifest\+json') { throw 'Client manifest MIME type is incorrect.' }
$worker = Assert-M2Status 'Client service worker' 'smartmuseum.test' GET '/service-worker.js' 200
if ((Get-M2Header $worker 'Content-Type') -notmatch 'javascript') { throw 'Client service-worker MIME type is incorrect.' }
Assert-M2Status 'Public API does not expose CORE paths' 'api.smartmuseum.test' GET '/core/internal/core/devices' 404 | Out-Null
Assert-M2Status 'Public API does not expose IAM paths' 'api.smartmuseum.test' GET '/iam/internal/iam/login' 404 | Out-Null

# CORS must accept the exact HTTPS Client origin and reject others.
$allowedCors = Assert-M2Status 'Approved Client CORS preflight' 'api.smartmuseum.test' OPTIONS '/api/health' 200 `
    @{Origin='https://smartmuseum.test:8443';'Access-Control-Request-Method'='GET';'Access-Control-Request-Headers'='authorization'}
if ((Get-M2Header $allowedCors 'Access-Control-Allow-Origin') -ne 'https://smartmuseum.test:8443') { throw 'Approved CORS origin was not returned.' }
$deniedCors = Assert-M2Status 'Unapproved CORS preflight' 'api.smartmuseum.test' OPTIONS '/api/health' 403 `
    @{Origin='https://unapproved.example';'Access-Control-Request-Method'='GET';'Access-Control-Request-Headers'='authorization'}
if (Get-M2Header $deniedCors 'Access-Control-Allow-Origin') { throw 'Unapproved CORS origin received an allow header.' }

# Authentication: the accepted password must produce a safe DTO and signed JWT.
$adminLoginBody = @{email=$credentials.email;password=$credentials.password} | ConvertTo-Json -Compress
$adminLoginResponse = Assert-M2Status 'Valid ADMIN login' 'api.smartmuseum.test' POST '/api/auth/login' 200 @{} $adminLoginBody
$adminLogin = Get-M2Body $adminLoginResponse | ConvertFrom-Json
if ($adminLogin.tokenType -ne 'Bearer' -or !$adminLogin.accessToken -or !$adminLogin.user.userId) { throw 'Valid ADMIN login response is incomplete.' }
if ((Get-M2Body $adminLoginResponse) -match 'passwordHash|password\s*":') { throw 'Login response contains a password field.' }
$adminToken = $adminLogin.accessToken
$tokenParts = $adminToken.Split('.')
if ($tokenParts.Count -ne 3) { throw 'ADMIN access token is not a JWT.' }
$payload = $tokenParts[1].Replace('-', '+').Replace('_', '/')
while (($payload.Length % 4) -ne 0) { $payload += '=' }
$claims = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
if ($claims.iss -ne 'smart-museum' -or $claims.role -ne 'ADMIN' -or $claims.exp -le [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) {
    throw 'ADMIN JWT issuer, role, or expiry is incorrect.'
}
$results.Add([pscustomobject]@{Check='ADMIN JWT claims and safe DTO';Status=200;Pass=$true})

$wrongBody = @{email=$credentials.email;password='incorrect-acceptance-password'} | ConvertTo-Json -Compress
Assert-M2Status 'Wrong ADMIN password' 'api.smartmuseum.test' POST '/api/auth/login' 401 @{} $wrongBody | Out-Null
$unknownBody = @{email="unknown-$runId@example.test";password=(New-RandomPassword)} | ConvertTo-Json -Compress
Assert-M2Status 'Unknown account login' 'api.smartmuseum.test' POST '/api/auth/login' 401 @{} $unknownBody | Out-Null
Assert-M2Status 'Missing login credentials' 'api.smartmuseum.test' POST '/api/auth/login' 400 @{} '{}' | Out-Null
Assert-M2Status 'Missing bearer token' 'api.smartmuseum.test' GET '/api/devices' 401 | Out-Null
Assert-M2Status 'Malformed bearer token' 'api.smartmuseum.test' GET '/api/devices' 401 @{Authorization='Bearer abc.def.ghi'} | Out-Null

# Internal token protection and API-to-IAM rejection path.
$emptyCreds = @{email="unknown-$runId@example.test";password=(New-RandomPassword)} | ConvertTo-Json -Compress
Assert-M2Status 'CORE internal token required' 'localhost' GET '/core/internal/core/devices/no-such-m2-device' 401 | Out-Null
Assert-M2Status 'IAM internal token required' 'localhost' POST '/iam/internal/iam/login' 401 @{} $emptyCreds | Out-Null
$tokenHeaders = @{'X-Internal-Service-Token'=$settings.INTER_SERVICE_TOKEN}
Assert-M2Status 'CORE internal token accepted before lookup' 'localhost' GET '/core/internal/core/devices/no-such-m2-device' 404 $tokenHeaders | Out-Null
$fakeLogin = Assert-M2Status 'API to IAM HTTP integration' 'api.smartmuseum.test' POST '/api/auth/login' 401 @{} $emptyCreds
if ((Get-M2Body $fakeLogin) -match 'service unavailable|connection refused') { throw 'API-to-IAM call failed at the service boundary.' }

# Register two isolated test devices and verify discovery, approval, trust, and ingestion.
$primaryId = "m2acc-$runId"
$rejectedId = "m2rej-$runId"
function New-TestThing([string]$DeviceId) {
    $td = [ordered]@{
        '@context'='https://www.w3.org/2022/wot/td/v1.1'
        id="urn:museum:device:$DeviceId"
        title="M2 acceptance $DeviceId"
        securityDefinitions=@{nosec_sc=@{scheme='nosec'}}
        security='nosec_sc'
        properties=@{temperature=@{type='number';unit='Cel';forms=@(@{href="mqtt://localhost:1883/$DeviceId/temperature"})}}
    }
    return (@{deviceId=$DeviceId;zoneId='salle-01';gatewayId='m2-acceptance-gateway';type='m2-acceptance';td=$td} | ConvertTo-Json -Depth 20 -Compress)
}
$serviceHeaders = @{'X-Service-Token'=$settings.INGEST_SERVICE_TOKEN}
$thingBody = New-TestThing $primaryId
Assert-M2Status 'Thing registration requires service token' 'api.smartmuseum.test' POST '/api/things' 401 @{} $thingBody | Out-Null
Assert-M2Status 'Thing registration rejects bad service token' 'api.smartmuseum.test' POST '/api/things' 401 @{'X-Service-Token'='invalid-service-token'} $thingBody | Out-Null
$registration = Assert-M2Status 'Thing registration creates pending device' 'api.smartmuseum.test' POST '/api/things' 201 $serviceHeaders $thingBody
$registered = Get-M2Body $registration | ConvertFrom-Json
if ($registered.deviceStatus -ne 'pending' -or (Get-M2Header $registration 'Location') -notmatch "/api/things/$primaryId" -or !(Get-M2Header $registration 'Link')) {
    throw 'Thing registration status, Location, or Link contract is incorrect.'
}
Assert-M2Status 'Thing re-announcement is idempotent' 'api.smartmuseum.test' POST '/api/things' 200 $serviceHeaders $thingBody | Out-Null
$tdResponse = Assert-M2Status 'ADMIN retrieves Thing Description' 'api.smartmuseum.test' GET "/api/things/$primaryId" 200 @{Authorization="Bearer $adminToken"}
if ((Get-M2Header $tdResponse 'Content-Type') -notmatch 'application/td\+json' -or !(Get-M2Header $tdResponse 'Link')) { throw 'Thing retrieval media type or Link header is incorrect.' }
$deviceResponse = Assert-M2Status 'ADMIN retrieves device detail' 'api.smartmuseum.test' GET "/api/devices/$primaryId" 200 @{Authorization="Bearer $adminToken"}
if (!(Get-M2Header $deviceResponse 'Link')) { throw 'Device detail is missing the describedby Link header.' }
Assert-M2Status 'ADMIN approves pending device' 'api.smartmuseum.test' POST "/api/devices/$primaryId/approve" 200 @{Authorization="Bearer $adminToken"} | Out-Null

$measurementId = [Guid]::NewGuid().ToString()
$measurement = [ordered]@{measurementId=$measurementId;deviceId=$primaryId;zoneId='salle-01';gatewayId='m2-acceptance-gateway';property='temperature';value=23.4;unit='Cel';observedAt=[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ');source='simulated';quality='good'}
$measurementBody = $measurement | ConvertTo-Json -Compress
Assert-M2Status 'Ingest requires service token' 'api.smartmuseum.test' POST '/api/ingest/measurements' 401 @{} $measurementBody | Out-Null
Assert-M2Status 'Valid measurement ingestion' 'api.smartmuseum.test' POST '/api/ingest/measurements' 202 $serviceHeaders $measurementBody | Out-Null
$duplicate = Assert-M2Status 'Duplicate measurement is idempotent' 'api.smartmuseum.test' POST '/api/ingest/measurements' 200 $serviceHeaders $measurementBody
if ((Get-M2Body $duplicate) -notmatch 'duplicate') { throw 'Duplicate ingestion response body is incorrect.' }
$outOfRange = Copy-M2Map $measurement; $outOfRange.measurementId=[Guid]::NewGuid().ToString(); $outOfRange.value=100
Assert-M2Status 'Out-of-range measurement rejected' 'api.smartmuseum.test' POST '/api/ingest/measurements' 422 $serviceHeaders ($outOfRange|ConvertTo-Json -Compress) | Out-Null
$wrongUnit = Copy-M2Map $measurement; $wrongUnit.measurementId=[Guid]::NewGuid().ToString(); $wrongUnit.unit='F'
Assert-M2Status 'Thing unit mismatch rejected' 'api.smartmuseum.test' POST '/api/ingest/measurements' 422 $serviceHeaders ($wrongUnit|ConvertTo-Json -Compress) | Out-Null
$unknownProperty = Copy-M2Map $measurement; $unknownProperty.measurementId=[Guid]::NewGuid().ToString(); $unknownProperty.property='humidity'
Assert-M2Status 'Undeclared Thing property rejected' 'api.smartmuseum.test' POST '/api/ingest/measurements' 422 $serviceHeaders ($unknownProperty|ConvertTo-Json -Compress) | Out-Null
$invalidMeasurement = @{deviceId=$primaryId;zoneId='salle-01'} | ConvertTo-Json -Compress
Assert-M2Status 'Invalid measurement schema rejected' 'api.smartmuseum.test' POST '/api/ingest/measurements' 400 $serviceHeaders $invalidMeasurement | Out-Null

$rejectedBody = New-TestThing $rejectedId
Assert-M2Status 'Register second pending device' 'api.smartmuseum.test' POST '/api/things' 201 $serviceHeaders $rejectedBody | Out-Null
$pendingMeasurement = Copy-M2Map $measurement; $pendingMeasurement.measurementId=[Guid]::NewGuid().ToString(); $pendingMeasurement.deviceId=$rejectedId
Assert-M2Status 'Pending device is untrusted' 'api.smartmuseum.test' POST '/api/ingest/measurements' 403 $serviceHeaders ($pendingMeasurement|ConvertTo-Json -Compress) | Out-Null
Assert-M2Status 'ADMIN rejects pending device' 'api.smartmuseum.test' POST "/api/devices/$rejectedId/reject" 200 @{Authorization="Bearer $adminToken"} | Out-Null
Assert-M2Status 'Rejected device cannot ingest' 'api.smartmuseum.test' POST '/api/ingest/measurements' 403 $serviceHeaders ($pendingMeasurement|ConvertTo-Json -Compress) | Out-Null

# Create scoped and empty-zone CLIENT accounts using the ADMIN API boundary.
$clientEmail = "m2-client-$runId@example.test"
$clientPassword = New-RandomPassword
$clientProvision = @{name='M2 acceptance client';email=$clientEmail;password=$clientPassword;zoneIds=@('salle-01')} | ConvertTo-Json -Compress
$clientResponse = Assert-M2Status 'ADMIN provisions CLIENT through API/IAM' 'api.smartmuseum.test' POST '/api/users' 201 @{Authorization="Bearer $adminToken"} $clientProvision
if ((Get-M2Body $clientResponse) -match 'passwordHash') { throw 'Provisioned user DTO contains password hash.' }
$clientAccount = Get-M2Body $clientResponse | ConvertFrom-Json
$clientLogin = Assert-M2Status 'Valid CLIENT login' 'api.smartmuseum.test' POST '/api/auth/login' 200 @{} (@{email=$clientEmail;password=$clientPassword}|ConvertTo-Json -Compress)
$clientSession = Get-M2Body $clientLogin | ConvertFrom-Json
$clientToken = $clientSession.accessToken
if ($clientSession.user.role -ne 'CLIENT') { throw 'Provisioned account did not authenticate as CLIENT.' }
$clientDevices = Assert-M2Status 'CLIENT lists only assigned zone' 'api.smartmuseum.test' GET '/api/devices' 200 @{Authorization="Bearer $clientToken"}
$clientDeviceRows = @(Get-M2Body $clientDevices | ConvertFrom-Json)
if ($clientDeviceRows.Where({$_.zoneId -ne 'salle-01'}).Count -gt 0) { throw 'CLIENT received a device from an unassigned zone.' }
Assert-M2Status 'CLIENT denied unassigned device' 'api.smartmuseum.test' GET '/api/devices/sim-bme280-02' 403 @{Authorization="Bearer $clientToken"} | Out-Null
Assert-M2Status 'CLIENT denied approval' 'api.smartmuseum.test' POST "/api/devices/$rejectedId/approve" 403 @{Authorization="Bearer $clientToken"} | Out-Null
Assert-M2Status 'CLIENT denied rejection' 'api.smartmuseum.test' POST "/api/devices/$rejectedId/reject" 403 @{Authorization="Bearer $clientToken"} | Out-Null
Assert-M2Status 'CLIENT reads assigned-zone measurements' 'api.smartmuseum.test' GET '/api/measurements/latest?zoneId=salle-01' 200 @{Authorization="Bearer $clientToken"} | Out-Null
Assert-M2Status 'CLIENT denied unassigned-zone measurements' 'api.smartmuseum.test' GET '/api/measurements/latest?zoneId=salle-02' 403 @{Authorization="Bearer $clientToken"} | Out-Null

$emptyEmail = "m2-empty-client-$runId@example.test"
$emptyPassword = New-RandomPassword
$emptyProvision = @{name='M2 empty-zone client';email=$emptyEmail;password=$emptyPassword;zoneIds=@()} | ConvertTo-Json -Compress
Assert-M2Status 'ADMIN provisions empty-zone CLIENT' 'api.smartmuseum.test' POST '/api/users' 201 @{Authorization="Bearer $adminToken"} $emptyProvision | Out-Null
$emptyLogin = Assert-M2Status 'Empty-zone CLIENT login' 'api.smartmuseum.test' POST '/api/auth/login' 200 @{} (@{email=$emptyEmail;password=$emptyPassword}|ConvertTo-Json -Compress)
$emptyToken = (Get-M2Body $emptyLogin | ConvertFrom-Json).accessToken
$emptyDevices = Assert-M2Status 'Empty-zone CLIENT inventory' 'api.smartmuseum.test' GET '/api/devices' 200 @{Authorization="Bearer $emptyToken"}
$emptyDeviceBody = Get-M2Body $emptyDevices
if ($emptyDeviceBody -ne '[]') { throw 'Empty-zone CLIENT received device inventory.' }
Assert-M2Status 'Empty-zone CLIENT denied device detail' 'api.smartmuseum.test' GET '/api/devices/bme280-01' 403 @{Authorization="Bearer $emptyToken"} | Out-Null

# Use a signed but expired JWT, then verify that current Mongo account status and role are re-read.
$jwtHeader = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes('{"alg":"HS256","typ":"JWT"}'))
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$expiredPayload = @{sub=$adminLogin.user.userId;role='ADMIN';iss='smart-museum';iat=($now-300);exp=($now-60)} | ConvertTo-Json -Compress
$jwtPayload = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($expiredPayload))
$hmac = [Security.Cryptography.HMACSHA256]::new([Convert]::FromBase64String($settings.JWT_SIGNING_KEY_BASE64))
try { $jwtSignature = ConvertTo-Base64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$jwtHeader.$jwtPayload"))) }
finally { $hmac.Dispose() }
$expiredToken = "$jwtHeader.$jwtPayload.$jwtSignature"
Assert-M2Status 'Expired signed JWT rejected' 'api.smartmuseum.test' GET '/api/devices' 401 @{Authorization="Bearer $expiredToken"} | Out-Null
 $statusChanged = $false
try {
    Update-SandboxUser $clientAccount.userId 'status' 'disabled'
    $statusChanged = $true
    Assert-M2Status 'Disabled CLIENT token invalidated' 'api.smartmuseum.test' GET '/api/devices' 401 @{Authorization="Bearer $clientToken"} | Out-Null
} finally { if ($statusChanged) { Update-SandboxUser $clientAccount.userId 'status' 'active' } }
$roleChanged = $false
try {
    Update-SandboxUser $clientAccount.userId 'role' 'ADMIN'
    $roleChanged = $true
    Assert-M2Status 'Changed-role CLIENT token invalidated' 'api.smartmuseum.test' GET '/api/devices' 401 @{Authorization="Bearer $clientToken"} | Out-Null
} finally { if ($roleChanged) { Update-SandboxUser $clientAccount.userId 'role' 'CLIENT' } }
Assert-M2Status 'Restored CLIENT token remains valid' 'api.smartmuseum.test' GET '/api/devices' 200 @{Authorization="Bearer $clientToken"} | Out-Null

# Build confirmation and failure-log scan; neither prints secrets or full request data.
$wildflyHome = $env:WILDFLY_HOME
if (!$wildflyHome) { $wildflyHome = 'C:\wildfly-41.0.1.Final\wildfly-42.0.0.Final' }
$env:NOPAUSE = 'true'
$deploymentInfo = & (Join-Path $wildflyHome 'bin\jboss-cli.bat') --connect --command=deployment-info 2>&1 | Out-String
foreach ($war in @('smart-museum-client.war','smart-museum-admin.war','smart-museum-core.war','smart-museum-iam.war','smart-museum.war')) {
    if ($deploymentInfo -notmatch "(?m)^$([regex]::Escape($war))\s+\S+\s+\S+\s+true\s+OK\s*$") {
        throw "WildFly does not report $war as enabled and OK."
    }
}
$results.Add([pscustomobject]@{Check='All five WildFly deployments enabled and OK';Status='OK';Pass=$true})

$results | Format-Table -AutoSize
Write-Host 'Acceptance tests passed. Test-only users, Thing Descriptions, and measurements remain in museum_m2_sandbox.'
