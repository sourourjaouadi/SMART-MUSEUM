import { ADMIN_MOCK_DATA } from '../data/mockData.js';

// Mock-only boundary. Replace these functions only after agreeing an API contract.
const pause = () => new Promise((resolve) => setTimeout(resolve, 180));

export async function getAdminSnapshot() {
  await pause();
  return structuredClone(ADMIN_MOCK_DATA);
}

export async function setDeviceDecision(devices, deviceId, decision) {
  if (!['active', 'rejected'].includes(decision)) {
    throw new Error('Decision must be active or rejected.');
  }

  const device = devices.find((item) => item.deviceId === deviceId);
  if (!device) throw new Error(`Unknown device: ${deviceId}`);
  if (device.status !== 'pending') {
    throw new Error(`Device ${deviceId} is no longer pending review.`);
  }

  await pause();
  return devices.map((item) => item.deviceId === deviceId
    ? { ...item, status: decision }
    : item);
}

// Same rules as the backend (PUT /api/zones/{zoneId}, PUT /api/devices/{deviceId}/location).
export function validateLocation(location) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  const floorValue = location?.floor;
  if (location?.latitude === '' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be a number between -90 and 90.');
  }
  if (location?.longitude === '' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be a number between -180 and 180.');
  }
  if (floorValue == null || floorValue === '') return { latitude, longitude };
  const floor = Number(floorValue);
  if (!Number.isInteger(floor) || floor < -10 || floor > 200) {
    throw new Error('Floor must be a whole number between -10 and 200.');
  }
  return { latitude, longitude, floor };
}

export async function setZoneLocation(zones, zoneId, location) {
  if (!zones.some((zone) => zone.zoneId === zoneId)) throw new Error(`Unknown zone: ${zoneId}`);
  const validated = validateLocation(location);
  await pause();
  return zones.map((zone) => zone.zoneId === zoneId ? { ...zone, location: validated } : zone);
}

/** location = null removes the device's own position so it inherits its zone's coordinates. */
export async function setDeviceLocation(devices, deviceId, location) {
  const device = devices.find((item) => item.deviceId === deviceId);
  if (!device) throw new Error(`Unknown device: ${deviceId}`);
  if (['pending', 'rejected'].includes(device.status)) {
    throw new Error(`Device ${deviceId} must be approved before a location is assigned.`);
  }
  const validated = location == null ? null : validateLocation(location);
  await pause();
  return devices.map((item) => {
    if (item.deviceId !== deviceId) return item;
    const { location: _previous, ...rest } = item;
    return validated ? { ...rest, location: validated } : rest;
  });
}
