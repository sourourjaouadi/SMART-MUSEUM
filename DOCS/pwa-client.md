# Person 3 — Client PWA and frontend documentation

## 1. Purpose and scope

The Smart Museum client PWA is the read-only front-office dashboard for
environmental context around museum collections. It is intended for museum
staff, curators, and conservation personnel using a desktop, tablet, or
smartphone.

The current frontend supports selecting a monitoring zone, reviewing available
temperature, humidity, pressure, and illuminance measurements, inspecting
device metadata, distinguishing real from simulated sources, checking
measurement freshness, and querying historical readings. The interface also
explains loading, empty, API-error, and browser-offline states.

The backend implementation has not been supplied to the frontend project.
Accordingly, **Demo preview** is the default, mock measurements are explicitly
labelled as demonstration data, and real API/CORS behavior is unverified.

### Implemented and intentionally out of scope

- Implemented: dashboard, zone/device selection, latest and historical
  measurement views, freshness calculation, browser connectivity display,
  installable web-app foundation, and a static app-shell offline experience.
- Placeholder only: the alerts panel. The current PWA does not call an alert
  endpoint or claim that alerts are available.
- Not implemented: back-office/admin functions, authentication/roles,
  AI/RAG, predictions, analytics, backend logic, sensor ingestion, or
  gateway/Node-RED integration.

## 2. Frontend architecture and technologies

The application is a standalone **React 19 + Vite 7** project in
[`pwa-client/`](../pwa-client/). It uses JavaScript modules, semantic HTML,
responsive CSS, the browser Fetch API, and Node's built-in test runner. It has
no routing or chart-library dependency; the history view uses an SVG chart and
an accessible data table.

| Area | Responsibility |
|---|---|
| `src/pages/ConservationDashboard.jsx` | Dashboard composition, selected zone/data mode, latest-data refresh lifecycle, connection status, and freshness summary |
| `src/components/` | Reusable navigation, measurement, history, device/zone, status, alerts-placeholder, and PWA controls |
| `src/services/mockData.js` | Clearly labelled fixtures for the two documented example devices |
| `src/services/dataSource.js` | Selects mock or API data and filters existing mock history |
| `src/services/api.js` | Central read-only HTTP client, base URL, query encoding, timeout, response validation, and error reporting |
| `src/services/refreshScheduler.js` | Immediate and periodic refresh without overlapping requests |
| `src/utils/measurementData.js` | Measurement grouping and display metadata |
| `src/utils/measurements.js` | Timestamp formatting and freshness/refresh configuration |
| `src/styles/main.css` | Responsive visual design and narrow-screen layout |
| `public/` | Manifest, icons, app-shell service worker, and standalone offline fallback |

The UI consumes the data-source boundary rather than issuing HTTP requests in
components. API fields and source timestamps are preserved; absent optional
fields are omitted safely. Unknown property identifiers are shown without
inventing a name or unit.

## 3. Functional description

### Zone and device

The dashboard offers `salle-01` and `salle-02`. For a selected zone, it shows
available device identifiers, zone, gateway identifier, and source when
provided. The documented examples are:

| Device | Zone | Gateway | Source |
|---|---|---|---|
| `bme280-01` | `salle-01` | `gw-01` | `real` |
| `sim-bme280-02` | `salle-02` | `gw-sim` | `simulated` |

These are the identifiers provided by the project specification; the mock
values below are not physical sensor observations. A device online/status
field is not currently presented as an implemented feature.

The current demonstration fixture associates illuminance with the documented
`bme280-01` device. The architecture reference identifies a BH1750 as the
light sensor, but does not confirm the device-to-sensor association. This
attribution is pending confirmation from Person 1/2 and is not changed here.

### Environmental readings and provenance

The dashboard groups the selected zone's returned measurements by property
and displays only properties that have data. Cards show the property/value/
unit, `observedAt` timestamp, device identifier, source, and quality when
available. Supported properties are `temperature`, `humidity`, `pressure`,
and `illuminance`. The source badge distinguishes `real` from `simulated`;
in mock mode, a separate demonstration label makes clear that neither source
label implies a live sensor reading.

### Freshness and connectivity

Freshness is computed from each measurement's `observedAt`, not from the
browser's fetch time:

- **Up to date**: all displayed measurements have valid timestamps no more
  than 15 minutes old.
- **Stale**: at least one valid timestamp exceeds the configured threshold.
- **Unavailable**: there is no measurement, or a timestamp is missing,
  invalid, or in the future.

The initial threshold is `VITE_STALE_AFTER_MS=900000` (15 minutes). Latest
data refresh defaults to `VITE_REFRESH_INTERVAL_MS=15000` (15 seconds); the
accepted range is 10–30 seconds. Refreshing does not itself make an old
measurement fresh.

The **Browser online/offline** indicator reports browser connectivity. The
separate API indicator reports the data-source/API request state; freshness
is a third, independent concept. In API mode, a failed request is surfaced as
an error rather than being presented as a successful current reading.

### Historical measurements

The history section filters by zone, device, supported property, optional
start/end time, and limit. Results appear in a responsive SVG chart and a
table with exact observed times and values. The client sends only the
documented history query parameters. The API contract documents ascending
`observedAt` order, a default limit of 1000, and a maximum of 5000.

Mock mode filters the existing demonstration fixtures; it does **not**
generate a time series or claim that its records are real history. Empty,
loading, invalid-filter, API-error, and browser-offline states are shown
explicitly.

## 4. API integration contract

The current documented development base URL is
[`http://localhost:8080`](http://localhost:8080/). The PWA reads the
configurable base URL from `VITE_API_BASE_URL`; no endpoint URL is duplicated
in UI components.

| Method and path | Client purpose |
|---|---|
| `GET /api/health` | Health-check helper exposed by the API service |
| `GET /api/devices` | Retrieve device information |
| `GET /api/measurements/latest?zoneId=...` | Retrieve the latest measurement array for a zone |
| `GET /api/measurements?deviceId=...&property=...&from=...&to=...&limit=...` | Retrieve filtered history |

The latest endpoint is treated as an **array**, with latest records per
device/property pair; the client does not assume one measurement per response.
The history request uses only the listed optional query parameters and URL
encodes their values.

The documented measurement shape is:

| Field | Meaning / handling |
|---|---|
| `measurementId` | Measurement identifier |
| `deviceId` | Source device identifier |
| `zoneId` | Museum zone identifier |
| `property` | `temperature`, `humidity`, `pressure`, or `illuminance` |
| `value` | Numeric measured value |
| `unit` | Unit supplied with the measurement |
| `observedAt` | Source observation time in ISO 8601 UTC; used for freshness |
| `source` | `real` or `simulated` |
| `gatewayId` | Optional gateway identifier |
| `receivedAt` | Optional backend receipt time |
| `quality` | Optional `good`, `uncertain`, or `bad` quality value |

The API client validates response shape, reports HTTP/network/timeout/invalid
JSON errors, and sends no authorization header, service token, or ingestion
secret. No read-endpoint authentication is assumed in this frontend
configuration.

### Mock mode and real API mode

- `VITE_DATA_MODE=mock` is the default. The fixtures live in
  `src/services/mockData.js` and are always labelled demonstration data.
- Set `VITE_DATA_MODE=api` to start in API mode; the dashboard's data-source
  control can also switch modes during a session.
- Set `VITE_API_BASE_URL` when the backend origin differs from the documented
  local default. `VITE_API_TIMEOUT_MS` controls the request timeout.
- Environment variables are public build-time configuration. Do not put
  credentials, `X-Service-Token`, or ingestion secrets in the PWA.

The backend source is not present. Actual endpoint compatibility, response
details, browser CORS, and a successful live connection therefore remain
unverified; API-client unit tests use mocked Fetch responses only.

## 5. UML and data-flow diagrams

Editable Mermaid source:

- [Client PWA use cases](diagrams/pwa-use-cases.mmd)
- [Measurement retrieval and separate ingestion sequence](diagrams/pwa-measurement-sequence.mmd)
- [PWA measurement retrieval communication diagram](diagrams/pwa-communication.mmd)

The use cases are limited to implemented client-facing interactions and
documented API retrieval. The sequence source separates the read-only PWA flow
from the sensor/gateway/Node-RED ingestion path. The ingestion path is shown
only as system context and is **not a Person 3 implementation responsibility**.

The project specification lists use-case, communication, and sequence
diagrams among conceptual deliverables. The communication diagram numbers
the documented PWA/API/MongoDB retrieval messages; it does not add backend
operations beyond the documented reads. See
[`Smart_Museum_Architecture_Technique_Contraintes.pdf`](Smart_Museum_Architecture_Technique_Contraintes.pdf)
for the project-level architecture baseline and deployment diagram.

## 6. User guide

### Start locally

From the repository root:

```powershell
cd pwa-client
npm install
Copy-Item .env.example .env
npm run dev
```

Open the local address printed by Vite. Keep `VITE_DATA_MODE=mock` to work
without the backend. `npm run dev` is intended for development; the production
preview is needed to exercise the production service worker:

```powershell
npm run build
npm run preview
```

### Read the dashboard

1. Select `salle-01` or `salle-02` from **Monitoring zone**.
2. Read only the measurement cards that have values. Each card includes its
   measurement time and available device/source/quality metadata.
3. Check both the source label and the data-mode label. A fixture with
   `source: real` remains demonstration data when **Demo preview** is selected.
4. Read **Data freshness** independently of **Browser online/offline** and
   API connectivity. Invalid/missing times do not imply freshness.
5. In **Historical measurements**, choose zone, device, property, optional
   time range, and limit, then select **Load history**. Mock results are a
   filtered subset of the existing fixtures, not a generated time series.

### Install and use offline

The app manifest uses standalone display mode, relative app start/scope, and
192px/512px PNG icons (including a maskable icon). Installation requires a
secure context (HTTPS, or localhost) and browser support:

- Chromium desktop/Android: use the dashboard's **Install app** button when
  the browser exposes its install prompt, or use the browser's install menu.
- iOS/iPadOS Safari: use **Share → Add to Home Screen**.

The production service worker precaches the application shell and static
assets, handles navigation while offline, and offers **Update app** when a
new worker is ready. API responses and measurement data are never cached.
After losing connectivity, the dashboard displays a separate browser-offline
notice. An already-loaded API response can remain in page memory until reload,
but it is not saved or refreshed offline; its freshness continues to depend
on `observedAt`. The standalone offline page is a navigation fallback if the
cached app shell is unavailable.

### Error and unavailable states

- **Loading**: a request is in progress.
- **Empty**: no measurements match the selected zone/filters.
- **API error**: the request failed; check backend availability, URL, and
  browser CORS configuration. Do not treat this as an empty successful result.
- **Offline**: browser connectivity is absent; history/API requests need a
  connection. No sensor response is served from a cache.
- **Unavailable freshness**: no valid observation timestamp is available.
- **Alerts**: the panel is a placeholder until an alert API and UI behavior
  are agreed and implemented.

## 7. Testing and verification

Run the automated checks from `pwa-client/`. `npm test` executes the existing
Node test suite and the React DOM component tests through Vitest and Testing
Library:

```powershell
npm test
npm run build
```

The Node test suite covers:

| Test area | Coverage |
|---|---|
| Mock data and data source | Documented devices/zones, zone filtering, empty data, mock history filtering/ranges/limits |
| Measurement presentation | Property grouping, optional metadata, unknown properties, chart point transformation |
| Freshness and refresh | Recent/stale/missing/invalid/future timestamps, threshold configuration, 15-second scheduler, interval bounds, overlap prevention, refresh errors |
| API client | Mocked Fetch calls for health/devices/latest/history, query encoding, measurement shape validation, no auth/token header, HTTP/network/timeout/invalid JSON failures |
| PWA assets | Manifest identity/settings/icon dimensions and the offline fallback page |
| React components | History labels remain tied to submitted measurements when filters are edited; dashboard zone selection updates measurements/device details; data-source controls toggle |

These are unit/component tests, not an end-to-end live-backend suite. No
backend integration test can pass until the backend is available.

Manual browser checks:

1. Run `npm run build` and `npm run preview`.
2. Confirm the manifest and active worker in browser developer tools.
3. Enable the browser's offline network mode, reload after the first online
   visit, and confirm the app shell loads with **Browser offline** visible.
   Verify that no API/measurement response is stored in Cache Storage.
4. Build a newer version while the app is open. Confirm **Update app** appears,
   select it, and verify that the page reloads under the new worker.
5. Check responsive layout at 360px, tablet, and desktop viewport widths.
6. Exercise native installation on a supported browser/device. A browser
   installation prompt is browser-controlled and may not be exposed in every
   development environment.

The frontend has been manually checked in a production browser preview at
360px, with the service worker active, offline state visible, app-shell cache
only, and worker update activation. Native installation was not verified on a
physical device. The backend/CORS path remains unverified.
