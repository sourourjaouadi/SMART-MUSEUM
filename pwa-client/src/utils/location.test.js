import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDeviceLocation, formatLocation } from './location.js';

test('formats WGS84 coordinates with five decimals and the floor', () => {
  assert.equal(
    formatLocation({ latitude: 36.8065, longitude: 10.1815, floor: 0 }),
    '36.80650, 10.18150 · Floor 0',
  );
  assert.equal(formatLocation({ latitude: -33.9, longitude: 151.2 }), '-33.90000, 151.20000');
});

test('returns null for missing or incomplete locations', () => {
  assert.equal(formatLocation(null), null);
  assert.equal(formatLocation({ latitude: 36.8 }), null);
  assert.equal(formatLocation({ latitude: Number.NaN, longitude: 10 }), null);
});

test('labels whether a device location is its own or inherited from the zone', () => {
  const location = { latitude: 36.80652, longitude: 10.18148, floor: 1 };
  assert.equal(
    formatDeviceLocation({ location, locationSource: 'device' }),
    '36.80652, 10.18148 · Floor 1 (own position)',
  );
  assert.equal(
    formatDeviceLocation({ location, locationSource: 'zone' }),
    '36.80652, 10.18148 · Floor 1 (from zone)',
  );
  assert.equal(formatDeviceLocation({ deviceId: 'no-location' }), null);
});
