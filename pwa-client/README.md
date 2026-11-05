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

Open the local URL printed by Vite. `.env.example` uses the documented local
backend URL, `http://localhost:8080`, and selects `VITE_DATA_MODE=mock`.
Keep that value for standalone demonstration mode; set it to `api` to make
the initial page load request backend data. The dashboard's Data source
control also switches between mock and API mode while the app is running.
Change `VITE_API_BASE_URL` in `.env` if the backend runs elsewhere.
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

Use the **Live API** control to request data from the backend. The API service
supports these documented read-only endpoints:

- `GET /api/health`
- `GET /api/devices`
- `GET /api/measurements/latest?zoneId=...`
- `GET /api/measurements` with the optional `deviceId`, `property`, `from`,
  `to`, and `limit` query parameters

The backend is not included in this project yet. Live mode will display a
request error until the API is running and accessible from the browser.

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
