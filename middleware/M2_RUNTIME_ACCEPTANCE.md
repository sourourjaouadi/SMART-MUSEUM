# M2 Runtime and HTTPS Acceptance Report

**Date:** 2026-11-15  
**Branch:** `feature/m2-independent-wars`  
**Scope:** M2 runtime, local HTTPS, PWA integration, authentication/authorization, and deployment acceptance. No M3/M4 work is included.

## Result

Runtime acceptance passed for the modular WildFly deployment. CORE, IAM, and
API run as separate WARs; Client and Admin are separate PWA WARs. Public
contexts are HTTPS only, and CORE/IAM business routes are internal service
interfaces. The acceptance run used only the dedicated M2 Mongo sandbox.

## Deployment and service checks

- WildFly 42 reports all five deployments enabled and `OK`:
  `smart-museum-core.war`, `smart-museum-iam.war`, `smart-museum.war`,
  `smart-museum-client.war`, and `smart-museum-admin.war`.
- API health at `/api/health`, CORE health at `/core/health`, and IAM health at
  `/iam/health` returned HTTP 200 with status and Mongo reported `UP`.
- CORE and IAM business operations require the internal service token. Public
  requests to their context paths are not exposed through their public hosts.
- HTTP requests to the Client, Admin, and API public hosts redirected to the
  matching HTTPS host.
- The deployment uses distinct Undertow hosts: Client and Admin at `/`, API at
  `/api`; CORE and IAM use internal contexts `/core` and `/iam`.

## HTTPS and browser checks

- A local mkcert CA is trusted for the current Windows user. The local
  certificate covers `smartmuseum.test`, `admin.smartmuseum.test`,
  `api.smartmuseum.test`, `localhost`, and `127.0.0.1`.
- OpenSSL strict chain and hostname validation passed for the public HTTPS
  endpoints. Headless Edge with its normal certificate validation loaded the
  Client, Admin, and API pages without certificate errors.
- Edge confirmed the Client is a secure context, its service worker is
  activated, its manifest is served as `application/manifest+json`, and its
  API health request succeeds. The authenticated cross-origin request produced
  the expected API 401 response, with no CORS fetch failure or mixed-content
  error.
- Windows curl using Schannel can report `CRYPT_E_NO_REVOCATION_CHECK` for the
  local development certificate because it has no revocation endpoint. No
  certificate-validation bypass was used. OpenSSL with the local mkcert root
  and the normal Edge profile both verified HTTPS successfully.
- `deployment/prepare-local-https.ps1` was rerun successfully and verified the
  existing trust, certificate, SANs, and password-protected PKCS#12 keystore
  without printing secret values. `deployment/configure-wildfly-https.ps1`
  confirmed the existing environment-backed TLS resources without changing
  them.

## Build and tests

`deployment/build-all.ps1` completed successfully:

- Client Node tests: 40 passed.
- Client Vitest: 10 passed.
- Admin Vitest: 13 passed.
- Middleware Maven tests: 47 passed (CORE 33, IAM 9, API 5); no failures or
  skips.
- All five WAR artifacts were generated and inspected. The API WAR does not
  bundle the CORE/IAM implementations or persistence/security runtime
  libraries; those remain with their respective service deployments.
- The Client production bundle points to
  `https://api.smartmuseum.test:8443/api` and does not contain the development
  API URL or a Vite API environment variable.

## API and security acceptance

`deployment/test-m2-runtime.ps1 -ConfirmSandboxWrites` completed successfully.
It checked public health and PWA resources; approved and unapproved CORS
preflights; ADMIN login and safe response fields; invalid credentials and
invalid/expired tokens; internal-token enforcement; Thing Description
registration and idempotency; device approval/rejection; measurement
validation and idempotency; CLIENT provisioning, login, zone scoping and
denials; account disablement and role-change token invalidation; and final
deployment status.

The run created test users, Things, and measurements in
`museum_m2_sandbox`. Test status and role changes were restored where the test
requires restoration. Test records remain in that sandbox. No test operation
targeted the original `museum` database, `museum-mongo` container, or
`backend_mongo-data` volume.

The API runtime was corrected during acceptance so approve/reject operations
use the CORE POST contract, and allowed CORS preflights return the expected
headers while unapproved origins are rejected. The final rebuilt API WAR was
redeployed after these fixes.

## Database isolation

Development uses `museum-m2-sandbox-mongo`, bound to loopback port 27018, with
volume `museum-m2-sandbox-data` and database `museum_m2_sandbox`. The original
MongoDB container, database, and persistent volume were preserved and not
modified.

## Rollback status and limitations

Timestamped WildFly backups exist, and the deployment scripts validate the
API backup SHA-256 before replacement or rollback. **The rollback drill was
not run**, at the operator's request. Rollback is therefore available but not
runtime-verified; this report does not mark rollback acceptance complete.

The local TLS certificate is for development only. Production deployment
still requires production certificate management, secrets, allowed origins,
service URLs, and an appropriate public TLS/reverse-proxy topology.
