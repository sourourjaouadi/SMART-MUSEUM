import { useEffect, useMemo, useState } from 'react';
import HistoryChart from './HistoryChart.jsx';
import { DATA_MODES, getAvailableDevices, getMeasurementHistory } from '../services/dataSource.js';
import { getMeasurementDefinition } from '../utils/measurementData.js';

const PROPERTIES = ['temperature', 'humidity', 'pressure', 'illuminance'];
const DEFAULT_LIMIT = '1000';

function toIsoDateTime(value, label) {
  if (!value) {
    return undefined;
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`The ${label} date is invalid.`);
  }
  return new Date(timestamp).toISOString();
}

function toLocalDateTimeInput(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function HistoricalMeasurements({
  zones,
  devices,
  mode,
}) {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '');
  const [deviceId, setDeviceId] = useState('');
  const [property, setProperty] = useState(PROPERTIES[0]);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [limitInput, setLimitInput] = useState(DEFAULT_LIMIT);
  const [query, setQuery] = useState(null);
  const [result, setResult] = useState({
    status: 'idle',
    measurements: [],
    error: null,
    mode: null,
  });
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );

  const availableDevices = useMemo(
    () => getAvailableDevices(mode, devices),
    [devices, mode],
  );
  const zoneDevices = useMemo(
    () => availableDevices.filter((device) => device.zoneId === zoneId),
    [availableDevices, zoneId],
  );
  const effectiveDeviceId =
    zoneDevices.find((device) => device.deviceId === deviceId)?.deviceId ??
    zoneDevices[0]?.deviceId ??
    '';

  useEffect(() => {
    if (zones.some((zone) => zone.id === zoneId)) {
      return;
    }

    setZoneId(zones[0]?.id ?? '');
    setDeviceId('');
    setQuery(null);
    setResult({ status: 'idle', measurements: [], error: null, mode: null });
  }, [zoneId, zones]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!query) {
      return undefined;
    }

    const controller = new AbortController();
    setResult((previous) => ({
      ...previous,
      status: 'loading',
      error: null,
    }));

    getMeasurementHistory(query, { mode, signal: controller.signal })
      .then((measurements) => {
        setResult({ status: 'success', measurements, error: null, mode });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult((previous) => ({
            ...previous,
            status: 'error',
            error: error.message,
            errorCode: error.backendErrorCode ?? null,
          }));
        }
      });

    return () => controller.abort();
  }, [mode, query]);

  const definition = getMeasurementDefinition(property);
  const displayedProperty =
    result.status === 'success' && result.mode === mode && query
      ? query.property
      : property;
  const measurementDefinition = getMeasurementDefinition(
    displayedProperty,
    result.measurements[0]?.unit,
  );

  function handleSubmit(event) {
    event.preventDefault();

    if (!effectiveDeviceId) {
      setResult({
        status: 'error',
        measurements: [],
        error: 'No device is available for the selected zone.',
        errorCode: null,
        mode,
      });
      return;
    }

    let from;
    let to;
    const limit = Number(limitInput);
    try {
      from = toIsoDateTime(fromInput, 'start');
      to = toIsoDateTime(toInput, 'end');
      if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
        throw new RangeError('Limit must be an integer from 1 to 5000.');
      }
      if (from && to && Date.parse(from) > Date.parse(to)) {
        throw new RangeError('Start date must not be after end date.');
      }
    } catch (error) {
      setResult({
        status: 'error',
        measurements: [],
        error: error.message,
        errorCode: null,
        mode,
      });
      return;
    }

    setResult({ status: 'idle', measurements: [], error: null, mode: null });
    setQuery({
      zoneId,
      deviceId: effectiveDeviceId,
      property,
      from,
      to,
      limit,
    });
  }

  const selectedZone = zones.find((zone) => zone.id === zoneId);

  return (
    <section
      className="panel history-panel"
      id="history"
      aria-labelledby="history-title"
    >
      <div className="panel__heading">
        <div>
          <p className="eyebrow">Environmental record</p>
          <h2 id="history-title">Historical measurements</h2>
        </div>
        <span className="history-panel__mode">
          {mode === DATA_MODES.MOCK ? 'Demonstration data' : 'Read-only API'}
        </span>
      </div>

      <form className="history-filters" onSubmit={handleSubmit}>
        <label>
          <span>Zone</span>
          <select
            value={zoneId}
            disabled={zones.length === 0}
            onChange={(event) => {
              setZoneId(event.target.value);
              setDeviceId('');
              setResult({ status: 'idle', measurements: [], error: null });
            }}
          >
            {zones.length === 0 && <option value="">No zones available</option>}
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>{zone.id}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Device</span>
          <select
            value={effectiveDeviceId}
            onChange={(event) => {
              setDeviceId(event.target.value);
              setResult({ status: 'idle', measurements: [], error: null });
            }}
            disabled={zoneDevices.length === 0}
          >
            {zoneDevices.length === 0 ? (
              <option value="">No devices available</option>
            ) : (
              zoneDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.deviceId}
                </option>
              ))
            )}
          </select>
        </label>
        <label>
          <span>Measurement</span>
          <select value={property} onChange={(event) => setProperty(event.target.value)}>
            {PROPERTIES.map((item) => (
              <option key={item} value={item}>
                {getMeasurementDefinition(item).label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input
            type="datetime-local"
            value={fromInput}
            onChange={(event) => setFromInput(event.target.value)}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="datetime-local"
            value={toInput}
            onChange={(event) => setToInput(event.target.value)}
          />
        </label>
        <label>
          <span>Limit (max 5000)</span>
          <input
            type="number"
            min="1"
            max="5000"
            step="1"
            value={limitInput}
            onChange={(event) => setLimitInput(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!effectiveDeviceId || result.status === 'loading'}>
          {result.status === 'loading' ? 'Loading…' : 'Load history'}
        </button>
      </form>

      <p className="history-panel__context">
        {result.status === 'success' && query
          ? `${query.zoneId} · ${query.deviceId} · ${getMeasurementDefinition(query.property).label}`
          : `${selectedZone?.id ?? 'No zone'} · ${effectiveDeviceId || 'No device selected'}`}
        {mode === DATA_MODES.MOCK
          ? ' · existing demonstration records only; no history is generated'
          : ' · sorted by observedAt; API limit defaults to 1000, maximum 5000'}
      </p>

      {isOffline && (
        <p className="history-state history-state--offline" role="status">
          Browser is offline. History requests require a connection.
        </p>
      )}
      {result.status === 'error' && (
        <p className="history-state history-state--error" role="alert">
          {isOffline ? 'History unavailable while offline.' : `History request failed: ${result.error}`}
          {result.errorCode && ` (backend code: ${result.errorCode})`}
        </p>
      )}
      {result.status === 'loading' && (
        <p className="history-state" role="status">Loading measurement history…</p>
      )}
      {result.status === 'success' && result.mode === mode && result.measurements.length === 0 && (
        <p className="history-state" role="status">
          No measurements match these filters.
        </p>
      )}

      {result.status === 'success' && result.mode === mode && result.measurements.length > 0 && (
        <>
          {mode === DATA_MODES.MOCK && (
            <p className="history-state history-state--demo" role="status">
              Demonstration records only; these are not historical sensor data.
            </p>
          )}
          <HistoryChart
            measurements={result.measurements}
            definition={measurementDefinition}
          />
          <div className="history-table-wrap">
            <table className="history-table">
              <caption>
                {measurementDefinition.label}
                {measurementDefinition.unit ? ` (${measurementDefinition.unit})` : ''} for{' '}
                {query?.deviceId ?? effectiveDeviceId}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Observed at</th>
                  <th scope="col">Value</th>
                  <th scope="col">Device</th>
                  <th scope="col">Zone</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {result.measurements.map((measurement, index) => (
                  <tr key={measurement.measurementId ?? `${measurement.observedAt}-${index}`}>
                    <td>{measurement.observedAt}</td>
                    <td>
                      {measurement.value}
                      {measurement.unit ? ` ${measurement.unit}` : ''}
                    </td>
                    <td>{measurement.deviceId}</td>
                    <td>{measurement.zoneId}</td>
                    <td>
                      {measurement.source}
                      {mode === DATA_MODES.MOCK ? ' · mock' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
