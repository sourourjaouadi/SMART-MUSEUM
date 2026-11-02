import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createApiClient } from './api.js';

function jsonResponse(payload, { status = 200, statusText = 'OK' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    async text() {
      return JSON.stringify(payload);
    },
  };
}

const validMeasurement = {
  measurementId: 'example-uuid',
  deviceId: 'bme280-01',
  zoneId: 'salle-01',
  gatewayId: 'gw-01',
  property: 'temperature',
  value: 21.4,
  unit: '°C',
  observedAt: '2026-11-01T08:49:05Z',
  source: 'real',
};

test('encodes the latest zone parameter and preserves the API measurement', async () => {
  let requestUrl;
  const client = createApiClient({
    baseUrl: 'http://localhost:8080/',
    fetchImpl: async (url) => {
      requestUrl = url;
      return jsonResponse([{ ...validMeasurement, receivedAt: '2026-11-01T08:49:06Z' }]);
    },
  });

  const result = await client.getLatestMeasurements('salle 01&archive');

  assert.equal(
    requestUrl,
    'http://localhost:8080/api/measurements/latest?zoneId=salle+01%26archive',
  );
  assert.deepEqual(result[0], {
    ...validMeasurement,
    receivedAt: '2026-11-01T08:49:06Z',
  });
});

test('encodes history parameters and omits empty optional filters', async () => {
  let requestUrl;
  const client = createApiClient({
    fetchImpl: async (url) => {
      requestUrl = url;
      return jsonResponse([]);
    },
  });

  await client.getMeasurements({
    deviceId: 'device & one',
    property: 'temperature',
    from: '2026-11-01T00:00:00Z',
    to: '',
    limit: 50,
  });

  const parsedUrl = new URL(requestUrl);
  assert.equal(parsedUrl.pathname, '/api/measurements');
  assert.equal(parsedUrl.searchParams.get('deviceId'), 'device & one');
  assert.equal(parsedUrl.searchParams.get('property'), 'temperature');
  assert.equal(parsedUrl.searchParams.get('from'), '2026-11-01T00:00:00Z');
  assert.equal(parsedUrl.searchParams.get('limit'), '50');
  assert.equal(parsedUrl.searchParams.has('to'), false);
});

test('retrieves health and device arrays without adding authentication headers', async () => {
  const requests = [];
  const client = createApiClient({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse(url.endsWith('/api/health') ? { status: 'ok' } : []);
    },
  });

  assert.deepEqual(await client.getHealth(), { status: 'ok' });
  assert.deepEqual(await client.getDevices(), []);
  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), [
    '/api/health',
    '/api/devices',
  ]);
  assert.deepEqual(requests[0].options.headers, { Accept: 'application/json' });
  assert.equal(
    Object.keys(requests[0].options.headers).some((name) =>
      name.toLowerCase().includes('token'),
    ),
    false,
  );
});

test('reports HTTP, network, invalid JSON and invalid measurement errors', async () => {
  const httpClient = createApiClient({
    fetchImpl: async () => jsonResponse({}, { status: 503, statusText: 'Unavailable' }),
  });
  await assert.rejects(httpClient.getHealth(), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'HTTP_ERROR');
    assert.equal(error.status, 503);
    return true;
  });

  const networkClient = createApiClient({
    fetchImpl: async () => {
      throw new TypeError('connection refused');
    },
  });
  await assert.rejects(networkClient.getHealth(), { code: 'NETWORK_ERROR' });

  const invalidJsonClient = createApiClient({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      async text() {
        return '{not-json';
      },
    }),
  });
  await assert.rejects(invalidJsonClient.getHealth(), { code: 'INVALID_JSON' });

  const invalidMeasurementClient = createApiClient({
    fetchImpl: async () => jsonResponse({ ...validMeasurement }),
  });
  await assert.rejects(invalidMeasurementClient.getLatestMeasurements('salle-01'), {
    code: 'INVALID_RESPONSE',
  });
});

test('reports request timeout and forwards caller cancellation', async () => {
  const timeoutClient = createApiClient({
    timeoutMs: 5,
    fetchImpl: (_url, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(signal.reason),
          { once: true },
        );
      }),
  });
  await assert.rejects(timeoutClient.getHealth(), { code: 'TIMEOUT' });

  const controller = new AbortController();
  const cancelledClient = createApiClient({
    fetchImpl: (_url, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(signal.reason),
          { once: true },
        );
      }),
  });
  const request = cancelledClient.getHealth({ signal: controller.signal });
  controller.abort();
  await assert.rejects(request, (error) => error.name === 'AbortError');

  const bodyTimeoutClient = createApiClient({
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    }),
  });
  await assert.rejects(bodyTimeoutClient.getHealth(), { code: 'TIMEOUT' });
});
