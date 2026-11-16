import { ADMIN_MOCK_DATA } from '../data/mockData.js';
import { createAdminApiClient } from './adminApi.js';
import {
  getAdminSnapshot,
  setDeviceDecision,
  setDeviceLocation,
  setZoneLocation,
  validateLocation,
} from './adminService.js';

// One interface, two implementations: 'mock' (local demo data) and 'api' (middleware).
// Every action returns only the snapshot slices it changed, e.g. { devices } or { zones, devices }.
export const DATA_MODES = Object.freeze({ MOCK: 'mock', API: 'api' });

/** Build-time mode: VITE_DATA_MODE=api for the WildFly build, mock otherwise (dev server, tests). */
export const BUILD_DATA_MODE = import.meta.env?.VITE_DATA_MODE === DATA_MODES.API
  ? DATA_MODES.API
  : DATA_MODES.MOCK;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZONE_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function validateZoneName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || trimmed.length > 100) throw new Error('Zone name is required (1 to 100 characters).');
  return trimmed;
}

/** Same rules as IAM provisioning; checked locally so most mistakes never reach the server. */
export function validateClientAccount({ name, email, password, zoneIds } = {}) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  const zones = Array.isArray(zoneIds) ? zoneIds : [];
  if (!trimmedName || trimmedName.length > 120) throw new Error('Name is required (1 to 120 characters).');
  if (!EMAIL.test(trimmedEmail) || trimmedEmail.length > 254) throw new Error('Enter a valid email address.');
  if (typeof password !== 'string' || password.length < 12 || new TextEncoder().encode(password).length > 72) {
    throw new Error('Password must have at least 12 characters (72 bytes maximum).');
  }
  if (new Set(zones).size !== zones.length || zones.some((zone) => !ZONE_ID.test(zone))) {
    throw new Error('Assigned zones must be distinct zone identifiers.');
  }
  return { name: trimmedName, email: trimmedEmail, password, zoneIds: zones };
}

/** API zones plus zone IDs used by devices that have no zone record yet (saving one creates it). */
export function mergeZones(zones, devices) {
  const known = new Set(zones.map((zone) => zone.zoneId));
  const missing = [...new Set(devices.map((device) => device.zoneId))]
    .filter((zoneId) => zoneId && !known.has(zoneId))
    .sort()
    .map((zoneId) => ({ zoneId, name: null, location: null, unregistered: true }));
  return [...zones, ...missing];
}

function upsertZone(zones, saved) {
  return zones.some((zone) => zone.zoneId === saved.zoneId)
    ? zones.map((zone) => (zone.zoneId === saved.zoneId ? saved : zone))
    : [...zones, saved];
}

export function createMockDataSource() {
  return {
    mode: DATA_MODES.MOCK,
    loadSnapshot: () => getAdminSnapshot(),
    async decide(snapshot, deviceId, decision) {
      return { devices: await setDeviceDecision(snapshot.devices, deviceId, decision) };
    },
    async saveZone(snapshot, zoneId, { name, location }) {
      const zoneName = validateZoneName(name);
      const zones = await setZoneLocation(snapshot.zones, zoneId, location);
      return { zones: zones.map((zone) => (zone.zoneId === zoneId ? { ...zone, name: zoneName } : zone)) };
    },
    async setDeviceLocation(snapshot, deviceId, location) {
      return { devices: await setDeviceLocation(snapshot.devices, deviceId, location) };
    },
    async provisionClient(fields) {
      const account = validateClientAccount(fields);
      return { userId: 'demo-only', name: account.name, email: account.email, role: 'CLIENT', status: 'active', zoneIds: account.zoneIds, simulated: true };
    },
  };
}

export function createApiDataSource(api = createAdminApiClient()) {
  return {
    mode: DATA_MODES.API,
    async loadSnapshot({ signal } = {}) {
      const [devices, zones] = await Promise.all([api.getDevices({ signal }), api.getZones({ signal })]);
      return {
        label: 'Live data from the Smart Museum middleware.',
        devices,
        zones: mergeZones(zones, devices),
        // Not connected yet: no thresholds or user-list endpoint exists. Values are illustrative.
        thresholds: ADMIN_MOCK_DATA.thresholds,
        users: [],
      };
    },
    async decide(snapshot, deviceId, decision) {
      if (decision === 'active') await api.approveDevice(deviceId);
      else if (decision === 'rejected') await api.rejectDevice(deviceId);
      else throw new Error('Decision must be active or rejected.');
      // Reload so the page shows what the server actually stored.
      return { devices: await api.getDevices() };
    },
    async saveZone(snapshot, zoneId, { name, location }) {
      const saved = await api.saveZone(zoneId, { name: validateZoneName(name), location: validateLocation(location) });
      // Devices inheriting this zone's coordinates change too.
      const devices = await api.getDevices();
      return { zones: mergeZones(upsertZone(snapshot.zones.filter((zone) => !zone.unregistered), saved), devices), devices };
    },
    async setDeviceLocation(snapshot, deviceId, location) {
      const updated = location == null
        ? await api.clearDeviceLocation(deviceId)
        : await api.assignDeviceLocation(deviceId, validateLocation(location));
      return { devices: snapshot.devices.map((device) => (device.deviceId === deviceId ? updated : device)) };
    },
    provisionClient: (fields) => api.provisionClient(validateClientAccount(fields)),
  };
}

export function createDataSource(mode) {
  return mode === DATA_MODES.API ? createApiDataSource() : createMockDataSource();
}
