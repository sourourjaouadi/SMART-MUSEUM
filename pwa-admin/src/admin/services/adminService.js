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
