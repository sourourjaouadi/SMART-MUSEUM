import { useEffect, useMemo, useState } from 'react';
import AlertsPlaceholder from '../components/AlertsPlaceholder.jsx';
import FreshnessIndicator from '../components/FreshnessIndicator.jsx';
import HistoricalMeasurements from '../components/HistoricalMeasurements.jsx';
import MeasurementCard from '../components/MeasurementCard.jsx';
import PwaControls from '../components/PwaControls.jsx';
import Sidebar from '../components/Sidebar.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import ZoneDetails from '../components/ZoneDetails.jsx';
import {
  DATA_MODES,
  DEFAULT_DATA_MODE,
  getAvailableZones,
  getZoneData,
} from '../services/dataSource.js';
import { createRefreshScheduler } from '../services/refreshScheduler.js';
import { getHealth } from '../services/api.js';
import { groupMeasurementsByProperty } from '../utils/measurementData.js';
import {
  formatObservedAt,
  getFreshnessState,
  getFreshnessSummary,
  getRefreshIntervalMs,
  getStaleAfterMs,
} from '../utils/measurements.js';

const INITIAL_DATA_MODE = DEFAULT_DATA_MODE;
const INITIAL_LIVE_STATE = {
  status: 'idle',
  devices: [],
  measurements: [],
  error: null,
  errorCode: null,
};
const STALE_AFTER_MS = getStaleAfterMs(import.meta.env.VITE_STALE_AFTER_MS);
const REFRESH_INTERVAL_MS = getRefreshIntervalMs(
  import.meta.env.VITE_REFRESH_INTERVAL_MS,
);

export default function ConservationDashboard({
  initialMode,
  session = null,
  onLoginRequested,
  onLogout,
} = {}) {
  const effectiveInitialMode = initialMode ?? (session ? DATA_MODES.API : INITIAL_DATA_MODE);
  const [selectedZoneId, setSelectedZoneId] = useState(
    effectiveInitialMode === DATA_MODES.API && session
      ? session?.user?.zoneIds?.[0] ?? ''
      : getAvailableZones()[0]?.id ?? '',
  );
  const [dataMode, setDataMode] = useState(effectiveInitialMode);
  const [liveState, setLiveState] = useState(INITIAL_LIVE_STATE);
  const [now, setNow] = useState(() => Date.now());
  const isDemo = dataMode === DATA_MODES.MOCK;

  useEffect(() => {
    if (initialMode !== undefined) {
      setDataMode(initialMode);
      setLiveState(INITIAL_LIVE_STATE);
      setSelectedZoneId(
        initialMode === DATA_MODES.API
          ? session?.user?.zoneIds?.[0] ?? ''
          : getAvailableZones()[0]?.id ?? '',
      );
    }
  }, [initialMode, session]);
  const zones = useMemo(
    () => getAvailableZones(isDemo ? undefined : liveState.devices),
    [isDemo, liveState.devices],
  );
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? {
    id: selectedZoneId,
    shortLabel: selectedZoneId || 'No zone selected',
    name: selectedZoneId || 'No zone selected',
    description: 'Zone information is unavailable.',
  };

  useEffect(() => {
    if (!zones.some((zone) => zone.id === selectedZoneId)) {
      setSelectedZoneId(zones[0]?.id ?? '');
    }
  }, [selectedZoneId, zones]);

  useEffect(() => {
    let active = true;
    let activeController;

    const refresh = async () => {
      activeController = new AbortController();
      setLiveState((previous) => ({
        ...previous,
        status: 'loading',
        error: null,
        errorCode: null,
        httpStatus: null,
      }));

      try {
        if (dataMode === DATA_MODES.API) {
          const health = await getHealth({ signal: activeController.signal });
          if (health?.status !== 'UP' || health?.mongo !== 'UP') {
            throw new Error('Backend health check failed. Check the API and database status.');
          }
        }
        const zoneToLoad = dataMode === DATA_MODES.API && !selectedZoneId && session
          ? session.user?.zoneIds?.[0] ?? ''
          : selectedZoneId;
        const { devices, measurements } = await getZoneData(zoneToLoad, {
          mode: dataMode,
          signal: activeController.signal,
        });
        if (active && zoneToLoad !== selectedZoneId) {
          setSelectedZoneId(zoneToLoad);
        }
        if (active) {
          setLiveState({
            status: 'success',
            devices,
            measurements,
            error: null,
            errorCode: null,
          });
        }
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setLiveState((previous) => ({
            ...previous,
            status: 'error',
            error: error.message,
            errorCode: error.backendErrorCode ?? null,
            httpStatus: error.status ?? null,
          }));
        }
      }
    };

    const scheduler = createRefreshScheduler(refresh, REFRESH_INTERVAL_MS);
    scheduler.start();

    return () => {
      active = false;
      scheduler.stop();
      activeController?.abort();
    };
  }, [dataMode, selectedZoneId, session]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timerId);
  }, []);

  const measurements = useMemo(
    () =>
      liveState.measurements.filter(
        (measurement) => measurement.zoneId === selectedZoneId,
      ),
    [liveState.measurements, selectedZoneId],
  );

  const zoneDevices = liveState.devices.filter(
    (device) => device?.zoneId === selectedZoneId,
  );

  const status =
    liveState.status === 'error' && liveState.httpStatus === 403
      ? 'forbidden'
      : liveState.status === 'loading' || liveState.status === 'error'
        ? liveState.status
      : !selectedZoneId || zoneDevices.length === 0
        ? 'unavailable'
        : measurements.length === 0
          ? 'empty'
          : liveState.status === 'success' || isDemo
            ? 'success'
            : 'unavailable';
  const measurementGroups = groupMeasurementsByProperty(measurements);
  const freshness = getFreshnessSummary(measurements, STALE_AFTER_MS, now);
  const connectionStatus = isDemo
    ? 'Demo preview'
    : liveState.status === 'loading'
      ? 'Connecting to API'
      : liveState.status === 'success'
        ? 'API connected'
        : liveState.status === 'error'
          ? 'API unavailable'
          : 'Waiting for API';

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="topbar__heading">
            <p className="topbar__context">Smart Museum <span aria-hidden="true">/</span> Client PWA</p>
            <p className="topbar__page-title">Conservation Dashboard</p>
          </div>
          <div className="topbar__status-group">
            <PwaControls />
            {session && (
              <button className="session-action" type="button" onClick={onLogout}>
                Sign out
              </button>
            )}
            <div
              className={`connection-status connection-status--${isDemo ? 'demo' : liveState.status}`}
              role="status"
            >
              <span className="connection-status__dot" aria-hidden="true" />
              {connectionStatus}
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="page-intro" aria-labelledby="page-title">
            <div className="page-intro__copy">
              <p className="eyebrow">Preventive conservation</p>
              <h1 id="page-title">Conservation Dashboard</h1>
              <p>
                Environmental context for museum collections, with readings
                organized by monitoring zone.
              </p>
            </div>
            <div className="page-intro__stamp" aria-label="Museum environmental monitoring">
              <span aria-hidden="true">SM</span>
              <small>ENVIRONMENT<br />&amp; HERITAGE</small>
            </div>
          </section>

          <section className="dashboard-controls" aria-label="Dashboard controls">
            <div className="zone-control">
              <label htmlFor="zone-selector">Monitoring zone</label>
              <select
                id="zone-selector"
                value={selectedZoneId}
                onChange={(event) => setSelectedZoneId(event.target.value)}
                disabled={zones.length === 0}
              >
                {zones.length === 0 && <option value="">No zones available</option>}
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.shortLabel} · {zone.id}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="data-mode-control">
              <legend>Data source</legend>
              <label className={isDemo ? 'data-mode-control__option is-selected' : 'data-mode-control__option'}>
                <input
                  type="radio"
                  name="data-mode"
                  value={DATA_MODES.MOCK}
                  checked={isDemo}
                  onChange={() => {
                    setLiveState(INITIAL_LIVE_STATE);
                    setSelectedZoneId(getAvailableZones()[0]?.id ?? '');
                    setDataMode(DATA_MODES.MOCK);
                  }}
                />
                <span>Demo preview</span>
              </label>
              <label className={!isDemo ? 'data-mode-control__option is-selected' : 'data-mode-control__option'}>
                <input
                  type="radio"
                  name="data-mode"
                  value={DATA_MODES.API}
                  checked={!isDemo}
                  onChange={() => {
                    if (!session && onLoginRequested) {
                      onLoginRequested();
                      return;
                    }
                    setLiveState(INITIAL_LIVE_STATE);
                    setSelectedZoneId('');
                    setDataMode(DATA_MODES.API);
                  }}
                />
                <span>Live API</span>
              </label>
            </fieldset>
          </section>

          <StatusMessage
            status={status}
            error={liveState.error}
            errorCode={liveState.errorCode}
            isDemo={isDemo}
          />

          <section className="measurements-section" aria-labelledby="measurements-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{selectedZone.shortLabel} · {selectedZone.id}</p>
                <h2 id="measurements-title">Environmental readings</h2>
              </div>
              <span className="section-heading__description">
                {isDemo ? 'Illustrative mock records' : 'Read-only API data'}
              </span>
            </div>
            <div className="measurement-grid">
              {measurementGroups.length > 0 ? (
                measurementGroups.map((group) => (
                  <section
                    className="measurement-property-group"
                    aria-label={`${group.definition.label} measurements`}
                    key={group.property}
                  >
                    {group.measurements.map((measurement) => (
                      <MeasurementCard
                        key={measurement.measurementId}
                        definition={group.definition}
                        measurement={measurement}
                        isDemo={isDemo}
                        freshness={getFreshnessState(
                          [measurement],
                          STALE_AFTER_MS,
                          now,
                        )}
                      />
                    ))}
                  </section>
                ))
              ) : (
                <p className="measurements-empty">
                  {status === 'loading'
                    ? 'Waiting for measurements from this zone.'
                    : status === 'error'
                      ? 'Measurements are unavailable because the API request failed.'
                      : 'No environmental readings are available for this zone.'}
                </p>
              )}
            </div>
          </section>

          <FreshnessIndicator
            freshness={freshness}
            observedAt={formatObservedAt(
              measurements.reduce((latest, measurement) => {
                if (
                  !latest ||
                  Date.parse(measurement.observedAt) > Date.parse(latest)
                ) {
                  return measurement.observedAt;
                }
                return latest;
              }, null),
            )}
            isDemo={isDemo}
            refreshIntervalMs={REFRESH_INTERVAL_MS}
          />

          <section className="zone-overview" aria-label="Zone overview">
            <div className="zone-overview__intro">
              <p className="eyebrow">Selected environment</p>
              <h2>{selectedZone.name}</h2>
              <p>{selectedZone.description}</p>
            </div>
            <ZoneDetails zone={selectedZone} devices={zoneDevices} />
          </section>

          <AlertsPlaceholder />

          <HistoricalMeasurements
            zones={zones}
            devices={liveState.devices}
            mode={dataMode}
          />

          <footer className="site-footer">
            <a href="#overview">Smart Museum</a>
            <span>Client dashboard · environmental monitoring</span>
            <span className="site-footer__status">
              {isDemo ? 'Demo mode' : 'Live API mode'}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
