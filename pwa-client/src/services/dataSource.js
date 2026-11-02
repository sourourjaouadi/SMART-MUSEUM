import {
  getDevices as getApiDevices,
  getLatestMeasurements as getApiLatestMeasurements,
  getMeasurements as getApiMeasurements,
} from './api.js';
import { MOCK_DATA } from './mockData.js';

export const DATA_MODES = Object.freeze({
  MOCK: 'mock',
  API: 'api',
});

export const DEFAULT_DATA_MODE =
  import.meta.env?.VITE_DATA_MODE === DATA_MODES.API
    ? DATA_MODES.API
    : DATA_MODES.MOCK;

export function getAvailableZones() {
  return MOCK_DATA.devices.map((device) => ({
    id: device.zoneId,
    shortLabel: `Salle ${device.zoneId.slice(-2)}`,
    name: `Salle ${device.zoneId.slice(-2)}`,
    description: 'Museum monitoring zone',
    deviceId: device.deviceId,
  }));
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

export async function getZoneData(zoneId, { mode = DEFAULT_DATA_MODE, signal } = {}) {
  if (mode === DATA_MODES.MOCK) {
    return {
      devices: MOCK_DATA.devices.filter((device) => device.zoneId === zoneId),
      measurements: MOCK_DATA.measurements.filter(
        (measurement) => measurement.zoneId === zoneId,
      ),
    };
  }

  if (mode !== DATA_MODES.API) {
    throw new TypeError(`Unsupported data mode: ${mode}`);
  }

  const [devices, measurements] = await Promise.all([
    getApiDevices({ signal }),
    getApiLatestMeasurements(zoneId, { signal }),
  ]);
  return { devices, measurements };
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
