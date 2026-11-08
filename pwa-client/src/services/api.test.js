import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createApiClient } from './api.js';
import { clearSession, getAccessToken, saveSession } from './authSession.js';

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

function validLoginResponse(accessToken = 'test-jwt') {
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 900,
    user: {
      userId: 'a4cd67bc-e1c7-43c8-9d8b-9058af504400',
      name: 'Museum Client',
      email: 'client@example.org',
      role: 'CLIENT',
      status: 'active',
      zoneIds: ['salle-01'],
    },
  };
}

test('logs in using the backend DTO without attaching a prior bearer token', async () => {
  clearSession();
  let captured;
  const client = createApiClient({
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return jsonResponse(validLoginResponse());
    },
  });

  assert.deepEqual(await client.login('client@example.org', 'secret-password'), validLoginResponse());
  assert.equal(new URL(captured.url).pathname, '/api/auth/login');
  assert.equal(captured.options.method, 'POST');
  assert.deepEqual(JSON.parse(captured.options.body), {
    email: 'client@example.org',
    password: 'secret-password',
  });
  assert.equal(captured.options.headers.Authorization, undefined);
});

test('attaches the saved bearer token to protected client endpoints', async () => {
  clearSession();
  saveSession(validLoginResponse('attached-jwt'));
  const captured = [];
  const client = createApiClient({
    fetchImpl: async (url, options) => {
      captured.push({ url, options });
      return jsonResponse(url.includes('/measurements') ? [] : []);
    },
  });

  await client.getDevices();
  await client.getLatestMeasurements('salle-01');
  await client.getMeasurements({ deviceId: 'bme280-01', property: 'temperature' });
  assert.equal(captured.length, 3);
  assert.ok(captured.every(({ options }) => options.headers.Authorization === 'Bearer attached-jwt'));
  clearSession();
});

test('clears expired sessions on protected 401 and reports forbidden responses safely', async () => {
  clearSession();
  saveSession(validLoginResponse('expired-jwt'));
  const expiredClient = createApiClient({
    fetchImpl: async () => jsonResponse({ error: 'UNAUTHORIZED', message: 'expired' }, { status: 401 }),
  });
  await assert.rejects(expiredClient.getDevices(), (error) => {
    assert.equal(error.status, 401);
    assert.match(error.message, /expired/i);
    return true;
  });
  assert.equal(getAccessToken(), null);

  const forbiddenClient = createApiClient({
    fetchImpl: async () => jsonResponse({ error: 'FORBIDDEN', message: 'details' }, { status: 403 }),
  });
  await assert.rejects(forbiddenClient.getLatestMeasurements('salle-02'), (error) => {
    assert.equal(error.status, 403);
    assert.match(error.message, /Access denied/);
    assert.equal(error.message.includes('details'), false);
    return true;
  });
  clearSession();
});

test('rejects invalid login credentials through the backend error status', async () => {
  const client = createApiClient({
    fetchImpl: async () => jsonResponse({ error: 'UNAUTHORIZED', message: 'Invalid email or password' }, { status: 401 }),
  });
  await assert.rejects(client.login('nobody@example.org', 'incorrect'), {
    status: 401,
    message: 'Email or password was not accepted.',
  });
});

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
      return jsonResponse(
        url.endsWith('/api/health')
          ? { status: 'UP', mongo: 'UP' }
          : url.endsWith('/api/devices/device-1')
            ? { deviceId: 'device-1', zoneId: 'salle-01' }
            : [],
      );
    },
  });

  assert.deepEqual(await client.getHealth(), { status: 'UP', mongo: 'UP' });
  assert.deepEqual(await client.getDevices(), []);
  await client.getDevice('device-1');
  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), [
    '/api/health',
    '/api/devices',
    '/api/devices/device-1',
  ]);
  assert.deepEqual(requests[0].options.headers, { Accept: 'application/json' });
  assert.equal(
    Object.keys(requests[0].options.headers).some((name) =>
      name.toLowerCase().includes('token'),
    ),
    false,
  );
});

test('preserves backend device status and last-seen fields', async () => {
  const devices = [
    {
      deviceId: 'actual-device',
      zoneId: 'gallery-east',
      gatewayId: 'gateway-east',
      status: 'ACTIVE',
      lastSeenAt: '2026-11-02T08:30:00Z',
    },
  ];
  const client = createApiClient({
    fetchImpl: async () => jsonResponse(devices),
  });

  assert.deepEqual(await client.getDevices(), devices);

  const invalidClient = createApiClient({
    fetchImpl: async () => jsonResponse([null]),
  });
  await assert.rejects(invalidClient.getDevices(), { code: 'INVALID_RESPONSE' });
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

  const structuredErrorClient = createApiClient({
    fetchImpl: async () =>
      jsonResponse(
        {
          error: 'INTERNAL_ERROR',
          message: 'Sensitive backend detail must not reach the interface.',
        },
        { status: 500, statusText: 'Internal Server Error' },
      ),
  });
  await assert.rejects(structuredErrorClient.getHealth(), (error) => {
    assert.equal(error.backendErrorCode, 'INTERNAL_ERROR');
    assert.deepEqual(error.backendError, {
      error: 'INTERNAL_ERROR',
      message: 'Sensitive backend detail must not reach the interface.',
    });
    assert.equal(error.message.includes('Sensitive backend detail'), false);
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
