# Demonstration: Admin decision, Client result

One scenario, about five minutes. It shows discovery, approval, validated ingestion and
zone authorization with the real API. Local URLs are used here; replace them with the
public ones after deployment.

## Before

1. Start the sandbox database and WildFly (`deployment/README.md`).
2. Two zones exist: `salle-01` and `salle-02` (created in DEV with `SEED_DEVICES=true`).
3. Sign in to https://admin.smartmuseum.test/ with your own ADMIN account.
4. **Users**: create a CLIENT account with **only** `salle-01`.
5. Sign in to https://smartmuseum.test/ with that CLIENT account, in a second window beside the Admin.

## Scenario

| # | Who | Action | What to show |
|---|---|---|---|
| 1 | P1 | A new device publishes its Thing Description | Gateway, MQTT, Node-RED, API |
| 2 | P3 | Admin, **Pending approvals** (reload the page), **View Thing Description**, then **Approve** | Properties and units before the decision; "active on the server" after it |
| 3 | P1 | Publish temperature, humidity and pressure | The middleware accepts them now; before the approval it answers `403` |
| 4 | P3 | Wait up to 15 seconds in the Client, without reloading | New cards with value, unit, real/simulated label and "Up to date" |
| 5 | P3 | Admin, **Zones**: change the name and coordinates of `salle-01` | Both change in the Client at its next refresh |
| 6 | P3 | Admin, **Device inventory**, **View details**: assign a location | The Client shows "own position"; the zone does not change |
| 7 | P3 | Client: the zone list | Only `salle-01`; `salle-02` is absent |
| 8 | P3 | Client console (F12): run the request below | `403` from the backend: hiding a zone in the page is not the protection |
| 9 | P3 | Client, **Historical measurements**: **Load history** | Chart and table |

Step 8, in the Client window:

```js
const t = JSON.parse(sessionStorage.getItem('smart-museum.client.session')).accessToken;
(await fetch('https://api.smartmuseum.test/api/measurements/latest?zoneId=salle-02', { headers: { Authorization: 'Bearer ' + t } })).status
```

## If the gateway is not available

Use the protected API routes directly and **say so**: the announcement did not come from a
gateway. The readings are labelled `simulated`.

```powershell
# Run from the repository root. Sandbox only; the token is read from dev.env and never printed.
[Net.ServicePointManager]::SecurityProtocol = 'Tls12'
$token = (Select-String -Path middleware\config\dev.env -Pattern '^INGEST_SERVICE_TOKEN=(.+)$').Matches[0].Groups[1].Value
function Send-Demo($Path, $Body) {
  $json = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 8 -Compress))
  Invoke-RestMethod -Method Post -Uri "https://api.smartmuseum.test/api/$Path" -Headers @{ 'X-Service-Token' = $token } -ContentType 'application/json' -Body $json
}
$device = 'demo-p3-01'; $zone = 'salle-01'; $degC = [char]0x00B0 + 'C'
$units = [ordered]@{ temperature = $degC; humidity = '%'; pressure = 'hPa' }

# Step 1: announce the device (it becomes "pending").
$props = @{}; foreach ($p in $units.Keys) { $props[$p] = @{ type = 'number'; unit = $units[$p]; forms = @(@{ href = "mqtt://localhost:1883/$device/$p" }) } }
Send-Demo 'things' @{ deviceId = $device; zoneId = $zone; gatewayId = 'gw-demo'; type = 'bme280'; td = @{
  '@context' = 'https://www.w3.org/2022/wot/td/v1.1'; id = "urn:museum:device:$device"; title = "Demo sensor $device"
  securityDefinitions = @{ nosec_sc = @{ scheme = 'nosec' } }; security = 'nosec_sc'; properties = $props } }
```

Approve the device in the Admin, then, in the same PowerShell window:

```powershell
# Step 3, after the approval in the Admin: send three readings, labelled simulated.
$values = @{ temperature = 21.5; humidity = 48.2; pressure = 1013.2 }
foreach ($p in $units.Keys) {
  Send-Demo 'ingest/measurements' @{ measurementId = [guid]::NewGuid().ToString(); deviceId = $device; zoneId = $zone; gatewayId = 'gw-demo'
    property = $p; value = $values[$p]; unit = $units[$p]; observedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ'); source = 'simulated'; quality = 'good' }
}
```

## After

Remove the fallback device from the sandbox, and put the original name and coordinates of
`salle-01` back in the Admin:

```powershell
docker exec museum-m2-sandbox-mongo mongosh --quiet museum_m2_sandbox --eval "db.devices.deleteOne({_id:'demo-p3-01'}); db.things.deleteOne({_id:'demo-p3-01'}); db.measurements.deleteMany({deviceId:'demo-p3-01'})"
```

Do not present alerts, thresholds or the user list as implemented features.
