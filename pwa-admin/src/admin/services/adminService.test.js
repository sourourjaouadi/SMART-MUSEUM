import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_MOCK_DATA } from '../data/mockData.js';
import { getAdminSnapshot, setDeviceDecision } from './adminService.js';

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
