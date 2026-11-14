# WildFly static PWA deployments (M1)

This local M1 topology deploys each Vite production bundle as an independent
static WAR on a separate Undertow host. The Java backend remains the existing
`middleware/target/smart-museum.war` deployment. This section describes the
M1 WildFly hosting decision; the cloud architecture elsewhere in the project
continues to document Nginx as the public TLS reverse proxy.

## Host and context mapping

| Deployment | WAR | Context | Undertow host resource | Local alias |
|---|---|---|---|---|
| Client | `smart-museum-client.war` | `/` | `smartmuseum-host` | `smartmuseum.test` |
| Admin | `smart-museum-admin.war` | `/` | `admin-smartmuseum-host` | `admin.smartmuseum.test` |
| Middleware | `smart-museum.war` | `/` | Existing backend host | Existing configuration |

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
default host `default-host` with alias `localhost`, and HTTP/HTTPS listeners.
The supplied CLI adds only the two named hosts; it does not edit listeners,
TLS, `default-host`, or management interfaces. Inspect the actual installation
before use.

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
management port. The checked local defaults use management port 9990, HTTP
8080, and HTTPS 8443; your installation can differ.

Add these lines manually to the Windows hosts file using an elevated editor;
the project does not edit it automatically:

```text
127.0.0.1 smartmuseum.test
127.0.0.1 admin.smartmuseum.test
```

From the repository root, set the actual WildFly installation path and run the
CLI script. It creates missing hosts; if either named resource exists, it
prints its aliases and leaves it untouched. Confirm each existing host has
only the intended alias before proceeding. Resolve any conflict manually
after reviewing the WildFly model; do not allow this script to replace an
existing host or alias.

```powershell
$wildflyHome = 'C:\path\to\wildfly'
$env:NOPAUSE = 'true'
& "$wildflyHome\bin\jboss-cli.bat" --connect --file="deployment\wildfly-pwa-hosts.cli"
```

The checked local WildFly configuration includes the default deployment
scanner for `standalone/deployments`. Copy each WAR there independently:

```powershell
$clientWar = (Resolve-Path 'pwa-client/deployment/target/smart-museum-client.war').Path
$adminWar = (Resolve-Path 'pwa-admin/deployment/target/smart-museum-admin.war').Path
$deployments = Join-Path $wildflyHome 'standalone\deployments'
Copy-Item -LiteralPath $clientWar -Destination $deployments
Copy-Item -LiteralPath $adminWar -Destination $deployments
```

Confirm deployment status in the WildFly log or management console. The two
WARs both use `/`, but each descriptor selects a different virtual host, so
the context roots are independent. The scanner should create
`smart-museum-client.war.deployed` and `smart-museum-admin.war.deployed`; check
the log for both deployments before making HTTP requests.

## Verify

Over HTTP, the static content can be checked at:

```text
http://smartmuseum.test:8080/
http://admin.smartmuseum.test:8080/
```

Check each root, manifest, service worker, one built asset, and an icon. They
must return the correct app and usable MIME types, including
`application/manifest+json` for the manifest. The Admin's `#dashboard`
navigation should survive reload; its actions remain mock-only. The Client
should load in its existing demo mode. The backend remains at its configured
health endpoint, usually `http://localhost:8080/api/health`.

HTTPS is required for service-worker/PWA installation on non-local hostnames.
The local `.test` aliases are not secure contexts over plain HTTP. Browser
installation and offline checks therefore require a locally trusted
certificate whose SAN covers both hostnames and an HTTPS listener configured
to use it. This setup does not create or install certificates. Do not treat
HTTP static response tests as proof of installation or offline behavior.

For Client API mode, set `VITE_API_BASE_URL` before building and configure the
backend's `CORS_ALLOWED_ORIGINS` with the exact Client origin. Never put secrets
in Vite variables. Admin remains disconnected from the API.

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
