# Smart Museum - Local WildFly Testing Guide (Windows)

This guide lets a new developer pull `main` on a Windows laptop and run the full
Smart Museum stack locally:

- Client PWA on its own HTTPS origin
- Admin PWA on its own HTTPS origin
- Public API on its own HTTPS origin
- CORE and IAM as separate internal WildFly services
- MongoDB sandbox in Docker
- Local TLS certificates trusted by the browser

The guide covers first-time setup, verification, demo accounts, demo data, manual
test scenarios, the automated acceptance suite, updates, and troubleshooting.

> **Scope:** this is a local development topology only. It binds to `127.0.0.1`
> and is not a production deployment.

---

## 1. Architecture and URL map

| Application | WAR | Context | Undertow host / server | URL |
|---|---|---|---|---|
| Client PWA | `smart-museum-client.war` | `/` | `smartmuseum-host` on `default-server` | https://smartmuseum.test/ |
| Admin PWA | `smart-museum-admin.war` | `/` | `admin-smartmuseum-host` on `default-server` | https://admin.smartmuseum.test/ |
| Public API | `smart-museum.war` | `/api` | `api-smartmuseum-host` on `default-server` | https://api.smartmuseum.test/api/health |
| CORE | `smart-museum-core.war` | `/core` | `internal-host` on `internal-server` | http://localhost:8080/core/health (internal only) |
| IAM | `smart-museum-iam.war` | `/iam` | `internal-host` on `internal-server` | http://localhost:8080/iam/health (internal only) |

Ports after setup:

| Port | Purpose |
|---|---|
| 80 | Public HTTP, redirects to HTTPS only |
| 443 | Public HTTPS (Client, Admin, API) |
| 8080 | Internal CORE/IAM, loopback only |
| 9990 | WildFly management, loopback only |
| 27018 | MongoDB sandbox, loopback only |

CORE and IAM require the `X-Internal-Service-Token` header. The public API calls
them through `CORE_SERVICE_URL` and `IAM_SERVICE_URL`. They must never be exposed
on ports 80/443.

---

## 2. Prerequisites

### 2.1 Required software

| Tool | Version | Notes |
|---|---|---|
| Windows | 10/11 | PowerShell 5.1 or newer |
| Git | current | Needed to pull `main` |
| Java | 21 | WildFly 42 and the Maven build use Java 21 |
| Maven | 3.9+ | Builds the Java WARs |
| Node.js | 20.19+ or 22.12+ | Builds both Vite PWAs |
| npm | bundled with Node | |
| Docker Desktop | current | Runs the MongoDB sandbox |
| WildFly | **42.0.0.Final** | The deployment scripts assume its default `standalone.xml` |
| mkcert | 1.4+ | Creates the local CA and certificate |
| OpenSSL | 3.x | Packages the certificate as PKCS#12 and verifies TLS |

### 2.2 Install (winget examples)

Run in a normal PowerShell window:

```powershell
winget install --id Git.Git -e
winget install --id EclipseAdoptium.Temurin.21.JDK -e
winget install --id Apache.Maven -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Docker.DockerDesktop -e
winget install --id FiloSottile.mkcert -e --scope user
winget install --id ShiningLight.OpenSSL.Light -e
```

If a package ID is unavailable on your machine, search with `winget search <name>`
and install the matching package. Open a new PowerShell window after installing
so `PATH` is refreshed.

### 2.3 Install WildFly 42.0.0.Final

1. Download WildFly **42.0.0.Final** from https://wildfly.org/downloads/.
2. Extract it to a simple path, for example `C:\wildfly-42.0.0.Final`.
3. Do not edit `standalone.xml` manually. The project scripts do it with backups.
4. Keep the management interface private. The scripts bind it to `127.0.0.1`.

Set the path for the rest of the setup:

```powershell
$wildflyHome = 'C:\wildfly-42.0.0.Final'
Test-Path (Join-Path $wildflyHome 'bin\standalone.bat')   # must be True
```

### 2.4 Verify the tools

```powershell
java -version
mvn -v
node -v
npm -v
docker --version
mkcert -version
openssl version
```

All commands must succeed. If `mkcert` or `openssl` is not found, reopen
PowerShell or fix `PATH` before continuing.

### 2.5 Start Docker Desktop

Start Docker Desktop and wait until it reports it is running:

```powershell
docker info
```

`docker info` must exit with code 0 before you continue.

---

## 3. First-time setup (new laptop)

Run every command from the repository root unless a step says otherwise.

### Step 1 - Clone and check out `main`

```powershell
git clone https://github.com/sourourjaouadi/SMART-MUSEUM.git
Set-Location .\SMART-MUSEUM
git checkout main
git pull origin main
```

If the repository is already cloned:

```powershell
Set-Location .\SMART-MUSEUM
git checkout main
git pull origin main
```

### Step 2 - Add the local hostnames

The PWAs and API use three local hostnames. Add them to the Windows hosts file
with an elevated editor:

```powershell
Start-Process notepad.exe -Verb RunAs -ArgumentList "$env:SystemRoot\System32\drivers\etc\hosts"
```

Add these lines at the end and save:

```text
127.0.0.1 smartmuseum.test
127.0.0.1 admin.smartmuseum.test
127.0.0.1 api.smartmuseum.test
```

Verify from a normal PowerShell window:

```powershell
Resolve-DnsName smartmuseum.test
Resolve-DnsName admin.smartmuseum.test
Resolve-DnsName api.smartmuseum.test
```

Each must resolve to `127.0.0.1`.

### Step 3 - Start the MongoDB sandbox

The sandbox uses `localhost:27018` and the database `museum_m2_sandbox`. It does
not touch any other MongoDB data.

```powershell
docker compose -f .\middleware\docker-compose.m2-sandbox.yml up -d
docker ps --filter "name=museum-m2-sandbox-mongo"
```

Expected: the container is `Up` and publishes `127.0.0.1:27018->27017/tcp`.

### Step 4 - Create your own DEV environment and ADMIN account

This creates `middleware\config\dev.env` (gitignored) with your own random
service tokens and JWT key. The sandbox ADMIN account is created by IAM the first
time the IAM WAR starts with this `dev.env` (Step 10).

```powershell
.\deployment\initialize-dev-environment.ps1 -CreateBootstrapAdmin -WriteAcceptanceCredentials
```

You are prompted for:

- sandbox administrator display name
- sandbox administrator email
- sandbox administrator password (12 to 72 bytes, not echoed)

The script also writes `%LOCALAPPDATA%\SmartMuseum\M2-TLS\acceptance-admin.json`
for the automated acceptance test. That file stays outside the repository and is
readable only by your Windows user.

> `dev.env` must not be committed. It contains secrets and is already ignored by
> Git. Do not copy another developer's `dev.env`.

If `dev.env` already exists, the script refuses to overwrite it. Use
`-RotateSecrets` only when you intentionally want new tokens and a new JWT key;
existing sessions become invalid.

### Step 5 - Create the local HTTPS certificate and keystore

WildFly must be stopped for this step.

```powershell
.\deployment\prepare-local-https.ps1
```

This script:

- installs the mkcert CA into your current-user Windows trust store;
- creates a certificate for `smartmuseum.test`, `admin.smartmuseum.test`,
  `api.smartmuseum.test`, `localhost`, and `127.0.0.1`;
- packages it as a password-protected PKCS#12 keystore under
  `%LOCALAPPDATA%\SmartMuseum\M2-TLS`;
- writes `TLS_KEYSTORE_PATH` and `TLS_KEYSTORE_PASSWORD` into your `dev.env`;
- verifies the chain, hostnames, and keystore password without printing secrets.

Expected final line: `Local HTTPS certificate, Current User CA, hostnames, and
password-protected keystore are ready.`

### Step 6 - Point WildFly at the local keystore

WildFly must be stopped for this step.

```powershell
$wildflyHome = 'C:\wildfly-42.0.0.Final'
.\deployment\configure-wildfly-https.ps1 -WildFlyHome $wildflyHome
```

This creates a timestamped backup of `standalone.xml`, adds the environment-backed
`museumLocalDevKS` / `museumLocalDevKM` / `museumLocalDevSSC` resources, and
switches the HTTPS listener to the new SSL context. The original
`applicationKS` / `applicationKM` / `applicationSSC` resources are preserved.

### Step 7 - First WildFly start and virtual-host creation

Open a **second PowerShell window** for WildFly because `start-wildfly.ps1` runs
in the foreground and blocks. In that window:

```powershell
Set-Location 'C:\path\to\SMART-MUSEUM'   # replace with your clone path
$wildflyHome = 'C:\wildfly-42.0.0.Final'
.\deployment\start-wildfly.ps1 -Profile dev -WildFlyHome $wildflyHome
```

This first start is only for virtual-host creation; it still uses WildFly's
default ports (8080/8443/9990). The public 80/443 layout is applied in Step 8.

Wait for the log line:

```text
WildFly 42.0.0.Final ... started
```

In the first PowerShell window, create the Client, Admin, and API virtual hosts:

```powershell
$wildflyHome = 'C:\wildfly-42.0.0.Final'
.\deployment\configure-wildfly-hosts.ps1 -WildFlyHome $wildflyHome
```

Expected: the CLI reports the three hosts and their aliases. If a host already
exists, the script prints its current alias and does not replace it.

Now stop WildFly:

```powershell
.\deployment\stop-wildfly.ps1 -ConfirmStop -WildFlyHome $wildflyHome
```

### Step 8 - Apply the standard ports and internal server

WildFly must be stopped for this step.

```powershell
$wildflyHome = 'C:\wildfly-42.0.0.Final'
.\deployment\configure-wildfly-ports.ps1 -WildFlyHome $wildflyHome
```

This does three things:

- public HTTP on port 80 and HTTPS on port 443;
- a port-80 filter that answers every request with a `302` to
  `https://<host><path>` (no port);
- a separate `internal-server` with `internal-host` on `127.0.0.1:8080` for
  CORE and IAM.

It writes a timestamped, SHA-256-verified backup of `standalone.xml` before
changing it. Ports 80, 443, 8080, 8443, and 9990 must be free.

> Order matters: `configure-wildfly-hosts.ps1` connects to a running server, and
> the standard-ports CLI adds redirect filters to the three PWA/API hosts, so the
> hosts must exist before this step. `configure-wildfly-https.ps1` and
> `configure-wildfly-ports.ps1` both edit `standalone.xml` offline.

### Step 9 - Build all five artifacts

```powershell
.\deployment\build-all.ps1
```

This runs the frontend tests and builds both PWAs, then runs the full Maven
`clean verify` for contracts, CORE, IAM, and API. It prints the SHA-256 of each
WAR.

To skip the frontend tests while iterating:

```powershell
.\deployment\build-all.ps1 -SkipFrontendTests
```

Expected artifacts:

```text
pwa-client\deployment\target\smart-museum-client.war
pwa-admin\deployment\target\smart-museum-admin.war
middleware\core\target\smart-museum-core.war
middleware\iam\target\smart-museum-iam.war
middleware\api\target\smart-museum.war
```

### Step 10 - First-time deployment

WildFly is stopped after Step 8. Copy the five WARs into the deployment scanner
directory, then start WildFly. On a fresh installation there is no previous API
WAR, so use the direct copy for the initial deployment; the guarded
`deploy-api.ps1` / `deploy-middleware.ps1` scripts are for later updates.

```powershell
$wildflyHome = 'C:\wildfly-42.0.0.Final'
$deployments = Join-Path $wildflyHome 'standalone\deployments'

Copy-Item .\pwa-client\deployment\target\smart-museum-client.war $deployments
Copy-Item .\pwa-admin\deployment\target\smart-museum-admin.war $deployments
Copy-Item .\middleware\core\target\smart-museum-core.war $deployments
Copy-Item .\middleware\iam\target\smart-museum-iam.war $deployments
Copy-Item .\middleware\api\target\smart-museum.war $deployments
```

Start WildFly in its own PowerShell window:

```powershell
.\deployment\start-wildfly.ps1 -Profile dev -WildFlyHome $wildflyHome
```

Wait for `WildFly ... started`, then confirm the five deployments:

```powershell
.\deployment\check-deployments.ps1 -WildFlyHome $wildflyHome
```

You can also look for the marker files:

```powershell
Get-ChildItem (Join-Path $wildflyHome 'standalone\deployments') -Filter *.war.deployed
```

Expected: `smart-museum-client.war.deployed`, `smart-museum-admin.war.deployed`,
`smart-museum-core.war.deployed`, `smart-museum-iam.war.deployed`, and
`smart-museum.war.deployed`.

If a deployment fails, check the WildFly console for the error before changing
files.

---

## 4. Verify the running stack

### 4.1 Public health and redirects

```powershell
curl.exe -sS -k https://api.smartmuseum.test/api/health
curl.exe -sS -k -o NUL -w "client HTTP %{http_code}`n" https://smartmuseum.test/
curl.exe -sS -k -o NUL -w "admin  HTTP %{http_code}`n" https://admin.smartmuseum.test/
curl.exe -sS -o NUL -w "redirect HTTP %{http_code} -> %{redirect_url}`n" http://smartmuseum.test/
```

`-k` is used here only because Windows curl/Schannel cannot perform a revocation
check for the local mkcert certificate. Section 4.4 performs the strict chain and
hostname verification with OpenSSL.

Expected:

- API health: `{"status":"UP","mongo":"UP"}` with HTTP 200;
- Client and Admin roots: HTTP 200;
- HTTP root: HTTP 302 with `Location: https://smartmuseum.test/` (no port).

### 4.2 Internal services

These are intentionally plain HTTP on loopback and are not reachable through the
public HTTPS hosts.

```powershell
curl.exe -sS http://localhost:8080/core/health
curl.exe -sS http://localhost:8080/iam/health
```

Expected for both: `{"status":"UP","mongo":"UP"}` with HTTP 200.

Confirm the public hosts do not serve CORE/IAM:

```powershell
curl.exe -sS -k -o NUL -w "CORE on public: HTTP %{http_code}`n" https://smartmuseum.test/core/health
curl.exe -sS -k -o NUL -w "IAM on public:  HTTP %{http_code}`n" https://smartmuseum.test/iam/health
```

Expected: HTTP 404 for both.

### 4.3 PWA assets and MIME types

```powershell
curl.exe -sS -k -o NUL -w "manifest HTTP %{http_code} type=%{content_type}`n" https://smartmuseum.test/manifest.webmanifest
curl.exe -sS -k -o NUL -w "worker   HTTP %{http_code} type=%{content_type}`n" https://smartmuseum.test/service-worker.js
curl.exe -sS -k -o NUL -w "offline  HTTP %{http_code} type=%{content_type}`n" https://smartmuseum.test/offline.html
```

Expected:

- manifest: HTTP 200, `application/manifest+json`;
- service worker: HTTP 200, `application/javascript`;
- offline page: HTTP 200, `text/html`.

The service worker file is `/service-worker.js`, not `/sw.js`.

### 4.4 Strict TLS verification

Windows `curl.exe` uses Schannel and may report
`CRYPT_E_NO_REVOCATION_CHECK` for the local mkcert certificate because it has no
revocation endpoint. This is expected and is not a certificate trust failure.
Verify the chain and hostname with OpenSSL instead:

```powershell
$ca = Join-Path (mkcert -CAROOT) 'rootCA.pem'
openssl s_client -connect smartmuseum.test:443 -servername smartmuseum.test `
  -CAfile $ca -verify_hostname smartmuseum.test -verify_return_error -brief
```

Expected output includes:

```text
CONNECTION ESTABLISHED
Verification: OK
```

Repeat for `admin.smartmuseum.test` and `api.smartmuseum.test` if you want to
confirm each hostname.

### 4.5 Browser checks

Open a normal browser profile (not a private window with a different trust
store) and check:

- https://smartmuseum.test/ - no certificate warning, Client PWA loads;
- https://admin.smartmuseum.test/ - no certificate warning, Admin PWA loads;
- https://api.smartmuseum.test/api/health - JSON health response;
- DevTools -> Application -> Manifest shows the app name and icons;
- DevTools -> Application -> Service Workers shows the worker as activated;
- no mixed-content or CORS errors in the console.

---

## 5. Accounts and roles

### 5.1 Your bootstrap ADMIN

The ADMIN account is created by IAM the first time the IAM WAR starts with your
`dev.env`, from the values you entered in Step 4:

```text
BOOTSTRAP_ADMIN_NAME
BOOTSTRAP_ADMIN_EMAIL
BOOTSTRAP_ADMIN_PASSWORD
```

Use that email and password to sign in to https://admin.smartmuseum.test/.

IAM creates the bootstrap ADMIN only when its email does not already exist. There
is no password-change endpoint. If you need a different password, either use a
new email or delete the old account from the sandbox and restart WildFly. The
stored `_id` is the lowercase email:

```powershell
docker exec museum-m2-sandbox-mongo mongosh --quiet museum_m2_sandbox `
  --eval "db.users.deleteOne({_id: 'your-admin@example.org'})"
```

Then update `%LOCALAPPDATA%\SmartMuseum\M2-TLS\acceptance-admin.json` with:

```powershell
.\deployment\set-acceptance-credentials.ps1 -VerifyLogin -Force
```

### 5.2 Create a CLIENT for the Client PWA

Sign in to the Admin PWA, open **Users**, fill in the CLIENT account form, assign
at least one zone (`salle-01` and/or `salle-02`), and click **Create CLIENT
account**. Then sign in to https://smartmuseum.test/ with those credentials.

Each CLIENT sees only its assigned zones. Admin actions and other zones return
HTTP 403.

### 5.3 Credentials are per developer

No account, password, token, or key is shared through Git:

- `dev.env` is ignored by Git;
- the sandbox database is a local Docker volume;
- `acceptance-admin.json` lives outside the repository and is readable only by
  your Windows user.

Never commit `dev.env`, `acceptance-admin.json`, keystores, or certificates.

---

## 6. Optional demo data

The repository includes `deployment\seed-demo.js`. It prepares a realistic demo
in the isolated sandbox:

- removes `m2acc-*` and `m2rej-*` acceptance artifacts;
- seeds 30 days of measurements every 15 minutes for `bme280-01` (`salle-01`)
  and `sim-bme280-02` (`salle-02`);
- adds temperature, humidity, and pressure for both devices;
- adds a pending device `demo-pending-01` in `salle-02` for the approval
  workflow.

Run it against the sandbox container:

```powershell
docker cp .\deployment\seed-demo.js museum-m2-sandbox-mongo:/tmp/seed-demo.js
docker exec museum-m2-sandbox-mongo mongosh --quiet museum_m2_sandbox --file /tmp/seed-demo.js
```

Expected output:

```text
cleaned devices=... things=... measurements=... users=... previousSeed=...
inserted measurements=17286
pending device demo-pending-01 ready (salle-02)
final counts: devices=3 things=3 measurements=17288 users=... zones=2
```

The script is safe to re-run. It only touches `museum_m2_sandbox`.

Verify with the API or the PWAs:

- `salle-01` latest measurements: temperature, humidity, pressure for
  `bme280-01`, with current timestamps;
- `salle-02` latest measurements: temperature, humidity, pressure for
  `sim-bme280-02`;
- Admin **Device inventory** shows `demo-pending-01` with status `pending`;
- a CLIENT assigned to `salle-01` cannot see `salle-02` or the pending device.

> Running the automated acceptance suite (Section 8) adds its own test records.
> Re-run `seed-demo.js` afterwards if you want a clean demo again.

---

## 7. Manual test scenarios

Use this checklist to exercise the features end to end.

### 7.1 Platform and TLS

| Test | Steps | Expected |
|---|---|---|
| HTTP redirect | Open `http://smartmuseum.test/` | 302 to `https://smartmuseum.test/` without a port |
| Strict TLS | Section 4.4 OpenSSL command | `Verification: OK` |
| Internal isolation | Open `https://smartmuseum.test/core/health` | 404 |
| Health | `https://api.smartmuseum.test/api/health` | `{"status":"UP","mongo":"UP"}` |
| CORS | Browser console on the Client PWA | No CORS errors |

### 7.2 Client PWA

| Test | Steps | Expected |
|---|---|---|
| Login | Sign in with a CLIENT account | Dashboard loads |
| Zone scope | Select the assigned zone | Only assigned-zone devices appear |
| Live cards | Look at the measurement cards | Temperature, humidity, pressure with values |
| Freshness | Check the freshness indicator | Fresh/green after seeding |
| History | Open the history section, choose a device/property | Chart with many points |
| Offline | DevTools -> Network -> Offline, reload | Offline page or cached shell |
| PWA install | Browser install prompt | App installs |
| Zone denial | Request another zone through the UI/API | 403 |

### 7.3 Admin PWA

| Test | Steps | Expected |
|---|---|---|
| Login | Sign in with the bootstrap ADMIN | Dashboard loads |
| Device inventory | Open **Device inventory** | `bme280-01`, `sim-bme280-02`, and `demo-pending-01` |
| Approve | Approve `demo-pending-01` | Status becomes `active` |
| Reject | Register or reset another pending device, then reject it | Status becomes `rejected` |
| Zones | Open **Zones** | `salle-01` and `salle-02` with locations |
| Users | Open **Users**, create a CLIENT with `salle-01` | Account is created and can sign in |
| User scope | Sign in to the Client PWA as the new CLIENT | Only `salle-01` is visible |

### 7.4 Cross-service flow

1. As ADMIN, create a CLIENT assigned to `salle-01`.
2. Sign out and sign in to the Client PWA as that CLIENT.
3. Confirm the Client sees `bme280-01` and its measurements.
4. Confirm the Client cannot see `salle-02` (403) or the pending device.
5. As ADMIN, approve a pending device.
6. Confirm the newly approved device appears according to its zone.
7. As ADMIN, reject a pending device and confirm it cannot ingest measurements.

### 7.5 Negative tests

| Test | Expected |
|---|---|
| Wrong password at login | 401 |
| Missing bearer token on `/api/devices` | 401 |
| CLIENT calls approve/reject | 403 |
| CLIENT requests an unassigned zone | 403 |
| Public host requests `/core/*` or `/iam/*` | 404 |
| CORE/IAM request without `X-Internal-Service-Token` | 401 |
| Unapproved CORS origin | 403 |

---

## 8. Automated acceptance suite

The project includes a repeatable acceptance suite that verifies TLS, health,
redirects, both PWAs, CORS, authentication, roles and zones, internal service
authentication, Thing Description registration, measurement validation, and all
deployment statuses.

It writes test users, devices, and measurements **only** to
`museum_m2_sandbox`. Confirm the sandbox before running it.

Prerequisites:

- WildFly is running with all five deployments;
- `dev.env` points to `localhost:27018/museum_m2_sandbox`;
- `%LOCALAPPDATA%\SmartMuseum\M2-TLS\acceptance-admin.json` exists (created in
  Step 4 with `-WriteAcceptanceCredentials`);
- the mkcert CA exists at `%LOCALAPPDATA%\mkcert\rootCA.pem`.

Run:

```powershell
.\deployment\test-m2-runtime.ps1 -ConfirmSandboxWrites
```

Expected final lines:

```text
All five WildFly deployments enabled and OK           OK True

Acceptance tests passed. Test-only users, Thing Descriptions, and measurements remain in museum_m2_sandbox.
```

If a check fails, read the failing row and the WildFly log. The script uses
OpenSSL with strict chain and hostname checks; it does not bypass TLS.

---

## 9. Day-to-day: update the code and redeploy

After pulling new changes:

```powershell
git checkout main
git pull origin main
.\deployment\build-all.ps1 -SkipFrontendTests
```

### 9.1 Update the PWAs

```powershell
$wildflyHome = 'C:\wildfly-42.0.0.Final'
.\deployment\deploy-client.ps1 -WildFlyHome $wildflyHome -ReplaceExisting
.\deployment\deploy-admin.ps1  -WildFlyHome $wildflyHome -ReplaceExisting
```

### 9.2 Update CORE and IAM

```powershell
.\deployment\deploy-core.ps1 -WildFlyHome $wildflyHome -ReplaceExisting
.\deployment\deploy-iam.ps1  -WildFlyHome $wildflyHome -ReplaceExisting
```

### 9.3 Update the API (guarded)

The API replacement requires a verified rollback backup of the currently
deployed WAR:

```powershell
$wildflyHome = 'C:\wildfly-42.0.0.Final'
$deployments = Join-Path $wildflyHome 'standalone\deployments'
$backupDir = Join-Path $wildflyHome 'standalone\m2-backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$apiBackup = Join-Path $backupDir ("smart-museum-before-update-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.war')
Copy-Item -LiteralPath (Join-Path $deployments 'smart-museum.war') -Destination $apiBackup
$apiHash = (Get-FileHash -LiteralPath $apiBackup -Algorithm SHA256).Hash
if ($apiHash -ne (Get-FileHash (Join-Path $deployments 'smart-museum.war') -Algorithm SHA256).Hash) {
    throw 'API backup verification failed.'
}

.\deployment\deploy-api.ps1 -WildFlyHome $wildflyHome `
  -VerifiedApiBackup $apiBackup -ExpectedApiBackupSha256 $apiHash -ReplaceExisting
```

`deploy-middleware.ps1` deploys CORE, IAM, and API in order with the same
backup requirement. See `deployment\README.md` for the full guarded workflow and
rollback procedure.

### 9.4 Start and stop

```powershell
.\deployment\start-wildfly.ps1 -Profile dev -WildFlyHome $wildflyHome
.\deployment\stop-wildfly.ps1  -ConfirmStop -WildFlyHome $wildflyHome
```

`start-wildfly.ps1` runs in the foreground. Use a separate PowerShell window for
it. It refuses to start if ports 80, 443, 8080, or 9990 are already in use.

### 9.5 Do not copy WARs over a live deployment

Direct copying is only for the initial deployment or while WildFly is stopped.
For updates, use the `deploy-*.ps1` scripts so the previous WAR is backed up and
verified, and the scanner reports a clear status.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `docker info` fails | Start Docker Desktop and wait for it to be ready. |
| `Port 80 has a listener` | Stop IIS/other service or WildFly. Run `Get-NetTCPConnection -State Listen -LocalPort 80,443,8080,9990`. |
| `mkcert is not installed` | `winget install --id FiloSottile.mkcert -e --scope user`, then reopen PowerShell. |
| `openssl.exe is required` | Install OpenSSL and ensure `openssl version` works in a new PowerShell window. |
| `dev.env already exists` | Keep it, or use `-RotateSecrets` intentionally. Do not delete it casually; it contains your tokens. |
| WildFly exits immediately | Check the console. Usually a missing `dev.env`, missing TLS keystore, or a port conflict. |
| Browser certificate warning | Re-run `prepare-local-https.ps1`; confirm mkcert CA is trusted for the current user. |
| `CRYPT_E_NO_REVOCATION_CHECK` from `curl.exe` | Expected with Schannel and a local mkcert certificate. Verify with OpenSSL (Section 4.4); do not disable TLS checks. |
| 404 on `/sw.js` | The service worker is `/service-worker.js`. |
| 403 in the Client PWA | The CLIENT is not assigned to that zone, or is trying an ADMIN action. |
| 401 on API calls | Missing/expired bearer token. Sign in again; access tokens last 900 seconds by default. |
| 404 for `/core` or `/iam` on public hosts | Correct. CORE/IAM are internal only. Use `http://localhost:8080/...`. |
| Admin login fails after changing `BOOTSTRAP_ADMIN_PASSWORD` | IAM does not update an existing account. Use a new email or delete the old user (Section 5.1). |
| Acceptance script fails at login | `acceptance-admin.json` does not match a real ADMIN, or WildFly/the API is not running. Use `set-acceptance-credentials.ps1 -VerifyLogin -Force`. |
| Deployment marker missing | Check the WildFly log; a failed deployment writes a `.war.failed` marker. Fix the cause and redeploy. |
| Hosts file changes ignored | Run `ipconfig /flushdns`, close/reopen the browser, and confirm `Resolve-DnsName` returns `127.0.0.1`. |
| `configure-wildfly-ports.ps1` fails on a host | Run `configure-wildfly-hosts.ps1` first with WildFly running, then stop and rerun the ports script. |
| Wrong WildFly version | Use WildFly **42.0.0.Final**. Other versions may not have the expected `applicationSSC` listener. |

---

## 11. Reset and teardown

### 11.1 Stop the stack

```powershell
$wildflyHome = 'C:\wildfly-42.0.0.Final'
.\deployment\stop-wildfly.ps1 -ConfirmStop -WildFlyHome $wildflyHome
```

### 11.2 Reset the sandbox database

Keep the volume (data preserved):

```powershell
docker compose -f .\middleware\docker-compose.m2-sandbox.yml down
```

Delete the sandbox data (irreversible):

```powershell
docker compose -f .\middleware\docker-compose.m2-sandbox.yml down -v
```

### 11.3 Remove local credentials and TLS files

Only when you intentionally want to start over:

```powershell
Remove-Item .\middleware\config\dev.env
Remove-Item "$env:LOCALAPPDATA\SmartMuseum\M2-TLS" -Recurse
```

### 11.4 Undeploy and restore WildFly

Start WildFly first (the CLI uses `--connect`), then undeploy the five
applications:

First PowerShell window:

```powershell
$wildflyHome = 'C:\wildfly-42.0.0.Final'
.\deployment\start-wildfly.ps1 -Profile dev -WildFlyHome $wildflyHome
```

Second PowerShell window, once WildFly is started:

```powershell
$wildflyHome = 'C:\wildfly-42.0.0.Final'
$cli = Join-Path $wildflyHome 'bin\jboss-cli.bat'
& $cli --connect --command="undeploy smart-museum-client.war"
& $cli --connect --command="undeploy smart-museum-admin.war"
& $cli --connect --command="undeploy smart-museum-core.war"
& $cli --connect --command="undeploy smart-museum-iam.war"
& $cli --connect --command="undeploy smart-museum.war"
```

To restore the previous WildFly configuration, stop WildFly, copy a verified
backup over `standalone.xml`, and restart. Backups are under:

```text
standalone\configuration\m2-backups\standalone-before-*.xml
```

Do not remove `default-host`, the management interface, or TLS resources unless
you are intentionally rebuilding the WildFly installation.

---

## 12. Security notes

- This topology is for local development only. It binds to loopback.
- Never expose ports 8080 (CORE/IAM) or 9990 (management) to a network.
- Never commit `dev.env`, `acceptance-admin.json`, keystores, certificates, or
  service tokens.
- Never put secrets in Vite variables (`VITE_*`). The PWA build only receives the
  public API URL and data mode.
- Use a dedicated sandbox database (`museum_m2_sandbox`). Do not point DEV at a
  production or shared database.
- Keep the mkcert CA private to your Windows user. Do not install it machine-wide
  unless your security policy allows it.
- Access tokens are short-lived (900 seconds by default). Re-authenticate rather
  than sharing tokens.

---

## 13. Quick command reference

```powershell
# Paths
$wildflyHome = 'C:\wildfly-42.0.0.Final'
$repo = (Get-Location).Path

# Docker sandbox
docker compose -f .\middleware\docker-compose.m2-sandbox.yml up -d
docker ps --filter "name=museum-m2-sandbox-mongo"

# First-time environment
.\deployment\initialize-dev-environment.ps1 -CreateBootstrapAdmin -WriteAcceptanceCredentials
.\deployment\prepare-local-https.ps1
.\deployment\configure-wildfly-https.ps1 -WildFlyHome $wildflyHome

# First start + hosts (start-wildfly blocks; run it in a second window)
.\deployment\start-wildfly.ps1 -Profile dev -WildFlyHome $wildflyHome
# Back in the first window:
.\deployment\configure-wildfly-hosts.ps1 -WildFlyHome $wildflyHome
.\deployment\stop-wildfly.ps1 -ConfirmStop -WildFlyHome $wildflyHome

# Ports, build, deploy, start
.\deployment\configure-wildfly-ports.ps1 -WildFlyHome $wildflyHome
.\deployment\build-all.ps1
Copy-Item .\pwa-client\deployment\target\smart-museum-client.war (Join-Path $wildflyHome 'standalone\deployments')
Copy-Item .\pwa-admin\deployment\target\smart-museum-admin.war (Join-Path $wildflyHome 'standalone\deployments')
Copy-Item .\middleware\core\target\smart-museum-core.war (Join-Path $wildflyHome 'standalone\deployments')
Copy-Item .\middleware\iam\target\smart-museum-iam.war (Join-Path $wildflyHome 'standalone\deployments')
Copy-Item .\middleware\api\target\smart-museum.war (Join-Path $wildflyHome 'standalone\deployments')
.\deployment\start-wildfly.ps1 -Profile dev -WildFlyHome $wildflyHome
# In a second window, once started:
.\deployment\check-deployments.ps1 -WildFlyHome $wildflyHome

# Verify
curl.exe -sS -k https://api.smartmuseum.test/api/health
curl.exe -sS http://localhost:8080/core/health
curl.exe -sS http://localhost:8080/iam/health

# Demo data (optional)
docker cp .\deployment\seed-demo.js museum-m2-sandbox-mongo:/tmp/seed-demo.js
docker exec museum-m2-sandbox-mongo mongosh --quiet museum_m2_sandbox --file /tmp/seed-demo.js

# Acceptance
.\deployment\test-m2-runtime.ps1 -ConfirmSandboxWrites

# Stop
.\deployment\stop-wildfly.ps1 -ConfirmStop -WildFlyHome $wildflyHome
```

---

## 14. Related documentation

- `deployment\README.md` - authoritative deployment, backup, rollback, and
  acceptance details.
- `middleware\M2_RUNTIME_ACCEPTANCE.md` - recorded runtime results and
  limitations.
- `DOCS\ADMIN_PWA.md` - Admin PWA behavior.
- `DOCS\pwa-client.md` - Client PWA behavior.
- `middleware\config\dev.env.example` - environment variable template.
