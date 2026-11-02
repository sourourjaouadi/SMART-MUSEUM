import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMeasurementDefinition,
  getMeasurementMetadata,
  groupMeasurementsByProperty,
} from './measurementData.js';

const firstReading = {
  measurementId: 'example-1',
  deviceId: 'bme280-01',
  zoneId: 'salle-01',
  gatewayId: 'gw-01',
  property: 'temperature',
  value: 21.4,
  unit: '°C',
  observedAt: '2026-11-01T08:49:05Z',
  source: 'real',
};

test('groups readings by property without dropping measurements', () => {
  const groups = groupMeasurementsByProperty([
    firstReading,
    { ...firstReading, measurementId: 'example-2', deviceId: 'other-device' },
    { ...firstReading, property: 'humidity', unit: '%' },
  ]);

  assert.deepEqual(groups.map(({ property, measurements }) => [property, measurements.length]), [
    ['temperature', 2],
    ['humidity', 1],
  ]);
  assert.equal(groups[0].definition.label, 'Temperature');
});

test('returns no groups for empty or malformed input', () => {
  assert.deepEqual(groupMeasurementsByProperty([]), []);
  assert.deepEqual(groupMeasurementsByProperty(undefined), []);
  assert.deepEqual(groupMeasurementsByProperty([null, {}, { property: '' }]), []);
});

test('keeps unknown properties identifiable without assigning invented meanings', () => {
  assert.deepEqual(getMeasurementDefinition('surface-index', 'index'), {
    property: 'surface-index',
    label: 'surface-index',
    unit: 'index',
    symbol: '?',
  });
  assert.equal(getMeasurementDefinition('custom-field').unit, null);
});

test('omits absent optional fields and labels mock metadata', () => {
  const metadata = getMeasurementMetadata(firstReading, { isMock: true });

  assert.deepEqual(metadata, [
    ['Timestamp', new Date(firstReading.observedAt).toLocaleString()],
    ['Device', 'bme280-01'],
    ['Zone', 'salle-01'],
    ['Gateway ID', 'gw-01'],
    ['Source', 'real'],
    ['Data mode', 'Demonstration data'],
  ]);
  assert.equal(metadata.some(([label]) => label === 'Quality'), false);
});

test('includes available quality and safely handles a missing measurement', () => {
  assert.equal(
    getMeasurementMetadata({ ...firstReading, quality: 'good' }).at(-1)[1],
    'good',
  );
  assert.deepEqual(getMeasurementMetadata(null), []);
});
