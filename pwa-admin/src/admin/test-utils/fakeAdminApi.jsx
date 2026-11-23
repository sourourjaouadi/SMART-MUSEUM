import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import AdminApp from '../AdminApp.jsx';
import { createApiDataSource } from '../services/adminDataSource.js';

// API-mode rendering with a fake middleware client (no network).
const session = { accessToken: 't', user: { name: 'Test Admin', role: 'ADMIN' } };

export function fakeApi(overrides = {}) {
  let devices = [
    { deviceId: 'bme280-01', type: 'bme280', zoneId: 'salle-01', gatewayId: 'gw-01', status: 'active', thingId: 'urn:museum:device:bme280-01', location: { latitude: 36.8065, longitude: 10.1815, floor: 0 }, locationSource: 'zone' },
    { deviceId: 'test-admin-pending-01', type: 'bme280', zoneId: 'salle-01', gatewayId: 'gw-test', status: 'pending' },
    { deviceId: 'test-admin-offline-01', type: 'bme280', zoneId: 'salle-02', gatewayId: 'gw-test', status: 'offline' },
  ];
  let zones = [
    { zoneId: 'salle-01', name: 'Textile gallery', location: { latitude: 36.8065, longitude: 10.1815, floor: 0 } },
    { zoneId: 'salle-02', name: 'Manuscript room', location: { latitude: 36.80662, longitude: 10.18172, floor: 1 } },
  ];
  const setStatus = (id, status) => { devices = devices.map((d) => (d.deviceId === id ? { ...d, status } : d)); };
  return {
    getDevices: vi.fn(async () => devices),
    getZones: vi.fn(async () => zones),
    getThingDescription: vi.fn(async (id) => ({
      '@context': 'https://www.w3.org/2022/wot/td/v1.1',
      id: `urn:museum:device:${id}`,
      title: `BME280 ${id}`,
      security: 'nosec_sc',
      securityDefinitions: { nosec_sc: { scheme: 'nosec' } },
      properties: { temperature: { type: 'number', unit: 'Cel' }, humidity: { type: 'number', unit: '%' } },
      events: { alarm: {} },
    })),
    approveDevice: vi.fn(async (id) => setStatus(id, 'active')),
    rejectDevice: vi.fn(async (id) => setStatus(id, 'rejected')),
    saveZone: vi.fn(async (id, body) => {
      const saved = { zoneId: id, ...body };
      zones = zones.some((z) => z.zoneId === id) ? zones.map((z) => (z.zoneId === id ? saved : z)) : [...zones, saved];
      devices = devices.map((d) => (d.zoneId === id && d.locationSource !== 'device' ? { ...d, location: body.location, locationSource: 'zone' } : d));
      return saved;
    }),
    assignDeviceLocation: vi.fn(async (id, location) => {
      devices = devices.map((d) => (d.deviceId === id ? { ...d, location, locationSource: 'device' } : d));
      return devices.find((d) => d.deviceId === id);
    }),
    clearDeviceLocation: vi.fn(async (id) => {
      const zone = zones.find((z) => z.zoneId === devices.find((d) => d.deviceId === id).zoneId);
      devices = devices.map((d) => (d.deviceId === id ? { ...d, location: zone?.location, locationSource: zone?.location ? 'zone' : undefined } : d));
      return devices.find((d) => d.deviceId === id);
    }),
    provisionClient: vi.fn(async (account) => ({ userId: 'u-9', role: 'CLIENT', status: 'active', ...account })),
    ...overrides,
  };
}

export function renderApi(api = fakeApi()) {
  render(<AdminApp dataSource={createApiDataSource(api)} session={session} onLogout={vi.fn()} />);
  return api;
}

export async function openPage(label) {
  fireEvent.click(screen.getByRole('link', { name: new RegExp(label) }));
  await waitFor(() => expect(screen.getByRole('link', { name: new RegExp(label) }).getAttribute('aria-current')).toBe('page'));
}
