import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DATA_MODES,
  getAvailableDevices,
  getAvailableZones,
  getMeasurementHistory,
  getZoneData,
} from './dataSource.js';

test('lists only the documented mock zones and device identifiers', () => {
  assert.deepEqual(
    getAvailableZones().map(({ id, deviceId }) => [id, deviceId]),
    [
      ['salle-01', 'bme280-01'],
      ['salle-02', 'sim-bme280-02'],
    ],
  );
});

test('derives unique zones from API devices without assuming zone identifiers', () => {
  const devices = [
    { deviceId: 'first', zoneId: 'gallery-east' },
    { deviceId: 'second', zoneId: 'gallery-east' },
    { deviceId: 'third', zoneId: 'archive-2' },
    { deviceId: 'invalid', zoneId: ' ' },
    { deviceId: 'missing-zone' },
  ];

  assert.deepEqual(
    getAvailableZones(devices).map(({ id, shortLabel }) => [id, shortLabel]),
    [
      ['gallery-east', 'gallery-east'],
      ['archive-2', 'archive-2'],
    ],
  );
  assert.deepEqual(getAvailableZones([]), []);
});

test('loads demonstration devices and readings for the selected zone only', async () => {
  const result = await getZoneData('salle-02', { mode: DATA_MODES.MOCK });

  assert.equal(result.devices.length, 1);
  assert.equal(result.devices[0].gatewayId, 'gw-sim');
  assert.equal(result.devices[0].source, 'simulated');
  assert.ok(result.measurements.length > 0);
  assert.ok(result.measurements.every((measurement) => measurement.zoneId === 'salle-02'));
});

test('returns empty collections for a zone without mock records', async () => {
  assert.deepEqual(await getZoneData('unknown-zone', { mode: DATA_MODES.MOCK }), {
    devices: [],
    measurements: [],
  });
});

test('rejects unsupported data modes', async () => {
  await assert.rejects(getZoneData('salle-01', { mode: 'other' }), /Unsupported data mode/);
});

test('filters mock history by device, property, range and limit', async () => {
  const result = await getMeasurementHistory(
    {
      deviceId: 'bme280-01',
      property: 'temperature',
      from: '2026-11-02T07:00:00Z',
      to: '2026-11-02T08:00:00Z',
      limit: 1,
    },
    { mode: DATA_MODES.MOCK },
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].measurementId, 'demo-salle-01-temperature');
  assert.equal(result[0].observedAt, '2026-11-02T07:28:00Z');
});

test('returns no mock history when filters do not match available demonstration records', async () => {
  const result = await getMeasurementHistory(
    { deviceId: 'bme280-01', property: 'temperature', from: '2026-11-03T00:00:00Z' },
    { mode: DATA_MODES.MOCK },
  );
  assert.deepEqual(result, []);
});

test('uses mock devices for mock selection and API devices for API selection', () => {
  assert.equal(getAvailableDevices(DATA_MODES.MOCK).length, 2);
  assert.deepEqual(getAvailableDevices(DATA_MODES.API, [{ deviceId: 'api-device' }]), [
    { deviceId: 'api-device' },
  ]);
});
