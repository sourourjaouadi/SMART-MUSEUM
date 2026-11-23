import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DATA_MODES,
  createApiDataSource,
  createMockDataSource,
  mergeZones,
  validateClientAccount,
} from './adminDataSource.js';

const zone = { zoneId: 'salle-01', name: 'Textile gallery', location: { latitude: 36.8065, longitude: 10.1815, floor: 0 } };

function fakeApi(devices) {
  const calls = [];
  let current = devices;
  return {
    calls,
    getDevices: async () => { calls.push('getDevices'); return current; },
    getZones: async () => { calls.push('getZones'); return [zone]; },
    approveDevice: async (id) => {
      calls.push(`approve:${id}`);
      current = current.map((d) => (d.deviceId === id ? { ...d, status: 'active' } : d));
    },
    rejectDevice: async (id) => { calls.push(`reject:${id}`); },
    saveZone: async (id, body) => { calls.push(`saveZone:${id}`); return { zoneId: id, ...body }; },
    assignDeviceLocation: async (id, location) => {
      calls.push(`assign:${id}`);
      return { ...current.find((d) => d.deviceId === id), location, locationSource: 'device' };
    },
    clearDeviceLocation: async (id) => { calls.push(`clear:${id}`); return current.find((d) => d.deviceId === id); },
    provisionClient: async (account) => { calls.push('provision'); return { userId: 'u-1', role: 'CLIENT', ...account }; },
  };
}

const devices = [
  { deviceId: 'bme280-01', zoneId: 'salle-01', status: 'active' },
  { deviceId: 'test-admin-02', zoneId: 'salle-09', status: 'pending' },
];

test('API snapshot lists zones and adds device zones without a record yet', async () => {
  const api = fakeApi(devices);
  const snapshot = await createApiDataSource(api).loadSnapshot();
  assert.deepEqual(snapshot.zones.map((z) => [z.zoneId, Boolean(z.unregistered)]), [['salle-01', false], ['salle-09', true]]);
  assert.deepEqual(snapshot.users, []);
  assert.deepEqual(snapshot.thresholds, []);
  assert.deepEqual(mergeZones([zone], []), [zone]);
});

test('API decisions are sent to the server and the list is reloaded', async () => {
  const api = fakeApi(devices);
  const source = createApiDataSource(api);
  const { devices: updated } = await source.decide({ devices }, 'test-admin-02', 'active');
  assert.deepEqual(api.calls, ['approve:test-admin-02', 'getDevices']);
  assert.equal(updated.find((d) => d.deviceId === 'test-admin-02').status, 'active');
  await assert.rejects(source.decide({ devices }, 'test-admin-02', 'maybe'), /Decision must be/);
});

test('API zone save validates locally, creates unregistered zones, and refreshes devices', async () => {
  const api = fakeApi(devices);
  const source = createApiDataSource(api);
  const snapshot = await source.loadSnapshot();
  api.calls.length = 0;
  const patch = await source.saveZone(snapshot, 'salle-09', { name: ' Archive ', location: { latitude: '36.807', longitude: '10.182', floor: '1' } });
  assert.deepEqual(api.calls, ['saveZone:salle-09', 'getDevices']);
  const saved = patch.zones.find((z) => z.zoneId === 'salle-09');
  assert.equal(saved.name, 'Archive');
  assert.equal(saved.unregistered, undefined);
  assert.deepEqual(saved.location, { latitude: 36.807, longitude: 10.182, floor: 1 });

  await assert.rejects(source.saveZone(snapshot, 'salle-01', { name: 'A', location: { latitude: 95, longitude: 1 } }), /Latitude/);
  await assert.rejects(source.saveZone(snapshot, 'salle-01', { name: ' ', location: { latitude: 1, longitude: 1 } }), /Zone name/);
  assert.equal(api.calls.length, 2);
});

test('API device location is assigned or cleared and replaced in the list', async () => {
  const api = fakeApi(devices);
  const source = createApiDataSource(api);
  const assigned = await source.setDeviceLocation({ devices }, 'bme280-01', { latitude: '36.80652', longitude: '10.18148' });
  assert.equal(assigned.devices[0].locationSource, 'device');
  assert.equal(assigned.devices[0].zoneId, 'salle-01');
  await source.setDeviceLocation({ devices }, 'bme280-01', null);
  assert.deepEqual(api.calls, ['assign:bme280-01', 'clear:bme280-01']);
});

test('CLIENT account fields follow the IAM rules before any request', async () => {
  const valid = { name: ' Curator ', email: 'curator@example.org', password: 'a'.repeat(12), zoneIds: ['salle-01'] };
  assert.equal(validateClientAccount(valid).name, 'Curator');
  assert.throws(() => validateClientAccount({ ...valid, email: 'not-an-email' }), /valid email/);
  assert.throws(() => validateClientAccount({ ...valid, password: 'short' }), /12 characters/);
  assert.throws(() => validateClientAccount({ ...valid, zoneIds: ['salle-01', 'salle-01'] }), /distinct/);

  const api = fakeApi(devices);
  await createApiDataSource(api).provisionClient(valid);
  assert.deepEqual(api.calls, ['provision']);
});

test('mock source keeps demo data local and marks created accounts as simulated', async () => {
  const source = createMockDataSource();
  assert.equal(source.mode, DATA_MODES.MOCK);
  const snapshot = await source.loadSnapshot();
  const patch = await source.saveZone(snapshot, 'salle-03', { name: 'Ceramics wing', location: { latitude: 36.8, longitude: 10.18 } });
  assert.deepEqual(patch.zones.find((z) => z.zoneId === 'salle-03').location, { latitude: 36.8, longitude: 10.18 });
  const account = await source.provisionClient({ name: 'Demo', email: 'demo@example.org', password: 'b'.repeat(12), zoneIds: [] });
  assert.equal(account.simulated, true);
});
