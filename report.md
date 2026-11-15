# Smart Museum — Main Branch Deployment and Demonstration Readiness Audit

**Review date:** 2026-11-13  
**Branch inspected:** `main`  
**Review type:** Static repository and local WildFly configuration inspection  
**Runtime status:** The earlier conversation records a successful backend Maven build and a health response from the developer’s running local server. No deployment, CLI script, frontend production build, DNS, TLS, MQTT, or full end-to-end test was run for this audit.  
**Working rules followed:** No source or deployment file was modified; the professor’s CLI scripts and installed WildFly configuration were read only. This report replaces the previous technical implementation audit. The only repository changes in this audit are to `report.md` itself.

## A. Executive summary

The actual `main` branch contains **one Jakarta EE backend application**, not separate API, IAM, and CORE deployments. Maven identifies the application as `tn.supcom.museum:smart-museum:1.0.0`, overrides the WAR filename to `smart-museum.war`, and `jboss-web.xml` assigns it the root context `/`. The JAX-RS API starts at `/api`. Authentication and core domain functions are packages inside that same WAR.

The Client PWA and Admin PWA are independent Vite applications. Their current build outputs are `pwa-client/dist/` and `pwa-admin/dist/` in this working copy. Both can be built into static assets, but their current Vite configuration does not copy those assets into WildFly or deploy them. A WildFly static-host deployment is possible in principle, but the supplied CLI scripts do not yet form a reproducible, safe deployment: the expected API WAR name conflicts with Maven output, the API script does not deploy a WAR or bind the application to its named virtual host, the required property values are not supplied, the scripts are not consistently re-runnable, and local HTTPS/port assumptions do not match the installed default config.

The proposed minimal demonstration topology is three hostnames:

- `smartmuseum.test` — Client PWA static files.
- `admin.smartmuseum.test` — Admin PWA static files.
- `api.smartmuseum.test` — the single backend WAR and `/api/...` endpoints.

There is no source basis for `iam.smartmuseum.test` or `core.smartmuseum.test`; neither is a separate deployable application. The admin frontend is still mock-only, so an authenticated, persistent Admin browser workflow cannot be demonstrated through it. Backend Admin APIs do exist.

The gateway can read a BME280 or simulated sensor and publish telemetry/status to MQTT. This repository has no MQTT broker deployment and no Node-RED flow/relay. The gateway does not publish a Thing Description announcement, and its measurement payload leaves `source` for the intended relay to provide. Thus real or simulated sensor-to-dashboard delivery is **not complete from this repository alone**.

Geolocation is not implemented. Devices and users carry string zone IDs; access is enforced using those IDs, not coordinates or physical position. For an academic museum demonstration, use manually assigned zones and a fixed gateway/device registration (or a QR code containing a provisioned device identity), then rely on backend approval and zone checks. Indoor GPS should not be used as the authority for room-level assignment.

## B. Actual main-branch architecture

### B1. Repository components

| Component | Source location | Actual role |
|---|---|---|
| Backend | `backend/src/main/java/tn/supcom/museum/` | One Jakarta EE REST application: auth, RBAC, users, devices, measurements, discovery, TD validation, health |
| Database | `backend/docker-compose.dev.yml`; Java `data/`, `entity/`, `repository/` | MongoDB persistence for devices, measurements, Things, users |
| Client UI | `pwa-client/` | React/Vite monitoring PWA with demo/API modes, login, histories and charts |
| Admin UI | `pwa-admin/` | React/Vite admin **prototype** backed by local mock data only |
| IoT gateway | `gateway-agent/` | Python BME280 or simulated measurement producer and MQTT publisher |
| MQTT/Node-RED | No broker or flow files found in this checkout | Documented integration design, not a deployable repository module here |
| API contract | `contracts/openapi.yaml` | OpenAPI description of backend routes and DTOs |
| Tests | Backend `src/test`, PWA `*.test.*`, gateway `tests/` | Unit/component tests exist; not executed as part of this inspection |

### B2. Implemented data flows

**Browser authentication and readings:** Client PWA → `POST /api/auth/login` → backend verifies BCrypt password and issues JWT → browser keeps it in `sessionStorage` → requests to `/api/devices` and measurement routes include `Authorization: Bearer ...` → backend reloads the active user/role/zone assignment from Mongo → client sees only authorized zones.

**Backend ingestion:** trusted relay is intended to call `POST /api/ingest/measurements` with `X-Service-Token` → validation chain checks schema, device/zone identity, ranges/quality/time, active status, and TD-declared property/unit → measurement is inserted idempotently and device last-seen is updated. The endpoint exists; the broker/relay that should call it is absent.

**Device discovery:** trusted relay is intended to call `POST /api/things` with a TD announcement → backend validates TD and creates a `pending` device or updates a known device TD → ADMIN calls approve/reject route → active device measurements can be accepted. Backend route and service logic exist; gateway TD publication, relay, and API-connected Admin UI do not.

## C. Backend deployment structure: one WAR or multiple WARs

### Finding: one WAR is present

- `backend/pom.xml`: Maven coordinates are `tn.supcom.museum:smart-museum:1.0.0`, packaging `war`; `<finalName>smart-museum</finalName>` forces output `backend/target/smart-museum.war`.
- `backend/src/main/webapp/WEB-INF/jboss-web.xml`: `<context-root>/</context-root>`.
- `backend/src/main/java/tn/supcom/museum/config/JaxRsApplication.java`: `@ApplicationPath("/api")`.
- Packages such as `security`, `rest`, `repository`, `model`, `validation`, `wot`, and `startup` are modules inside the same Maven project/WAR.
- No separate IAM or CORE Maven applications, WARs, source roots, or deployments were found. `IAM` is at most a functional label for authentication/security code; `CORE` is not a distinct deployable module.

### WAR filename mismatch with `add-api.cli`

`C:\Users\souro\Downloads\add-api.cli` computes its `default-web-module` from `${api.name}-${api.version}.war`. If the intended values are `api.name=smart-museum` and `api.version=1.0.0`, it expects `smart-museum-1.0.0.war`, while the current Maven build produces `smart-museum.war`.

Resolve this explicitly before deployment. Two valid design choices are:

1. **Keep the current Maven filename:** edit the API CLI to use `smart-museum.war` (or a single `api.war` property), and set the matching WAR name as the host’s default web module.
2. **Use Maven’s standard versioned WAR name:** change/remove the `finalName` override so Maven emits `smart-museum-1.0.0.war`; set `api.name=smart-museum`, `api.version=1.0.0`, and deploy that exact result.

Do not attempt to fix this by inventing IAM/CORE WAR names. Also add an explicit deployment command and virtual-host association; `default-web-module` alone is not a WAR deployment command.

**Verification after a later approved implementation:** run `mvn clean package`, inspect `backend/target/*.war`, confirm the deployment name in WildFly, then request `https://api.smartmuseum.test/api/health` and verify the deployment log names the same WAR.

## D. Professor’s WildFly CLI scripts — exact static review

The inspected files are outside the repository:

- `C:\Users\souro\Downloads\default-host.cli`
- `C:\Users\souro\Downloads\add-api.cli`
- `C:\Users\souro\Downloads\add-host.cli`

They are not tracked by Git. The files were read line by line, but **were not executed**. WildFly 42 compatibility therefore remains unverified at runtime.

### D1. `default-host.cli`

1. `batch` begins a management batch; it is committed with `run-batch`, followed by `reload`.
2. It resolves `${default.path}`, `${default.aliases}`, and `${default.domains}`. No matching local `.properties` file or repository deployment-properties configuration was found. These values must be supplied/resolved deliberately before execution; otherwise the path, host alias, or regex may be unresolved or wrong.
3. It changes the existing Undertow `welcome-content` file handler path and replaces the `default-host` aliases. This assumes the default host and `welcome-content` handler exist and may replace the existing `localhost` alias rather than append to it.
4. It **adds** named filters `hsts-header`, `http-to-https`, `spa-default-router`, `cache-control`, `content-type-options`, and several CORS response headers. There are no `if` guards around these additions. A second run can fail on duplicate resources; partial prior configuration is not repaired.
5. It attaches HSTS only when `%p` is `443`, and redirects HTTP only when `%p` is `80`. The installed WildFly config uses 8080/8443, so these predicates do not match the default listener ports.
6. HSTS is set to `max-age=63072000; includeSubDomains; preload`. For a local `.test` demonstration, two-year preload and subdomain inheritance are unnecessary and can persist browser behavior; use a short local policy or omit preload/includeSubDomains.
7. `spa-default-router` maps every 404 on the host to the static `index.html`. This can disguise missing JS/CSS/icon files as successful HTML. Current UIs use hash links and do not use React Router/browser-history routes, so a broad 404 fallback is not required. If retained, limit it to HTML navigation requests and exclude assets/API paths.
8. It emits `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true`. Browsers reject wildcard origin for credentialed CORS requests. Current client uses explicit bearer Authorization and does not need cookie credentials, so use explicit origin allowlists and omit `Allow-Credentials` unless a cookie design is introduced.
9. The script exposes `Strict-Transport-Security` and other headers through CORS; exposing HSTS is not necessary for the browser application.
10. `reload` interrupts/reloads the server. Do not rerun this script against a running demonstration server until duplicate-resource handling and rollback have been addressed.

### D2. `add-host.cli`

1. Resolves `${host.path}`, `${host.aliases}`, `${host.key}`, and `${host.domains}`. No property file was supplied/found, so host name, static directory, aliases and CORS pattern are undefined by repository configuration.
2. Adds a file handler `${host.key}-content`, adds `${host.key}-host`, and maps `/` to that file handler. This is the intended static frontend mapping.
3. Adds a 404 error-page filter pointing at `${host.path}/index.html`; as above, that is broader than necessary for these hash-navigation SPAs and can hide missing asset paths.
4. Attaches global response-header filters (`hsts-header`, `http-to-https`, cache, nosniff and CORS) that must already exist. Thus this script depends on `default-host.cli` running first.
5. There is no idempotency guard. Re-running can fail on existing file handler, host, location, or filter refs.
6. Address text `location=\/:add(...)` is unusual CLI escaping and should be parser-validated on a disposable WildFly config before use.
7. Windows paths with spaces need quoting/escaping at the CLI parser boundary. The expressions are expanded into command arguments; the eventual `host.path` value must be tested with the real project path `C:\Users\souro\Desktop\MBK project\...`.

### D3. `add-api.cli`

1. Resolves `${api.name}`, `${api.version}`, `${api.aliases}`, `${api.context}`, and `${api.domains}`. No values are provided by the repo or the supplied files.
2. It derives the WAR/default-web-module as `${api.name}-${api.version}.war`; this conflicts with the current `smart-museum.war` build output unless corrected (section C).
3. It checks whether `${api.name}-host` exists. If absent, it adds the host, aliases, `default-web-module`, access log, and filter references. If present, it skips the whole setup, so it cannot repair an incomplete host or update a changed WAR/filter configuration.
4. It does **not** execute a WildFly `deploy` command, copy a WAR, or make Maven produce the expected name.
5. The app’s `jboss-web.xml` sets only context root `/`; it does not assign a WildFly virtual-host. The script does not change the deployment’s virtual host. Confirm and explicitly configure the app-to-`api-host` association; otherwise a named API host can resolve to no application/default content.
6. It references filters created by `default-host.cli`; run order dependency is default-host first, then static hosts/API host.
7. API host add is partly guarded, but the filter additions inside the first-time batch are not a general repair/idempotent strategy. Existing host is simply skipped.
8. Its CORS regex is based on `${api.domains}` and has an optional arbitrary subdomain component. It must match the **frontend Origin** values (client and admin domains), not merely the API hostname. Keep allowed origins explicit and narrow.
9. It repeats the wildcard-origin/credentials CORS combination from the default script, conflicting with browser CORS rules and the backend’s exact-origin CORS filter.

### D4. WildFly version and safe CLI validation

The installed directory is `C:\wildfly-41.0.1.Final\wildfly-42.0.0.Final`; its standalone XML declares Undertow subsystem namespace `urn:jboss:domain:undertow:15.0`. Resource names in the CLI scripts look like Undertow management resources, but existence of the resource model does not prove every command/expression/predicate parses or works on this server. **No CLI script was run and no destructive operation was attempted.**

Before applying corrected scripts, validate operations using `read-resource`/`read-resource-description` queries and the CLI parser against a copied disposable WildFly installation/configuration. Inspect the resulting management model and logs. Back up `standalone.xml`; never use a destructive `:remove`/reset as a troubleshooting shortcut on the demonstration installation.

## E. Proposed local domain architecture

Use separate hostnames on the root path of separate origins:

| Domain | WildFly host role | Content |
|---|---|---|
| `smartmuseum.test` | Static file host | `pwa-client/dist/` |
| `admin.smartmuseum.test` | Static file host | `pwa-admin/dist/` |
| `api.smartmuseum.test` | Application host | One `smart-museum.war`, context root `/`, API paths under `/api` |

No `iam.smartmuseum.test` or `core.smartmuseum.test` is warranted by the current source. The backend is one WAR and auth is a package, not an independent server/API. Keep the management console on loopback (default port 9990) and do not add it as a public demo host.

The frontends are on different origins from `api.smartmuseum.test`, so browser requests need CORS. Use the exact frontend origins:

```text
https://smartmuseum.test
https://admin.smartmuseum.test
```

The client browser API base must be `https://api.smartmuseum.test`; `POST /api/auth/login` is formed by the client API module at `${VITE_API_BASE_URL}/api/auth/login`. The current local `.env` says `http://localhost:8080`, so it must be changed before a production build. Vite embeds `VITE_*` values into static JavaScript at build time; changing WildFly settings later does not alter the bundle.

## F. Windows hosts-file and HTTPS configuration

### F1. Local name resolution

Add the following lines to `C:\Windows\System32\drivers\etc\hosts` using an elevated editor. This report does not modify the hosts file:

```text
127.0.0.1 smartmuseum.test
127.0.0.1 admin.smartmuseum.test
127.0.0.1 api.smartmuseum.test
```

Verify name resolution in PowerShell:

```powershell
[System.Net.Dns]::GetHostAddresses("smartmuseum.test")
[System.Net.Dns]::GetHostAddresses("admin.smartmuseum.test")
[System.Net.Dns]::GetHostAddresses("api.smartmuseum.test")
```

Each should resolve to `127.0.0.1`. Then check listeners:

```powershell
Test-NetConnection smartmuseum.test -Port 8080
Test-NetConnection smartmuseum.test -Port 8443
```

### F2. Port and TLS mismatch

The installed `standalone.xml` has Undertow HTTP and HTTPS listeners, with socket-binding defaults 8080 and 8443; management defaults are 9990 and 9993. The HTTP listener redirects to the configured HTTPS socket. The installed Elytron key manager can generate a self-signed certificate for `localhost` only. That certificate does not establish trusted HTTPS for the three `.test` names.

Hosts entries provide name resolution only; they do not create Undertow virtual hosts, bind ports 80/443, install certificates, or establish browser trust. To use domain URLs without explicit ports, WildFly (or a local reverse proxy) must listen on 80 and 443. The supplied CLI predicates also assume those ports. If staying with WildFly defaults, URLs must include `:8080`/`:8443` and redirect/HSTS predicates must be updated to match.

For HTTPS, create a locally trusted certificate whose Subject Alternative Names include all three names, configure it in WildFly Elytron’s key-store/key-manager/server-SSL-context, and trust its issuing local CA in the Windows/browser trust store. `mkcert` is a convenient local-only method; never use its private key or local CA for production. Verify each URL has no browser certificate warning. Do not enable two-year HSTS preload for these local domains.

## G. Required local `.properties` values

No properties file for the scripts was found. Their expression names imply at least these values; exact format/quoting must be tested with WildFly CLI before execution:

| Script expression | Intended local value |
|---|---|
| `default.path` | Absolute path to client `dist` if the default host is used for the client; otherwise retain the existing default host path and add a dedicated client host |
| `default.aliases` | `smartmuseum.test` only if default host serves client |
| `default.domains` | Explicit allowed local frontend origin domain pattern; prefer replacing regex with exact origins |
| `host.key` | `admin` for the admin static host |
| `host.path` | Absolute path `C:\Users\souro\Desktop\MBK project\pwa-admin\dist` |
| `host.aliases` | `admin.smartmuseum.test` |
| `host.domains` | Exact allowed Origin domains, if the static host truly needs CORS |
| `api.name` | `smart-museum` or an agreed short key such as `api`; must match generated WAR and host resource naming design |
| `api.version` | `1.0.0` only if Maven is configured to emit `smart-museum-1.0.0.war` |
| `api.aliases` | `api.smartmuseum.test` |
| `api.context` | Logging label only in current script; does not change WAR `context-root` |
| `api.domains` | Explicit frontend origins `smartmuseum.test` and `admin.smartmuseum.test`, not a broad wildcard |

Do not put JWT keys, bootstrap password, MQTT credentials, or service token in this file. Deployment properties are not the same thing as backend secrets. Backend environment configuration belongs in a protected WildFly process environment/secret store.

## H. Required CLI design and execution order

The scripts need revision before execution; this is the correct **intended dependency order**, not approval that the current scripts are safe to run:

1. Prepare a backed-up WildFly config, certificate/SSL context, listener ports, and script property values.
2. Correct and apply base/default-host filters once, with exact aliases and safe local headers/CORS.
3. Add a static client host pointing to `pwa-client/dist/` (or deliberately use the default host for that directory).
4. Add a static admin host pointing to `pwa-admin/dist/`.
5. Deploy the single backend WAR and bind it to the API virtual host with context root `/`.
6. Set backend environment variables in the WildFly process, then start/reload and verify.

### CLI script corrections required

- Supply and document every expression/property. Property names currently have no project default values.
- Make every resource-add operation safe to re-run; existing resources should be inspected/updated, not blindly duplicated or silently skipped while incomplete.
- Avoid broad default-host 404-to-index behavior for missing assets and API routes.
- Remove `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Credentials: true`; use exact origins. JWT Authorization does not require credentialed-cookie CORS.
- Align all `%p` redirect/HSTS predicates with actual 80/443 or selected nonstandard ports.
- Add explicit WAR deployment and explicit API virtual-host association; align expected name with Maven output.
- Review Windows quoting/escaping for path properties and `location=\/` using a disposable server.
- Replace long preload HSTS for local development with a conservative local policy.
- Confirm header filters do not emit duplicate or conflicting CORS headers alongside backend `CorsFilter`.

## I. Frontend build and WildFly deployment instructions

### Current build outputs

- Client: Vite `pwa-client/package.json` has `npm run build`; output is `pwa-client/dist/`. This directory exists in the current working copy but is generated/ignored build output, not a guaranteed clean-clone artifact.
- Admin: Vite `pwa-admin/package.json` has `npm run build`; output is `pwa-admin/dist/`, likewise generated and ignored.
- Both `vite.config.js` files contain only the React plugin; no deployment base path or WildFly copy/deploy plugin exists.

### Build for the proposed hostnames

Set client local build configuration (the value is public browser configuration, not a secret) before running Vite:

```env
VITE_API_BASE_URL=https://api.smartmuseum.test
VITE_DATA_MODE=api
VITE_STALE_AFTER_MS=900000
VITE_API_TIMEOUT_MS=10000
VITE_REFRESH_INTERVAL_MS=15000
```

PowerShell build commands:

```powershell
cd "C:\Users\souro\Desktop\MBK project\pwa-client"
npm ci
npm run build

cd "C:\Users\souro\Desktop\MBK project\pwa-admin"
npm ci
npm run build
```

The client’s `.env` is currently API mode but points to `http://localhost:8080`; the checked-in `.env.example` defaults to mock mode and localhost. Admin has no backend API config because it is mock-only.

### Static serving and routing findings

- Vite production output references `/assets/...` at the domain root. This is compatible with serving each app at the root of its own hostname; it is not configured for a subpath.
- Client HTML uses relative manifest/icon links; admin HTML uses root-absolute links. Root-domain deployment is the simplest fit.
- Client app navigation uses hash anchors; Admin navigation uses `#dashboard`, `#devices`, etc. Neither imports React Router or uses history-path routes. A broad SPA 404 fallback is not currently required.
- Client service worker registers `${BASE_URL}service-worker.js`, has app-shell/offline behavior, and avoids `/api/`/Authorization requests. Admin registers `/service-worker.js` at origin root. Separate hostnames give each worker a separate origin/scope.
- Admin uses mock-only service data, so successful static deployment is not proof of a working real Admin workflow.

### WAR deployment

Maven command (from backend) is `mvn clean package`; the actual configured output is `backend/target/smart-museum.war`. A corrected CLI/process must deploy this exact file or Maven must be changed to emit the versioned filename. The API WAR has root context `/`, so it should be isolated by the API virtual host. Confirm the WAR deployment’s `virtual-host` is the API host; current `jboss-web.xml` contains no such setting.

## J. Geolocation and device-zone detection status

**Classification: MISSING.** No latitude/longitude fields, GPS coordinates, boundary/radius calculation, browser geolocation use, map component/provider, or spatial repository model were found.

What is implemented instead:

- `Device`/`DeviceEntity` store a string `zoneId`.
- `UserAccount`/`UserEntity` store allowed zone ID strings.
- Gateway config statically sets `ZONE_ID`; topic path includes zone ID.
- `DiscoveryService.announce()` accepts a zone ID and checks that a later announcement for a known device does not change its zone.
- `DeviceIdentityHandler` checks each measurement’s submitted zone against the stored device zone.
- `AuthorizationService` checks CLIENT access against assigned zone IDs.

This is **zone identity/authorization**, not physical detection. The backend has no Zone entity/API, so it cannot validate a zone against a canonical zone registry. A service-token-authenticated announcement can register a new device with a syntactically valid zone string.

**Recommended demonstration approach:** manually provision a mapping from gateway/device identity to a known zone, use fixed `ZONE_ID` in gateway config (or a QR code encoding a provisioned ID), and require ADMIN approval before a device is trusted. Keep the mapping authoritative on the backend/registration record; do not infer room from indoor GPS. MQTT broker ACLs/client identity should constrain which device can publish to which topic. Backend already verifies device-zone consistency and CLIENT zone authorization after registration.

## K. End-to-end workflow status

| Workflow | Classification | What source implements | Missing connection / verification |
|---|---|---|---|
| First ADMIN bootstrap | IMPLEMENTED, NOT VERIFIED in this audit | `BootstrapAdmin` consumes all three bootstrap environment variables and provisions an active ADMIN if absent | Must be configured before WildFly starts; no password reset; clean database and bootstrap lifecycle not rerun here |
| ADMIN login/JWT | IMPLEMENTED | `AuthResource`, `UserAuthenticationService`, `PasswordHasher`, `AccessTokenService` | No browser Admin login UI; runtime auth was not reverified here |
| Protected API and role/zone checks | IMPLEMENTED in backend | `UserAuthenticationFilter`, `AuthorizationService`, secured resources | Current domain CORS/TLS/deployment host not configured or tested |
| CLIENT provisioning | PARTIALLY IMPLEMENTED | ADMIN-only `POST /api/users` creates a CLIENT with zone IDs | No Admin UI call; no zone registry or account CRUD |
| Actual Admin device inventory | Backend API IMPLEMENTED; Admin UI MOCKED | `GET /api/devices`, `GET /api/devices?status=pending` require bearer token | `pwa-admin` reads fixtures, not API; persistent backend inventory is not shown there |
| Device approve/reject | Backend API IMPLEMENTED; UI MOCKED | `POST /api/devices/{id}/approve|reject` persists status | Admin prototype only changes page state; no real UI token/action flow |
| TD discovery | Backend API PARTIAL | `POST /api/things` validates and stores a TD/device announcement | Gateway does not publish TD; Node-RED flow absent |
| Sensor read | IMPLEMENTED in gateway | Real BME280 over I2C and simulator source | Physical hardware was not tested; simulator path not run here |
| MQTT publishing | IMPLEMENTED in gateway source | Telemetry/status topics, QoS, reconnect, retained status/LWT | No broker config/deployment; publish acknowledgment is ignored by run loop |
| MQTT-to-backend relay | MISSING from checkout | Described as Node-RED in docs | No flow, broker, credentials/ACL or service-token forwarding configuration |
| Service-token ingestion | Backend IMPLEMENTED | `ServiceTokenFilter` protects ingestion and TD POST | Relay never exercised; service token must remain server-side |
| Mongo persistence | IMPLEMENTED in backend | JNoSQL repositories and Mongo collections | Local compose has no auth and binds published port broadly; indexes not declared here |
| Client login and live data | IMPLEMENTED in source | PWA login, JWT storage, health, devices/latest/history API calls | Requires a real provisioned account, host/TLS/CORS settings and actual readings |
| Client history/chart | IMPLEMENTED in source | History filters, API client, chart utilities/components | No live readings available without ingestion; not runtime tested here |
| Real/simulated display | PARTIAL | Source field accepted and mock fixtures are labeled | No relay to set source and no physical sensor run; verify UI labels reflect live source clearly |
| Admin users/zones/thresholds | MOCKED or MISSING | UI fixtures only | No corresponding production API/model for full management; no alert/threshold engine |

## L. Missing components and integration blockers

1. No supplied properties file for the CLI expressions.
2. `add-api.cli` expects a WAR name incompatible with the actual Maven output.
3. No CLI deployment operation; no source configuration binds the root WAR to `api-host`.
4. No copy/deployment mechanism from either Vite `dist` directory into WildFly beyond the external CLI design.
5. No Node-RED flow or MQTT broker deployment/configuration in the repository.
6. Gateway emits telemetry and status, but no TD announcement; ingestion payload requires a `source` field the gateway intentionally omits.
7. Admin PWA does not authenticate or call API; device decisions are not persistent.
8. No Zone CRUD/canonical zone records, thresholds, alerts, or physical location model.
9. No trusted local TLS certificate for the three requested domains; current generated cert targets `localhost`.
10. CLI redirects assume ports 80/443 while installed WildFly defaults to 8080/8443.
11. CLI scripts lack full idempotency and exact CORS behavior conflicts with browser rules and application-level CORS.

## M. Security and configuration risks

| Risk | Evidence and current behavior | Required change / verification |
|---|---|---|
| Mongo exposure | `backend/docker-compose.dev.yml` publishes `27017:27017`, no auth/bind restriction | Local-only bind `127.0.0.1`; production private/authenticated Mongo; verify listening interface and unauthenticated access denied |
| JWT signing key | `AccessTokenService` requires Base64 key >=32 decoded bytes; no bundled fallback | Use protected WildFly environment/secret store; never Vite; verify startup rejects missing/weak key |
| Bootstrap account | `BootstrapAdmin` reads password from WildFly process env and leaves env value configured | Remove after first successful bootstrap; use protected secret handling; verify no value in logs/repo |
| Ingestion token | `ServiceTokenFilter` uses `INGEST_SERVICE_TOKEN`; README has dev example | Unique random server-only token; pass only from trusted relay; verify 401 with missing/wrong token and success with right token |
| CORS | Backend `CorsFilter` exact allowlist supports Authorization, but script adds wildcard plus credentials | Set `CORS_ALLOWED_ORIGINS=https://smartmuseum.test,https://admin.smartmuseum.test`; no wildcard/no credentials; test OPTIONS and browser login/data requests |
| TLS | Installed default certificate generated for `localhost`; not suitable for `.test` aliases | Trusted SAN certificate for all domains and configured Elytron context; verify certificate chain and hostname in browser/curl |
| Redirect/HSTS | Scripts only match 80/443, HSTS preload 2 years; default WildFly ports are 8080/8443 | Align ports; avoid preload for local; verify redirects preserve intended host/path/query and HTTPS works |
| MQTT | Gateway defaults to port 1883, optional auth, TLS disabled | Require broker auth/TLS/ACLs for non-isolated network; test unauthorized publishers cannot impersonate zone/device |
| Frontend secrets | Client `.env` contains API URL/data mode only; API module sends bearer but no service token | Keep all server secrets out of `VITE_*`; inspect built assets for secret-like values before demo |
| Admin access | Admin frontend has no auth because prototype uses fixture data | Do not expose it as an operational admin tool until JWT login/API integration exists |
| WildFly management | Default management listener ports 9990/9993 | Keep bound to loopback/admin-only; do not create public aliases for management console |

## N. Step-by-step demonstration plan (after deployment fixes)

This is a preparation/run plan; it was not executed as part of the audit.

### N1. PowerShell preparation and production builds

```powershell
$project = "C:\Users\souro\Desktop\MBK project"
$wildfly = "C:\wildfly-41.0.1.Final\wildfly-42.0.0.Final"

[System.Net.Dns]::GetHostAddresses("smartmuseum.test")
[System.Net.Dns]::GetHostAddresses("admin.smartmuseum.test")
[System.Net.Dns]::GetHostAddresses("api.smartmuseum.test")
Test-NetConnection api.smartmuseum.test -Port 443

Set-Location "$project\pwa-client"
$env:VITE_API_BASE_URL = "https://api.smartmuseum.test"
$env:VITE_DATA_MODE = "api"
npm ci
npm run build

Set-Location "$project\pwa-admin"
npm ci
npm run build

Set-Location "$project\backend"
mvn clean package
Get-ChildItem .\target\*.war | Select-Object Name,Length
```

Expected: all three hostnames resolve to loopback; HTTPS port check succeeds after listeners are configured; each Vite build completes and emits files under its `dist` directory; Maven emits the exact WAR name chosen in section C. The environment values for Vite are embedded at build time. For the default 8080/8443 listener plan, use `https://api.smartmuseum.test:8443` in `VITE_API_BASE_URL` and test that port instead.

### N2. WildFly properties, environment and CLI order

Create separate non-secret property files/values for the default host, each static host, and API host, matching section G. After correcting and testing the scripts against a disposable copy, the invocation pattern is:

```powershell
& "$wildfly\bin\jboss-cli.bat" --connect --file="C:\path\to\corrected\default-host.cli"
& "$wildfly\bin\jboss-cli.bat" --connect --file="C:\path\to\corrected\client-host.cli"
& "$wildfly\bin\jboss-cli.bat" --connect --file="C:\path\to\corrected\admin-host.cli"
& "$wildfly\bin\jboss-cli.bat" --connect --file="C:\path\to\corrected\api-host.cli"
```

The supplied CLI files do not include `client-host.cli`; `default-host.cli` could serve the client if configured for the client dist directory, or a separately parameterized `add-host.cli` invocation could do so. The command sequence above is a template only: exact property-loading/invocation mechanics must be confirmed for the corrected scripts. Do not execute the supplied scripts unchanged against the active WildFly installation.

Set backend variables in the PowerShell process that launches WildFly (values are intentionally not recorded in this report):

```powershell
$env:INGEST_SERVICE_TOKEN = Read-Host "Set the local service token"
$env:CORS_ALLOWED_ORIGINS = "https://smartmuseum.test,https://admin.smartmuseum.test"
$env:JWT_SIGNING_KEY_BASE64 = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:JWT_ISSUER = "smart-museum"
$env:JWT_ACCESS_TOKEN_SECONDS = "900"
# First startup only: set BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_EMAIL,
# then read BOOTSTRAP_ADMIN_PASSWORD securely as described in backend/README.md.
& "$wildfly\bin\standalone.bat"
```

The random JWT key above changes every time it is generated. Store the demonstration key securely and reuse it across restarts if existing access tokens must remain valid. Remove the bootstrap password from the process environment after successful first-account creation. To use clean domain URLs, configure HTTP/HTTPS listeners on 80/443 (or a local reverse proxy); otherwise include `:8080`/`:8443` in URLs and update redirect predicates.

### N3. Post-deployment checks

```powershell
curl.exe -i https://api.smartmuseum.test/api/health
curl.exe -i -X OPTIONS "https://api.smartmuseum.test/api/auth/login" `
  -H "Origin: https://smartmuseum.test" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type,authorization"
curl.exe -I https://smartmuseum.test/
curl.exe -I https://admin.smartmuseum.test/
```

Expected: health body reports Mongo `UP`; preflight allows the exact requesting origin and `Authorization`/`Content-Type`; each static host returns the correct app HTML. Also open each domain in a browser, check Console/Network for certificate, MIME, CORS, asset, service-worker errors, and verify the served client bundle references `https://api.smartmuseum.test` rather than localhost.

### 1. Confirm prerequisites and working tree

Use PowerShell and confirm Java 21, Maven, Node/npm, Docker, installed WildFly 42, and the expected project branch. Preserve the untracked handoff PDF. Confirm no server is using 80/443/8080/8443/27017 unexpectedly.

### 2. Start Mongo and build the backend

From `backend/`, start Mongo with the corrected local loopback Compose configuration, then run `mvn clean package`. Confirm the resulting WAR filename matches the corrected CLI property.

### 3. Configure trusted local HTTPS and hostnames

Add the three hosts-file entries, issue/install a locally trusted SAN certificate, configure WildFly Elytron, align HTTP/HTTPS bindings with 80/443 (or commit to explicit 8080/8443 URLs), then validate name resolution, TCP listeners, TLS hostname, and redirect behavior.

### 4. Configure backend environment and deploy

Set `INGEST_SERVICE_TOKEN`, `JWT_SIGNING_KEY_BASE64`, `JWT_ISSUER`, `JWT_ACCESS_TOKEN_SECONDS`, `CORS_ALLOWED_ORIGINS` and optional first ADMIN bootstrap variables in the same environment that launches WildFly. Deploy one matching WAR to the API virtual host. Keep management private. Verify `GET https://api.smartmuseum.test/api/health` and inspect WildFly deployment logs.

### 5. Build and serve both PWAs

Set client `VITE_API_BASE_URL=https://api.smartmuseum.test` and `VITE_DATA_MODE=api`; run `npm ci` and `npm run build` under each PWA. Map Client dist and Admin dist to the two static hosts. Verify index, JS/CSS, icons, manifest, and service worker load without 404s or MIME errors.

### 6. Validate authentication and roles

- Login first ADMIN through Client PWA or a secure PowerShell/API client.
- Verify login returns a short-lived bearer and protected request succeeds.
- Verify no-token request gets 401.
- Provision a CLIENT with a known zone using `POST /api/users` as ADMIN.
- Verify CLIENT sees assigned zone and receives 403 for unassigned zone.
- Verify ADMIN approval endpoint changes persisted device state.

For the professor’s demonstration, the real persistent Admin actions must be available via an API-integrated Admin UI or safely shown with a tested HTTP client; current Admin PWA does not do this.

### 7. Trace one simulated measurement end to end

Before claiming an IoT demo, deploy/configure a local broker and relay flow, constrain MQTT topics, set the relay’s backend service token, and implement/verify `source` assignment. Run the gateway simulator with fixed provisioned device/zone IDs, observe its MQTT topic and payload, confirm relay POST success, confirm measurement record in Mongo/API history, then sign in as the assigned CLIENT and show the latest value/history/chart. Record the measurement ID and timestamps for traceability.

## O. Prioritized implementation tasks with evidence and verification

| Priority | File(s) to modify later | Required change | How to verify |
|---|---|---|---|
| P0 | `backend/pom.xml`; `backend/src/main/webapp/WEB-INF/jboss-web.xml`; corrected `add-api.cli` | Align WAR filename and explicitly attach/deploy it to API virtual host | Maven output exact name; WildFly deployment log; health URL under API domain |
| P0 | `default-host.cli`, `add-host.cli`, `add-api.cli`, new deployment `.properties` | Define values, make reruns safe, narrow CORS, correct fallback/ports, test Windows quoting | Apply on disposable WildFly copy twice; second run succeeds without duplicate/partial resources; inspect model |
| P0 | WildFly standalone/Elytron configuration (not in repo) and local certificate instructions | Trusted SAN certificate for all 3 names; 80/443 listener or deliberate explicit port plan | Browser certificate validation and HTTP→HTTPS checks for all names |
| P0 | `backend/docker-compose.dev.yml` | Restrict published Mongo to loopback; production deployment must add auth/private network separately | `docker ps`, local connect succeeds, LAN connect denied |
| P0 | New MQTT broker + Node-RED deployment/flow artifacts and `gateway-agent`/protocol docs | Complete MQTT→HTTP relay, add TD discovery publication path, source mapping, service token protected | Publish simulated telemetry, inspect relay response, query stored history as authorized client |
| P1 | `pwa-admin/src/admin/services/adminService.js`, `pwa-admin/src/admin/AdminApp.jsx`, shared auth/API client | Add real ADMIN sign-in/API-backed inventory and persisted approve/reject/client provisioning; keep unsupported pages clearly mock | Approve device in UI, reload and confirm backend status; verify CLIENT gets 403 for admin routes |
| P1 | `backend/src/main/java/tn/supcom/museum/rest/MeasurementResource.java`, `backend/src/main/java/tn/supcom/museum/repository/MeasurementRepository.java`, `backend/src/main/java/tn/supcom/museum/data/MeasurementData.java`, new Mongo index configuration | Validate property/date order/limit and create indexes/query strategy | Unit/integration tests for invalid parameters; explain plans and load test |
| P1 | `backend/src/main/java/tn/supcom/museum/wot/DiscoveryService.java`, `backend/src/main/java/tn/supcom/museum/repository/ThingRepository.java`, `backend/src/main/java/tn/supcom/museum/repository/DeviceRepository.java` | Make device+TD updates atomic or repair partial records | Inject Mongo failures and concurrent duplicate announcements |
| P1 | `backend/src/main/java/tn/supcom/museum/security/UserAuthenticationService.java`, `backend/src/main/java/tn/supcom/museum/repository/UserRepository.java`, edge/server config | Add login throttling and robust duplicate insert handling | Rate-limit tests; concurrent same-email create returns stable 409 |
| P1 | `backend/src/main/java/tn/supcom/museum/wot/ThingDescriptionValidator.java`, WildFly/proxy request-size configuration | Bound payload size/depth/strings and document supported TD subset | Oversize/deep/invalid URI/security tests; conformance fixture set |
| P2 | Backend root README/docs and `contracts/openapi.yaml` | One authoritative Windows domain/TLS deploy guide and contract aligned with actual auth/status/limits | Follow from clean checkout; validate OpenAPI against integration responses |
| P2 | Zone model and APIs (not currently present), gateway provisioning process | Define manual zone registry and device-to-zone enrollment; optionally future mapping metadata | Unknown zones rejected; device announcement zone matches provisioned identity |
| P2 | CI workflows/config (not established by this inspection) | Run backend, PWA, gateway, contract and dependency/security checks | Clean CI run on `main` |

## P. Final professor-demo readiness checklist

### Architecture/deployment

- [ ] Confirm one backend WAR, not separate IAM/CORE deployments.
- [ ] Resolve Maven/CLI WAR filename mismatch.
- [ ] Deploy WAR to `api.smartmuseum.test` virtual host at root context; `/api/health` responds.
- [ ] Serve client/admin `dist` files from their respective WildFly static hosts.
- [ ] Correct CLI expression values, path quoting, idempotency, CORS and 404 behavior.
- [ ] Configure listener ports consistently; management stays private.
- [ ] Trusted certificate covers all domains; browser has no TLS warning.
- [ ] Hosts entries resolve to loopback.

### Authentication/Admin/Client

- [ ] First ADMIN bootstrapped; bootstrap secret removed from process environment after setup.
- [ ] ADMIN login, JWT request, missing-token 401 and CLIENT zone-denial 403 demonstrated.
- [ ] CLIENT account provisioned with real zone assignment.
- [ ] Admin page either connected to backend or explicitly presented as a prototype; no mock action described as persistent.
- [ ] Device list, pending list, approve/reject persistence, latest readings and history verified.
- [ ] CORS allows exactly Client/Admin origins and Authorization preflight succeeds.

### IoT trace

- [ ] Broker starts with authentication/ACLs and TLS appropriate to the local setup.
- [ ] Node-RED/relay flow is available, configured, and verified; service token stays server-side.
- [ ] Gateway simulator/device identity and fixed zone are provisioned.
- [ ] A telemetry payload is observed on the expected topic and relayed with `source`.
- [ ] Backend accepts measurement; Mongo/API confirms the measurement ID.
- [ ] Client PWA displays the same reading and historical record for an authorized zone.

**Current readiness conclusion:** Backend and Client source implement much of the application core, and the developer previously reported a local backend health check success. A domain-based demonstration is **not yet reproducible from the inspected repository/scripts as supplied**. The CLI scripts need correction and isolated validation, the local domain certificate/port/host deployment is not configured, Admin is mock-only, and the MQTT-to-backend relay is absent. Do not claim the complete Admin + sensor + Client demonstration until each checklist path has been verified.

## Files to modify later (none modified by this audit)

1. `backend/pom.xml` — resolve WAR naming if the versioned CLI naming is retained.
2. `backend/src/main/webapp/WEB-INF/jboss-web.xml` — bind the application to the API virtual host if required by the selected WildFly topology.
3. `backend/docker-compose.dev.yml` — local Mongo loopback binding.
4. `backend/src/main/java/tn/supcom/museum/config/CorsFilter.java` and protected deployment environment config — exact HTTPS origins for the domain demo.
5. `pwa-client/.env` (local ignored file) or a documented deployment env file — API domain and API mode before building.
6. `pwa-admin/src/admin/services/adminService.js` and `pwa-admin/src/admin/AdminApp.jsx` — only if connecting persistent ADMIN workflows.
7. `default-host.cli`, `add-host.cli`, `add-api.cli` — correct properties, CORS, ports, idempotency, deployment and host binding.
8. New CLI property/config file — non-secret local host paths/aliases and deployment metadata.
9. New broker/Node-RED deployment and flow files (or a pinned external integration link) — complete telemetry and TD relay.
10. `gateway-agent/src/gateway_agent/agent.py`, `mqtt_client.py`, configuration/docs — TD discovery and publish delivery feedback if required by final flow.
11. `README.md`, `backend/README.md`, `DOCS/ADMIN_PWA.md`, `gateway-agent/README.md`, `contracts/openapi.yaml` — align instructions and contract with the demonstrable architecture.

Do not edit `C:\Windows\System32\drivers\etc\hosts`, WildFly installation files, or the handoff PDF as part of source remediation without a separate explicit deployment task.
