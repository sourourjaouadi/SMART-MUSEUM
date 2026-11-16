import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_MOCK_DATA } from '../data/mockData.js';
import {
  getAdminSnapshot,
  setDeviceDecision,
  setDeviceLocation,
  setZoneLocation,
  validateLocation,
} from './adminService.js';

afterEach(() => vi.restoreAllMocks());

describe('adminService mock boundary', () => {
  it('returns a clone of mock data that cannot mutate the source fixture', async () => {
    const snapshot = await getAdminSnapshot();
    snapshot.devices[0].status = 'changed';
    expect(ADMIN_MOCK_DATA.devices[0].status).toBe('active');
  });

  it.each(['active', 'rejected'])('applies a %s decision to a pending device', async (decision) => {
    const original = structuredClone(ADMIN_MOCK_DATA.devices);
    const updated = await setDeviceDecision(original, 'bme280-pending-03', decision);
    expect(updated.find((device) => device.deviceId === 'bme280-pending-03').status).toBe(decision);
    expect(original.find((device) => device.deviceId === 'bme280-pending-03').status).toBe('pending');
  });

  it('rejects a second decision after the pending device has changed state', async () => {
    const updated = await setDeviceDecision(
      structuredClone(ADMIN_MOCK_DATA.devices),
      'bme280-pending-03',
      'active',
    );
    await expect(setDeviceDecision(updated, 'bme280-pending-03', 'rejected'))
      .rejects.toThrow(/no longer pending/);
  });

  it('rejects unknown IDs and invalid decision values', async () => {
    await expect(setDeviceDecision(ADMIN_MOCK_DATA.devices, 'missing-device', 'active'))
      .rejects.toThrow(/Unknown device/);
    await expect(setDeviceDecision(ADMIN_MOCK_DATA.devices, 'bme280-pending-03', 'approve'))
      .rejects.toThrow(/Decision must be active or rejected/);
  });
});

describe('adminService mock geolocation', () => {
  it('validates WGS84 ranges and an optional whole floor number', () => {
    expect(validateLocation({ latitude: '36.8065', longitude: '10.1815', floor: '' }))
      .toEqual({ latitude: 36.8065, longitude: 10.1815 });
    expect(validateLocation({ latitude: -90, longitude: 180, floor: '-10' }))
      .toEqual({ latitude: -90, longitude: 180, floor: -10 });
    expect(() => validateLocation({ latitude: 90.5, longitude: 10 })).toThrow(/Latitude/);
    expect(() => validateLocation({ latitude: '', longitude: 10 })).toThrow(/Latitude/);
    expect(() => validateLocation({ latitude: 36.8, longitude: -180.1 })).toThrow(/Longitude/);
    expect(() => validateLocation({ latitude: 36.8, longitude: 10, floor: '1.5' })).toThrow(/Floor/);
  });

  it('sets zone coordinates without mutating the input', async () => {
    const zones = structuredClone(ADMIN_MOCK_DATA.zones);
    const updated = await setZoneLocation(zones, 'salle-03', { latitude: '36.8067', longitude: '10.18', floor: '0' });
    expect(updated.find((zone) => zone.zoneId === 'salle-03').location)
      .toEqual({ latitude: 36.8067, longitude: 10.18, floor: 0 });
    expect(zones.find((zone) => zone.zoneId === 'salle-03').location).toBeUndefined();
    await expect(setZoneLocation(zones, 'salle-99', { latitude: 1, longitude: 1 })).rejects.toThrow(/Unknown zone/);
  });

  it('assigns and clears a device location but never changes its zone', async () => {
    const devices = structuredClone(ADMIN_MOCK_DATA.devices);
    const assigned = await setDeviceLocation(devices, 'bme280-01', { latitude: 36.80652, longitude: 10.18148 });
    const device = assigned.find((item) => item.deviceId === 'bme280-01');
    expect(device.location).toEqual({ latitude: 36.80652, longitude: 10.18148 });
    expect(device.zoneId).toBe('salle-01');

    const cleared = await setDeviceLocation(assigned, 'bme280-01', null);
    expect(cleared.find((item) => item.deviceId === 'bme280-01').location).toBeUndefined();
    expect(cleared.find((item) => item.deviceId === 'bme280-01').zoneId).toBe('salle-01');
  });

  it('refuses locations for devices that are not approved', async () => {
    await expect(setDeviceLocation(ADMIN_MOCK_DATA.devices, 'bme280-pending-03', { latitude: 36.8, longitude: 10.18 }))
      .rejects.toThrow(/must be approved/);
    await expect(setDeviceLocation(ADMIN_MOCK_DATA.devices, 'missing-device', null))
      .rejects.toThrow(/Unknown device/);
  });
});
