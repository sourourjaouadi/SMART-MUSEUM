# Smart Museum Client PWA

Responsive React + Vite dashboard for museum environmental monitoring. The
dashboard starts in **Demo preview** mode and uses clearly labeled mock
measurements, so it can be developed before the backend is available.

For the complete Person 3 overview, functional guide, API boundary, Mermaid
diagrams, and test coverage, see the [PWA documentation](../DOCS/pwa-client.md).

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Local development

From this directory, install dependencies and start the development server:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open the local URL printed by Vite. `.env.example` uses
`VITE_API_BASE_URL=http://localhost:8080` and `VITE_DATA_MODE=mock`.
Keep `mock` for standalone demonstration mode; the existing fixture data stays
available without a running backend. Set `VITE_DATA_MODE=api` to start at the
login page and load live data after a successful sign-in. Alternatively,
select **Live API** from the dashboard; if there is no session, the app opens
sign-in. Change `VITE_API_BASE_URL` in `.env` when the backend runs elsewhere.
`VITE_API_TIMEOUT_MS` controls the API request timeout (10 seconds by
default). `VITE_REFRESH_INTERVAL_MS` controls automatic refresh and defaults
to 15000 (15 seconds); accepted values range from 10000 to 30000 milliseconds.
`VITE_STALE_AFTER_MS` controls measurement freshness and defaults to 900000
(15 minutes). Freshness compares the current time with the source
`observedAt` timestamp, not the last API fetch. A reading with an invalid
timestamp or no reading is marked unavailable. These thresholds are initial
frontend defaults for team review. Do not put credentials or ingestion tokens
in frontend environment variables.

Mock fixtures are isolated in `src/services/mockData.js` and contain examples
for both documented devices/zones. Every mock reading is presented as
demonstration data, including examples whose `source` field is `real`.
Measurement transformations and optional-field presentation are centralized
in `src/utils/measurementData.js`; unknown property names remain visible as
their raw identifiers rather than being assigned an invented label or unit.

The login form calls `POST /api/auth/login` with `{ email, password }` and
uses the returned `accessToken`, `tokenType`, `expiresIn`, and safe `user`
view. The access token is held in browser `sessionStorage` only for this tab
session, with an expiry timestamp derived from `expiresIn`; it is cleared on
logout, expiry, or a protected `401`. There is no refresh-token endpoint, so
the Client PWA asks the user to sign in again after expiry. The backend
validates account status, signature, role, and the current zone assignments on
protected requests. The browser does not define or grant zone access.

The API service supports these backend endpoints:

- `GET /api/health`
- `GET /api/devices` and `GET /api/devices/{deviceId}`
- `GET /api/measurements/latest?zoneId=...`
- `GET /api/measurements?deviceId=...&property=...&from=...&to=...&limit=...`

The dashboard checks public health before each API data refresh; this only
reports backend/Mongo availability. Device and measurement reads require the
Bearer token and are what validate the signed-in account; the backend may
return `403` when that account is not assigned to the requested zone. API
errors are displayed without falling back to demo values. Ensure
the backend `CORS_ALLOWED_ORIGINS` includes the exact Vite origin (normally
`http://localhost:5173`); the backend permits the Authorization header.
Vite variables are public browser configuration only. Never put service
tokens, JWT signing keys, bootstrap credentials, or other server secrets in
`.env` or frontend code.

To use demo mode, keep `VITE_DATA_MODE=mock`, or choose **Continue with demo
data** on sign-in. Demo mode uses only `src/services/mockData.js` and does not
depend on backend availability. Select **Live API** when an active backend
account is available. Logout clears the browser token; with `VITE_DATA_MODE=api`
the app returns to sign-in, while a default demo-configured app returns to
demo mode.

## Build and tests

```powershell
npm test
npm run build
npm run preview
```

`npm test` runs the service/utility tests with Node's test runner and React
component tests with Vitest and Testing Library.

## Install and offline testing

The production build includes a web app manifest, square PNG launcher icons,
an app-shell service worker, an offline notice, and an offline navigation
fallback. The worker precaches the built app shell and static assets, uses a
network-first strategy for page navigations, and never caches API requests or
measurement responses. Offline measurements are not persisted; the dashboard
reports browser connectivity separately from API connectivity and measurement
freshness. A new service worker waits for the user to select **Update app**.

1. Run `npm run build`, then `npm run preview -- --host 0.0.0.0` and open the
   printed local URL in a supported browser. Service workers require HTTPS,
   except on localhost.
2. Keep the page open until the service worker has installed and activated.
   Chromium browsers should then offer **Install app** in the dashboard when
   their install prompt is available, or through the browser's install menu.
   On iOS/iPadOS Safari, use **Share → Add to Home Screen**.
3. Use browser developer tools' Application panel to confirm the manifest,
   icons, and active service worker. For offline testing, enable **Offline** in
   the Network panel and reload: the cached app shell should open and show
   **Browser offline**. It must not show any cached sensor response. A first
   visit cannot work offline until the shell has been installed from a
   successful online visit.
4. To check update handling, publish/build a new version while the app remains
   open. The app shows **Update app** after the new worker is ready; selecting
   it activates the worker and reloads the app.

## Project structure

- `src/pages/` — dashboard page
- `src/components/` — navigation, measurement, PWA controls, status, zone, and alert UI
- `src/services/api.js` — shared API base URL, timeout, validation, and HTTP helpers
- `src/services/dataSource.js` — mock/API mode selection and zone data access
- `src/services/refreshScheduler.js` — immediate, non-overlapping periodic refresh
- `src/services/mockData.js` — clearly labeled sample devices and measurements
- `src/utils/` — freshness helpers and focused tests
- `src/styles/` — responsive application styling
- `public/` — PWA manifest, SVG/PNG icons, service worker, and offline page
