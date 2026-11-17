# Smart Museum local WildFly deployment (M1 + M2)

This local topology deploys each Vite production bundle as an independent
static WAR on a separate Undertow host. The modular Java backend consists of
`smart-museum-core.war`, `smart-museum-iam.war`, and the public
`middleware/api/target/smart-museum.war`. This guide covers the local M1 PWA
hosting and M2 three-service middleware deployment. The cloud architecture
elsewhere in the project remains a separate production target that documents
Nginx as the public TLS reverse proxy.

## Host and context mapping

| Deployment | WAR | Context | Undertow host resource | Local alias |
|---|---|---|---|---|
| Client | `smart-museum-client.war` | `/` | `smartmuseum-host` | `smartmuseum.test` |
| Admin | `smart-museum-admin.war` | `/` | `admin-smartmuseum-host` | `admin.smartmuseum.test` |
| CORE service | `middleware/core/target/smart-museum-core.war` | `/core` | `internal-host` (server `internal-server`, 127.0.0.1:8080) | internal only |
| IAM service | `middleware/iam/target/smart-museum-iam.war` | `/iam` | `internal-host` (server `internal-server`, 127.0.0.1:8080) | internal only |
| Middleware API | `middleware/api/target/smart-museum.war` | `/api` | `api-smartmuseum-host` | `api.smartmuseum.test` |

CORE and IAM endpoints require `X-Internal-Service-Token`; the public reverse
proxy must not route those contexts to clients. API calls them through
`CORE_SERVICE_URL` and `IAM_SERVICE_URL`. DEV defaults are
`http://localhost:8080/core` and `http://localhost:8080/iam`; PROD URLs must use
HTTPS with normal certificate verification.

The service health probes are `/core/health`, `/iam/health`, and the existing
public `/api/health`. CORE and IAM health endpoints only report service and
Mongo availability; their internal business routes still require the shared
service token.

The aliases are local development defaults, not production domains. Each PWA
must remain on its own origin because its assets and service worker use the
origin root. The WAR descriptors bind to the **Undertow host resource names**;
the CLI file associates the host aliases with those resources.

## Prerequisites

- Node.js and npm (the repository's PWA README currently targets Node 20.19+
  or 22.12+).
- Java 21 and Maven.
- A WildFly installation with the Undertow `default-server` resource.
- WildFly CLI access to its management interface for host configuration and
  deployment. Keep the management interface private.

The checked local WildFly 42 config has Undertow server `default-server`,
default host `default-host` with alias `localhost`, Client, Admin, and API
hosts, and HTTP/HTTPS listeners. The local development HTTPS listener uses a
separate environment-backed M2 keystore and SSL context; the original
`applicationKS`/`applicationKM`/`applicationSSC` resources are preserved.
Management and application listeners are bound to loopback for this local
setup. Inspect the actual installation before use.

## Build and package

Run from the repository root in PowerShell:

```powershell
Push-Location pwa-client
npm ci
npm test
npm run build
mvn -f deployment/pom.xml package
Pop-Location

Push-Location pwa-admin
npm ci
npm test
npm run build
mvn -f deployment/pom.xml package
Pop-Location
```

Maven checks that `dist/index.html`, the manifest, and service worker exist and
that the dist index is not older than the Vite source/configuration files. If
the check fails, run `npm run build` in that PWA folder before packaging.

Artifacts:

```text
pwa-client/deployment/target/smart-museum-client.war
pwa-admin/deployment/target/smart-museum-admin.war
```

Each WAR contains the Vite `dist/` tree at its root plus its own
`WEB-INF/jboss-web.xml` and a minimal `WEB-INF/web.xml` mapping `.webmanifest`
to `application/manifest+json`. It does not include `src/` or `node_modules/`.

## Configure hosts and deploy

First review the WildFly installation, active standalone configuration, and
management port. After `configure-wildfly-ports.ps1` (below) the local layout
is: public HTTP 80 (redirect only) and HTTPS 443 on 127.0.0.1, the internal
CORE/IAM server on 127.0.0.1:8080, and management on 127.0.0.1:9990.

Add these lines manually to the Windows hosts file using an elevated editor;
the project does not edit it automatically:

```text
127.0.0.1 smartmuseum.test
127.0.0.1 admin.smartmuseum.test
127.0.0.1 api.smartmuseum.test
```

After starting WildFly as described below and confirming its management
controller is available, set the actual WildFly installation path and run the
CLI script from the repository root. It creates missing hosts; if either named resource exists, it
prints its aliases and leaves it untouched. Confirm each existing host has
only the intended alias before proceeding. Resolve any conflict manually
after reviewing the WildFly model; do not allow this script to replace an
existing host or alias.

```powershell
$wildflyHome = 'C:\path\to\wildfly'
.\deployment\configure-wildfly-hosts.ps1 -WildFlyHome $wildflyHome
```

The API WAR descriptor selects `api-smartmuseum-host` and context `/api`.
The M2 CLI creates that named Undertow host only if absent; it does not replace
an existing host. Inspect the resulting host resource and alias before
deploying.

The checked local WildFly configuration includes the default deployment
scanner for `standalone/deployments`. After building all middleware WARs, deploy
CORE, IAM, then API. Before replacing API, make a verified copy of the API WAR
currently deployed (the script requires the backup to match the current WAR):

```powershell
$deployments = Join-Path $wildflyHome 'standalone\deployments'
$backupDir = Join-Path $wildflyHome 'standalone\m2-backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$apiBackup = Join-Path $backupDir ("smart-museum-before-update-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.war')
Copy-Item -LiteralPath (Join-Path $deployments 'smart-museum.war') -Destination $apiBackup
$apiHash = (Get-FileHash -LiteralPath $apiBackup -Algorithm SHA256).Hash
if ($apiHash -ne (Get-FileHash (Join-Path $deployments 'smart-museum.war') -Algorithm SHA256).Hash) { throw 'API backup verification failed.' }

.\deployment\deploy-middleware.ps1 -WildFlyHome $wildflyHome `
  -VerifiedApiBackup $apiBackup -ExpectedApiBackupSha256 $apiHash -ReplaceExisting
```

`deploy-core.ps1` and `deploy-iam.ps1` are also available for independent
updates after their WARs have been built. Deploying the PWAs remains separate:
use `deploy-client.ps1` and `deploy-admin.ps1` when those artifacts need an
update.

Each replacement first creates and hashes a timestamped copy under
`standalone/m2-backups`. API replacement additionally requires the current WAR
and supplied rollback backup to match the caller-provided SHA-256. These
deployment commands overwrite current deployments only after the explicit
`-ReplaceExisting` switch. `rollback-api.ps1` similarly requires
`-ConfirmRollback` and the expected verified backup hash.

Confirm deployment status in the WildFly log or management console. The two
WARs both use `/`, but each descriptor selects a different virtual host, so
the context roots are independent. The scanner should create
`smart-museum-client.war.deployed` and `smart-museum-admin.war.deployed`; check
the log for both deployments before making HTTP requests.

## Local HTTPS setup and startup

Run from the repository root in Windows PowerShell. The checked machine
already has the three host aliases above. If they are missing elsewhere, add
them manually to the Windows hosts file from an elevated editor; the project
does not modify that file.

Prepare the isolated DEV environment and local certificate (initialize only
if `middleware/config/dev.env` does not already exist):

```powershell
.\deployment\initialize-dev-environment.ps1 -CreateBootstrapAdmin -WriteAcceptanceCredentials
.\deployment\prepare-local-https.ps1
$wildflyHome = 'C:\path\to\wildfly-42.0.0.Final'   # your WildFly 42 installation
.\deployment\configure-wildfly-https.ps1 -WildFlyHome $wildflyHome
```

`prepare-local-https.ps1` uses mkcert and OpenSSL, stores its certificate and
password-protected PKCS#12 file under `%LOCALAPPDATA%\SmartMuseum\M2-TLS`,
and keeps the keystore password in ignored `middleware/config/dev.env`. It
checks the local CA trust, certificate names, and keystore password without
printing secrets. The CA is trusted for the current Windows user. The WildFly
TLS helper keeps the original application TLS resources and creates a
timestamped, hash-verified `standalone.xml` backup before a needed change.
Stop WildFly cleanly before changing this configuration; the helper refuses
to edit it while management port 9990 is listening.

### Accounts and credentials (each developer)

No account, password, token, or key is shared through Git: `dev.env` is
ignored, the sandbox database is a local Docker volume, and the acceptance
credential file lives outside the repository. Every developer creates their
own:

- `initialize-dev-environment.ps1 -CreateBootstrapAdmin` prompts for **your**
  sandbox ADMIN name, email, and password (12 to 72 bytes, not echoed) and
  generates your own random service tokens and JWT key in `dev.env`. On the
  first WildFly start with that file, IAM creates this ADMIN in your
  `museum_m2_sandbox`. Sign in to the Admin PWA with it.
- `-WriteAcceptanceCredentials` also writes
  `%LOCALAPPDATA%\SmartMuseum\M2-TLS\acceptance-admin.json`
  (`{"email": ..., "password": ...}`, readable only by your Windows user),
  which `test-m2-runtime.ps1` needs. If `dev.env` already exists, create or
  replace that file on its own (with WildFly running, `-VerifyLogin` checks
  the credentials first):

  ```powershell
  .\deployment\set-acceptance-credentials.ps1 -VerifyLogin           # prompts for email and password
  .\deployment\set-acceptance-credentials.ps1 -VerifyLogin -Force    # replace an existing file
  ```

Changing the DEV admin password: IAM creates the bootstrap ADMIN only when its
email does not exist yet, and there is no password-change endpoint, so editing
`BOOTSTRAP_ADMIN_PASSWORD` or rerunning the initializer does **not** change an
existing account. In the sandbox, either use a new `BOOTSTRAP_ADMIN_EMAIL`, or
delete the old account (its `_id` is the email in lowercase) and restart
WildFly with the new values:

```powershell
docker exec museum-m2-sandbox-mongo mongosh --quiet museum_m2_sandbox --eval "db.users.deleteOne({_id: 'your-admin@example.org'})"
```

Then update `acceptance-admin.json` with `set-acceptance-credentials.ps1 -Force`.
`initialize-dev-environment.ps1 -RotateSecrets` regenerates the service tokens
and JWT key (existing sessions become invalid) and rewrites `dev.env` from the
template, which also clears `TLS_KEYSTORE_*`; run `prepare-local-https.ps1`
again afterwards.

### Standard ports (no port in the URLs)

With WildFly stopped, apply the port layout once (no elevated PowerShell is
needed: Windows has no privileged ports, and the listeners bind 127.0.0.1):

```powershell
.\deployment\configure-wildfly-ports.ps1 -WildFlyHome $wildflyHome
```

It runs `wildfly-standard-ports.cli` and `wildfly-internal-server.cli` offline
(`embed-server`), after a timestamped, SHA-256-verified backup in
`standalone\configuration\m2-backups\standalone-before-standard-ports-*.xml`:

- public `http` on 80 and `https` on 443; the `https-redirect` filter answers
  every port-80 request with `302 Location: https://<host><path>` (no port);
- `internal-server` with one HTTP listener on 127.0.0.1:8080 and
  `internal-host`. CORE and IAM select it in their `jboss-web.xml`, so they
  are never served by the public listeners, whatever the `Host` header;
- management unchanged on 127.0.0.1:9990.

Ports 80 and 443 must be free (no IIS or other http.sys site);
`start-wildfly.ps1` refuses to start if 80, 443, 8080 or 9990 is in use.
CORE/IAM WARs from this version need `internal-server`, so configure the ports
before deploying them. To roll back: stop WildFly, copy the backup over
`standalone.xml`, restore the previous `CORS_ALLOWED_ORIGINS` in `dev.env`,
and redeploy the previous WARs (copies are in `standalone\m2-backups`).

Build and start WildFly in its own PowerShell window:

```powershell
.\deployment\build-all.ps1
.\deployment\start-wildfly.ps1 -Profile dev -WildFlyHome $wildflyHome
```

For updated middleware, inspect the current API WAR and a rollback copy first.
Then deploy CORE, IAM, API in that order with `deploy-middleware.ps1` and its
required verified API backup path and SHA-256. Updated Client/Admin WARs can
be deployed separately with `deploy-client.ps1` and `deploy-admin.ps1`. These
scripts require `-ReplaceExisting` before replacing a deployment. Do not copy
WAR files over a live deployment or point DEV at the original `museum`
database.

DEV must target only `localhost:27018/museum_m2_sandbox`; its dedicated
container is `museum-m2-sandbox-mongo` with volume
`museum-m2-sandbox-data`. It does not replace or mount the original
`museum-mongo` / `backend_mongo-data` database.

## Verify

The public applications use HTTPS on the standard port 443, so the URLs have
no port. Confirm that `http://<host>/` redirects to `https://<host>/` (no port
in `Location`), then check the sites at:

```text
https://smartmuseum.test/
https://admin.smartmuseum.test/
https://api.smartmuseum.test/api/health
```

Check each root, manifest, service worker, one built asset, and an icon. They
must return the correct app and usable MIME types, including
`application/manifest+json` for the manifest. The Admin's `#dashboard`
navigation should survive reload; in the API build it requires an ADMIN
sign-in. Both PWAs use the public API. The API WAR is not mapped to
`default-host`. CORE and IAM health checks are internal-only (plain HTTP on
loopback) at
`http://localhost:8080/core/health` and `http://localhost:8080/iam/health`;
their business routes must not be exposed on public hosts. All three health
responses should report service and Mongo as `UP`.

The local certificate SAN covers Client, Admin, API, localhost and 127.0.0.1.
Open each PWA in a normal browser profile and check for certificate errors.
Verify the Client manifest, service-worker registration, API health fetch, and
browser console for mixed-content or CORS errors. Windows curl with Schannel
may report `CRYPT_E_NO_REVOCATION_CHECK` for this local mkcert certificate
because it has no revocation endpoint. Do not bypass certificate checks. Open
the API and service health URLs in the trusted browser, or run the runtime
acceptance script, which uses OpenSSL with strict chain and hostname checks:

```powershell
.\deployment\test-m2-runtime.ps1 -ConfirmSandboxWrites
```

This acceptance script writes test records to the isolated DEV sandbox; see
the warning and scope below before running it.

`deployment/build-all.ps1` configures the Client with the HTTPS API URL and
API data mode for its production build. Configure the backend's
`CORS_ALLOWED_ORIGINS` with the exact Client origin; never put secrets in Vite
variables. Admin remains disconnected from the API.

The repeatable M2 integration/acceptance checks are in
`deployment/test-m2-runtime.ps1`. They cover TLS verification, health probes,
both PWAs, API/CORS, authentication and role/zone authorization, internal
service authentication, Thing Description registration, measurement
validation, and all five deployment statuses. The test writes users and museum
records **only** to the isolated DEV database. Explicitly confirm that sandbox
before running:

```powershell
.\deployment\test-m2-runtime.ps1 -ConfirmSandboxWrites
```

The script uses your protected local acceptance-admin credential file
`%LOCALAPPDATA%\SmartMuseum\M2-TLS\acceptance-admin.json`, created with
`set-acceptance-credentials.ps1` (see "Accounts and credentials" above); it
does not print credential values.
It leaves its test records in the sandbox. Recorded runtime results and
limitations are in `middleware/M2_RUNTIME_ACCEPTANCE.md`.

## Undeploy and rollback

Undeploy only the static WARs that were added:

```powershell
& "$wildflyHome\bin\jboss-cli.bat" --connect --command="undeploy smart-museum-client.war"
& "$wildflyHome\bin\jboss-cli.bat" --connect --command="undeploy smart-museum-admin.war"
```

Remove a host resource only if this task created it and it has no other
deployments or locations. Inspect it first:

```powershell
& "$wildflyHome\bin\jboss-cli.bat" --connect --command="/subsystem=undertow/server=default-server/host=smartmuseum-host:read-resource(recursive=true)"
& "$wildflyHome\bin\jboss-cli.bat" --connect --command="/subsystem=undertow/server=default-server/host=admin-smartmuseum-host:read-resource(recursive=true)"
```

Then remove only the confirmed task-created resource using the corresponding
`:remove` operation. Do not remove `default-host`, the backend WAR, listeners,
TLS resources, or management settings. Manually remove the two hosts-file
lines only if you added them for this task.

Verified rollback backups and a guarded rollback procedure exist, but an M2
rollback drill was not run at the operator's request. Treat rollback as
unverified until a separate drill is approved and completed.
