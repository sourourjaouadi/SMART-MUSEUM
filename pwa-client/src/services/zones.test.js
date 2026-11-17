import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createApiClient } from './api.js';

function clientReturning(payload, requests = []) {
  return createApiClient({
    baseUrl: 'https://api.smartmuseum.test/api',
    fetchImpl: async (url, init) => {
      requests.push({ url, method: init.method });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async text() {
          return JSON.stringify(payload);
        },
      };
    },
  });
}

test('loads authorized zones with their WGS84 coordinates', async () => {
  const requests = [];
  const zones = [
    { zoneId: 'salle-01', name: 'Textile gallery', location: { latitude: 36.8065, longitude: 10.1815, floor: 0 } },
    { zoneId: 'salle-02', name: 'Manuscript room' },
  ];
  assert.deepEqual(await clientReturning(zones, requests).getZones(), zones);
  assert.deepEqual(requests, [{ url: 'https://api.smartmuseum.test/api/zones', method: 'GET' }]);
});

test('rejects zone responses with invalid coordinates', async () => {
  for (const location of [
    { latitude: 91, longitude: 10 },
    { latitude: 36.8, longitude: -181 },
    { latitude: '36.8', longitude: 10 },
    { latitude: 36.8, longitude: 10, floor: 1.5 },
  ]) {
    await assert.rejects(
      clientReturning([{ zoneId: 'salle-01', name: 'A', location }]).getZones(),
      (error) => error instanceof ApiError && error.code === 'INVALID_RESPONSE',
    );
  }
  await assert.rejects(
    clientReturning({ zoneId: 'salle-01' }).getZones(),
    (error) => error instanceof ApiError && error.code === 'INVALID_RESPONSE',
  );
});
