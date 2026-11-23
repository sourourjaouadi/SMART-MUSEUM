# Smart Museum Admin PWA

## Structure and independent use

`pwa-admin/` is an independent React + Vite application beside `pwa-client/`.
It has its own package manifest and lockfile, Vite/Vitest configurations,
entry point, PWA manifest, icons, and service worker. It does not import or
require the client app.

Run from the repository root:

```powershell
cd pwa-admin
npm ci
npm run dev
npm test
npm run build
```

The production build is written to `pwa-admin/dist/`.

`npm test` runs the service-layer node tests (`src/admin/services/*.node.test.js`)
and then the Vitest component tests.

## Data modes and sign-in

`VITE_DATA_MODE` selects the build mode (`src/admin/services/adminDataSource.js`):

- `api` (used by `deployment/build-all.ps1` with
  `VITE_API_BASE_URL=https://api.smartmuseum.test/api`): the only way in
  is a real ADMIN sign-in through `POST /api/auth/login`. There is no demo entry.
- `mock` (default for `npm run dev` and tests): the sign-in screen also offers
  "Continue with demo data", which opens the local mock workspace below.
  Signing in still uses the real API.

A CLIENT (or disabled) account is refused in the UI and no session is stored.
The ADMIN session (token, expiry, account) is kept in `sessionStorage` under
`smart-museum.admin.session`, separate from the Client PWA, and is cleared on
sign-out, on expiry, and on any protected `401`; the app then returns to the
sign-in screen with a "session ended" notice. No credentials are stored in code.

The API origin must allow the Admin origin: DEV `CORS_ALLOWED_ORIGINS` includes
`https://admin.smartmuseum.test` (`middleware/config/dev.properties`,
`dev.env.example`; restart WildFly after changing `dev.env`). PROD origins
come from the `prod.*.example` templates.

## Pages in API mode

| Page | Middleware calls |
|---|---|
| Overview | `GET /api/devices`, `GET /api/zones`; KPIs by API status (total, active, pending, offline or rejected, registered zones) |
| Device inventory | `GET /api/devices`; filters use the API statuses `active`, `pending`, `offline`, `rejected` |
| Pending approvals | `POST /api/devices/{id}/approve` or `/reject`, then the list is reloaded |
| Zones | `GET /api/zones`, `PUT /api/zones/{zoneId}` (name + WGS84 location). Device zones without a zone record are listed as "No zone record yet" and can be created |
| Device location | `PUT` / `DELETE /api/devices/{id}/location`; inherited locations are labelled "from zone", own positions "own position"; the zone never changes |
| Users | "Create a CLIENT account" form using `POST /api/users`. The user list is **not connected yet** (no list endpoint) |
| Thing Description | `GET /api/things/{id}`, from Pending approvals and from device details |
| Thresholds | Not offered in API mode: no thresholds endpoint. Mock mode keeps illustrative values |

Location, zone-name and account fields are validated locally with the backend
rules before any request.

Error states: `401` returns to sign-in; `403` "requires an administrator
account"; `404` "no longer exists" and the data is reloaded; `409` shows the
reason (device not approved for a location, no Thing Description for an
approval, duplicate account email); `400` shows the server's validation message;
network failures and timeouts show a message, with Retry when loading.

## Mock mode features

- Overview counts total mock inventory records, explicitly online and offline
  mock connectivity, pending devices, and active zones. Pending and maintenance
  records have no connectivity value and are excluded from online/offline
  totals.
- No recent-activity feed is shown because the mock data has no event/activity
  records; the app does not fabricate an audit history.
- Device inventory supports text search, status filtering, zone filtering, a
  combined filter state, and a reset control.
- Device details show fields present in the fixture, including `lastSeenAt`.
  The admin mock has no measurement records, so the detail view states that
  measurement data is unavailable instead of inventing a reading.
- Pending devices can be approved or rejected in local mock state only. The
  service rejects unknown IDs, invalid decisions, and decisions for devices
  that are no longer pending. Processing disables the decision controls.
- Zone device counts are derived from device-to-zone records. The zone table
  shows WGS84 coordinates (sample values in central Tunis); a form edits a
  zone's latitude, longitude and floor. Device details show the device location
  (own position or inherited from its zone) and can assign or clear an own
  position for approved devices; the zone never changes. These edits use the
  same validation as the backend but stay in local mock state, like approvals.
  Threshold and user views remain read-only.
- User entries distinguish mock application role labels (`ADMIN`/`CLIENT`)
  from professional job titles. They do not represent real accounts or grants.
- Loading, retryable error, and page-specific empty states are provided.

The `connectivity` property in `src/admin/data/mockData.js` is explicitly
prototype-only fixture metadata for the online/offline dashboard KPI. It is
not a proposed backend field or API contract. Threshold values are illustrative
and have not been approved as conservation policy.

## Offline behavior and limits

After a successful production visit, the admin service worker precaches the
application shell, its built JavaScript and CSS, manifest, offline page, and
icons. It uses network-first navigation with a cached shell fallback and
cleans up only older caches with the admin-specific cache prefix. The worker
does not handle cross-origin requests or cache unrecognized assets.

Offline support is limited to loading the application shell and its cached
bundle. API data is never cached (the worker ignores cross-origin requests),
so API mode needs a connection; administrative actions are not queued offline.
Simulated decisions in mock mode remain in page memory and are lost on reload.

## Deployment assumption

The current HTML, manifest, and service-worker registration use root-absolute
paths such as `/icons/...` and `/service-worker.js`, with a `/` manifest scope.
Deploy this build at the root of a dedicated origin so its root-scoped worker
cannot control another application. Hosting under a subpath or on the same
origin as another PWA requires a coordinated Vite base path, manifest URLs,
asset URLs, and service-worker scope change before deployment.

## Local WildFly static WAR (M1)

The Admin PWA is packaged separately as `smart-museum-admin.war` and served at
the root of the `admin-smartmuseum-host` Undertow host. Build and package it
from `pwa-admin/`:

```powershell
npm ci
npm test
npm run build
mvn -f deployment/pom.xml package
```

The output is `deployment/target/smart-museum-admin.war`. It contains the
production `dist/` bundle and its own root-context WildFly descriptor. For the
WildFly deployment, build with `deployment/build-all.ps1` so the bundle is in
`api` mode with the HTTPS API URL. See
[`deployment/README.md`](../deployment/README.md) for local aliases, WildFly
setup, verification, HTTPS requirements, and rollback.

## Not connected yet

- User list: the middleware has no endpoint that lists accounts (IAM scope).
- Thresholds: no thresholds endpoint or alert evaluation.
- Admin has no direct MQTT/Node-RED or database access; all data goes through
  the public API with the ADMIN Bearer token.
