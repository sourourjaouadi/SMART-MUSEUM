# P3 frontend audit: Client and Admin PWAs

**Date:** 2026-11-23. **Branch:** `feature/p3-demo-workflow`, based on `main` at `89217da`.
**Environment:** local WildFly 42 over HTTPS and the isolated `museum_m2_sandbox`
database. Nothing here was checked on a public server: none exists yet.

## Summary

Both PWAs use the real middleware API, and a change made in the Admin appears in
an open Client at its next automatic refresh. The frontend workflow (P3.6) is written
but has not run on GitHub yet. Public verification (P3.7) is not done.

## How it was checked

- **Automated tests:** Client 46 node + 14 component, Admin 17 node + 45 component.
- **Browser run:** headless Microsoft Edge with normal certificate checks, Admin and
  Client open together, 46 checks, all passed. The devices, zones, account and
  measurements were created through the real API and deleted afterwards. The
  measurements were test values sent to `POST /api/ingest/measurements`; no physical
  sensor, MQTT broker or Node-RED was involved. The driver script is not in the repository.
- **Acceptance suite:** `deployment/test-m2-runtime.ps1`, passed.
- **Clean clone:** `npm ci`, tests and API builds of both PWAs, passed on Windows with Node 24.

## Results by task

| Task | Result |
|---|---|
| P3.1 Audit | Done: this document |
| P3.2 Client | Verified in the browser: sign-in, authorized zone and devices, latest readings (temperature, humidity, pressure), real/simulated labels, fresh and stale states, automatic refresh, empty and offline states, history with filters, chart and table, 375 px layout, installability criteria, no API response in the service-worker cache. Loading and other error states: component tests only |
| P3.3 Admin | Verified in the browser: ADMIN sign-in, refusal of disabled accounts, Thing Description, approval, zones, coordinates, device location, CLIENT creation with zones. Rejection, location inheritance and refusal of CLIENT accounts: browser run of 2026-11-16 and current component tests |
| P3.4 Admin to Client | Verified; repeatable with [P3_DEMO_SCRIPT.md](P3_DEMO_SCRIPT.md) |
| P3.5 Production builds | Ready for a public URL: the API URL is a build variable, and API builds contain no sample records and no local URL when another one is given |
| P3.6 CI | `.github/workflows/frontend-ci.yml`: linted with actionlint and its steps run in Linux containers with Node 24; first run on GitHub still to be checked |
| P3.7 Public verification | Waiting for the server, domain and HTTPS |

## Authorization checked with a CLIENT token

`403` from the API for an unassigned zone (latest, history, zone, device) and for ADMIN
operations (approve, edit a zone, read a Thing Description, create an account). The same
token reads its own zone (`200`). Disabling the account ends the open Client session.

## Problems found and fixed on this branch

1. The Client API build still offered demo data on sign-in and on the dashboard.
2. The Client did not show the zone name set by the administrator.
3. The Admin showed only the ID of a Thing Description, not its content.
4. The Admin API build shipped sample records and offered a Thresholds page with no endpoint behind it.
5. The Admin layout overflowed and its form fields overlapped, on desktop and on mobile.
6. Pending devices in live mode were described as a simulated decision.

## Known limits

- The Admin does not refresh by itself: reload the page to see a newly announced device.
- The Client zone list comes from devices, so an assigned zone without a device is not listed.
- The zone selector shows the zone ID; the administrator's name appears in the zone panel.
- The history chart has no axis labels; exact values are in the table next to it.
- Alerts are a labelled placeholder. Thresholds and the user list have no endpoint.
- Installation on a physical phone was not tested.

## For the CI owner (P2)

Node **22.12 or later 22.x, or 24.x**: Vitest 5 does not support Node 20. Run in each of
`pwa-client` and `pwa-admin`:

```bash
npm ci
npm test          # exits non-zero on any failure (checked)
VITE_DATA_MODE=api VITE_API_BASE_URL=https://<public-api-host>/api npm run build
mvn -B -f deployment/pom.xml clean package
```

- WARs: `pwa-client/deployment/target/smart-museum-client.war` and
  `pwa-admin/deployment/target/smart-museum-admin.war`.
- `VITE_*` values are public. Never put a token or a password in them.
- `CORS_ALLOWED_ORIGINS` must contain both exact public PWA origins.
- At `89217da`, `middleware-ci.yml` is rejected by actionlint (`pull_request` inside `push`,
  undefined `java` variable) and calls `deployment/build-linux.sh`, which is not in the repository.
- Set the repository variable `PUBLIC_API_URL` to have the workflow upload the two WARs.
- Branch `feature/p2-production`: `build-all.ps1 -ApiBaseUrl`, and the server scripts.
