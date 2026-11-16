import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createAdminApiClient } from './adminApi.js';

const BASE = 'https://api.smartmuseum.test/api';
const device = { deviceId: 'test-admin-01', zoneId: 'salle-01', status: 'pending', type: 'bme280' };

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload === undefined ? '' : JSON.stringify(payload); },
  };
}

function client(handler, extra = {}) {
  const calls = [];
  const api = createAdminApiClient({
    baseUrl: BASE,
    timeoutMs: 50,
    getToken: () => 'admin-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers, body: init.body && JSON.parse(init.body) });
      return handler(url, init);
    },
    ...extra,
  });
  return { api, calls };
}

test('sends the bearer token and maps every admin operation to its endpoint', async () => {
  const zone = { zoneId: 'salle-01', name: 'Textile gallery', location: { latitude: 36.8065, longitude: 10.1815, floor: 0 } };
  const { api, calls } = client((url) => {
    if (url.endsWith('/zones')) return response(200, [zone]);
    if (url.endsWith('/zones/salle-01')) return response(200, zone);
    if (url.endsWith('/users')) return response(201, { userId: 'u-2', role: 'CLIENT', zoneIds: ['salle-01'] });
    if (url.endsWith('/devices')) return response(200, [device]);
    return response(200, { ...device, status: 'active' });
  });

  await api.getDevices();
  await api.approveDevice('test-admin-01');
  await api.rejectDevice('test-admin-01');
  await api.assignDeviceLocation('test-admin-01', { latitude: 36.8, longitude: 10.18 });
  await api.clearDeviceLocation('test-admin-01');
  await api.getZones();
  await api.saveZone('salle-01', { name: 'Textile gallery', location: zone.location });
  await api.provisionClient({ name: 'Curator', email: 'curator@example.org', password: 'x'.repeat(12), zoneIds: ['salle-01'] });

  assert.deepEqual(calls.map(({ method, url }) => `${method} ${url.slice(BASE.length)}`), [
    'GET /devices',
    'POST /devices/test-admin-01/approve',
    'POST /devices/test-admin-01/reject',
    'PUT /devices/test-admin-01/location',
    'DELETE /devices/test-admin-01/location',
    'GET /zones',
    'PUT /zones/salle-01',
    'POST /users',
  ]);
  assert.ok(calls.every((call) => call.headers.Authorization === 'Bearer admin-token'));
  assert.deepEqual(calls[6].body, { name: 'Textile gallery', location: zone.location });
});

test('login is sent without a bearer token', async () => {
  const { api, calls } = client(() => response(200, { accessToken: 't' }));
  await api.login('admin@example.org', 'secret-value');
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.deepEqual(calls[0].body, { email: 'admin@example.org', password: 'secret-value' });
});

test('a protected 401 clears the session and reports an ended session', async () => {
  let cleared = 0;
  const { api } = client(() => response(401, { error: 'UNAUTHORIZED', message: 'expired' }), {
    onUnauthorized: () => { cleared += 1; },
  });
  await assert.rejects(api.getDevices(), (error) => error.status === 401 && /session has ended/.test(error.message));
  assert.equal(cleared, 1);
});

test('maps 403, 404 and contextual 409 responses to admin messages', async () => {
  const status = (code, body) => client(() => response(code, body)).api;
  await assert.rejects(status(403, { error: 'FORBIDDEN', message: 'x' }).getZones(), /requires an administrator/);
  await assert.rejects(status(404, { error: 'NOT_FOUND', message: 'x' }).approveDevice('gone-01'), /no longer exists/);
  await assert.rejects(
    status(409, { error: 'INVALID_STATE', message: 'x' }).assignDeviceLocation('pending-01', { latitude: 1, longitude: 1 }),
    (error) => error.backendErrorCode === 'INVALID_STATE' && /Approve this device/.test(error.message),
  );
  await assert.rejects(status(409, { error: 'INVALID_STATE', message: 'x' }).approveDevice('no-td-01'), /no Thing Description/);
  await assert.rejects(
    status(400, { error: 'INVALID_SCHEMA', message: 'latitude doit etre comprise entre -90 et 90' }).saveZone('salle-01', { name: 'A', location: {} }),
    /server rejected the values: latitude/,
  );
});

test('reports network failures and timeouts distinctly', async () => {
  await assert.rejects(
    client(() => { throw new TypeError('Failed to fetch'); }).api.getDevices(),
    (error) => error instanceof ApiError && error.code === 'NETWORK_ERROR',
  );
  const hanging = client((url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  })).api;
  await assert.rejects(hanging.getDevices(), (error) => error.code === 'TIMEOUT');
});

test('rejects malformed payloads and invalid identifiers', async () => {
  await assert.rejects(client(() => response(200, [{ deviceId: 'x' }])).api.getDevices(), (e) => e.code === 'INVALID_RESPONSE');
  await assert.rejects(client(() => response(200, [{ zoneId: 'z', location: { latitude: 99, longitude: 1 } }])).api.getZones(), (e) => e.code === 'INVALID_RESPONSE');
  const { api, calls } = client(() => response(200, device));
  await assert.rejects(api.approveDevice('bad/id'), TypeError);
  assert.equal(calls.length, 0);
});
