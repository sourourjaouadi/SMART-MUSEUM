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

## Current features

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
- Zone device counts are derived from device-to-zone records. Zone, threshold,
  and user views remain read-only.
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
bundle. There is no live data, backend connection, or durable storage for
administrative actions. Simulated decisions remain in page memory and are
lost on reload.

## Deployment assumption

The current HTML, manifest, and service-worker registration use root-absolute
paths such as `/icons/...` and `/service-worker.js`, with a `/` manifest scope.
Deploy this build at the root of a dedicated origin so its root-scoped worker
cannot control another application. Hosting under a subpath or on the same
origin as another PWA requires a coordinated Vite base path, manifest URLs,
asset URLs, and service-worker scope change before deployment.

## Future backend integration

`src/admin/services/adminService.js` is the mock data boundary. Replace its
fixture operations only after the team agrees the API paths, request/response
schemas, status-transition rules, error semantics, persistence behavior, and
authorization model. Normalize any future API data into the view model the UI
uses. Do not put privileged credentials in browser code. This prototype has no
authentication, authorization, real account management, threshold editing,
alert evaluation, MQTT/Node-RED integration, or direct database access.
