import {
  getDevices as getApiDevices,
  getLatestMeasurements as getApiLatestMeasurements,
  getMeasurements as getApiMeasurements,
  getZones as getApiZones,
} from './api.js';
import { MOCK_DATA as DEMO_DATA } from './mockData.js';

// Demo records exist only in mock builds: Vite inlines VITE_DATA_MODE, so api builds
// keep the empty set and drop the sample data from the bundle.
const MOCK_DATA = import.meta.env?.VITE_DATA_MODE === 'api'
  ? { devices: [], measurements: [], zones: [] }
  : DEMO_DATA;

export const DATA_MODES = Object.freeze({
  MOCK: 'mock',
  API: 'api',
});

export const DEFAULT_DATA_MODE =
  (import.meta.env?.VITE_DATA_MODE ?? 'mock') === DATA_MODES.API
    ? DATA_MODES.API
    : DATA_MODES.MOCK;

export function getAvailableZones(devices = MOCK_DATA.devices) {
  const zones = new Map();
  for (const device of devices) {
    const zoneId = device?.zoneId;
    if (typeof zoneId !== 'string' || zoneId.trim() === '') {
      continue;
    }

    if (!zones.has(zoneId)) {
      const shortLabel = /^salle-\d+$/.test(zoneId)
        ? `Salle ${zoneId.slice(-2)}`
        : zoneId;
      zones.set(zoneId, {
        id: zoneId,
        shortLabel,
        name: shortLabel,
        description: 'Museum monitoring zone',
        deviceId: device.deviceId,
      });
    }
  }
  return [...zones.values()];
}

export function getAvailableDevices(mode, apiDevices = []) {
  if (mode === DATA_MODES.MOCK) {
    return MOCK_DATA.devices;
  }
  if (mode === DATA_MODES.API) {
    return apiDevices;
  }
  throw new TypeError(`Unsupported data mode: ${mode}`);
}

/**
 * Zone metadata (name, WGS84 location) is optional: if /api/zones is unavailable
 * the dashboard still shows devices and measurements, with `zone: null`.
 */
async function getApiZone(zoneId, signal) {
  try {
    const zones = await getApiZones({ signal });
    return zones.find((zone) => zone.zoneId === zoneId) ?? null;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return null;
  }
}

export async function getZoneData(zoneId, { mode = DEFAULT_DATA_MODE, signal } = {}) {
  if (mode === DATA_MODES.MOCK) {
    return {
      devices: MOCK_DATA.devices.filter((device) => device.zoneId === zoneId),
      measurements: MOCK_DATA.measurements.filter(
        (measurement) => measurement.zoneId === zoneId,
      ),
      zone: MOCK_DATA.zones.find((zone) => zone.zoneId === zoneId) ?? null,
    };
  }

  if (mode !== DATA_MODES.API) {
    throw new TypeError(`Unsupported data mode: ${mode}`);
  }

  const [devices, zone] = await Promise.all([
    getApiDevices({ signal }),
    getApiZone(zoneId, signal),
  ]);
  if (!devices.some((device) => device?.zoneId === zoneId)) {
    return { devices, measurements: [], zone };
  }

  const measurements = await getApiLatestMeasurements(zoneId, { signal });
  return { devices, measurements, zone };
}

export async function getMeasurementHistory(
  { deviceId, property, from, to, limit },
  { mode = DEFAULT_DATA_MODE, signal } = {},
) {
  if (!deviceId || !property) {
    throw new TypeError('deviceId and property are required for measurement history.');
  }

  if (mode === DATA_MODES.API) {
    return getApiMeasurements({ deviceId, property, from, to, limit, signal });
  }

  if (mode !== DATA_MODES.MOCK) {
    throw new TypeError(`Unsupported data mode: ${mode}`);
  }

  const parsedLimit = limit === undefined || limit === '' ? 1000 : Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 5000) {
    throw new RangeError('History limit must be an integer between 1 and 5000.');
  }

  const fromTime = from ? Date.parse(from) : Number.NEGATIVE_INFINITY;
  const toTime = to ? Date.parse(to) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(fromTime) && from) {
    throw new TypeError('The history start date is invalid.');
  }
  if (!Number.isFinite(toTime) && to) {
    throw new TypeError('The history end date is invalid.');
  }
  if (fromTime > toTime) {
    throw new RangeError('The history start date must not be after its end date.');
  }

  return MOCK_DATA.measurements
    .filter((measurement) => {
      const observedAt = Date.parse(measurement.observedAt);
      return (
        measurement.deviceId === deviceId &&
        measurement.property === property &&
        observedAt >= fromTime &&
        observedAt <= toTime
      );
    })
    .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt))
    .slice(0, parsedLimit);
}
