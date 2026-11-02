import assert from 'node:assert/strict';
import test from 'node:test';
import { getHistoryChartPoints } from './historyChart.js';

const reading = (measurementId, observedAt, value) => ({
  measurementId,
  observedAt,
  value,
});

test('returns no chart points for empty or invalid readings', () => {
  assert.deepEqual(getHistoryChartPoints([]), []);
  assert.deepEqual(getHistoryChartPoints(undefined), []);
  assert.deepEqual(
    getHistoryChartPoints([reading('invalid', 'not-a-date', 2)]),
    [],
  );
});

test('orders plotted points by observedAt without changing source records', () => {
  const later = reading('later', '2026-11-02T08:00:00Z', 22);
  const earlier = reading('earlier', '2026-11-02T07:00:00Z', 20);
  const points = getHistoryChartPoints([later, earlier]);

  assert.deepEqual(points.map((point) => point.key), ['earlier', 'later']);
  assert.ok(points[0].x < points[1].x);
  assert.ok(points[0].y > points[1].y);
  assert.equal(earlier.value, 20);
});

test('places a single reading as one point without creating extra records', () => {
  const points = getHistoryChartPoints([
    reading('one', '2026-11-02T07:00:00Z', 20),
  ]);
  assert.equal(points.length, 1);
  assert.equal(points[0].value, 20);
});
