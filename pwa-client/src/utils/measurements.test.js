import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_STALE_AFTER_MS,
  DEFAULT_REFRESH_INTERVAL_MS,
  formatObservedAt,
  getFreshnessSummary,
  getFreshnessState,
  getRefreshIntervalMs,
  getStaleAfterMs,
} from './measurements.js';

const now = Date.parse('2026-11-02T08:00:00.000Z');

function measurement(observedAt) {
  return { observedAt };
}

test('uses a 15-minute default and accepts a configured threshold', () => {
  assert.equal(getStaleAfterMs(undefined), DEFAULT_STALE_AFTER_MS);
  assert.equal(getStaleAfterMs('60000'), 60000);
});

test('rejects invalid freshness threshold configuration', () => {
  assert.throws(() => getStaleAfterMs('0'), /positive number/);
  assert.throws(() => getStaleAfterMs('not-a-number'), /positive number/);
});

test('uses a 15-second refresh interval and enforces a 10-to-30-second range', () => {
  assert.equal(getRefreshIntervalMs(undefined), DEFAULT_REFRESH_INTERVAL_MS);
  assert.equal(getRefreshIntervalMs('10000'), 10000);
  assert.equal(getRefreshIntervalMs('30000'), 30000);
  assert.throws(() => getRefreshIntervalMs('9999'), /between 10000 and 30000/);
  assert.throws(() => getRefreshIntervalMs('30001'), /between 10000 and 30000/);
});

test('marks readings fresh only while every timestamp is within threshold', () => {
  assert.equal(
    getFreshnessState(
      [measurement('2026-11-02T07:50:00.000Z')],
      15 * 60 * 1000,
      now,
    ),
    'fresh',
  );
  assert.equal(
    getFreshnessState(
      [
        measurement('2026-11-02T07:50:00.000Z'),
        measurement('2026-11-02T07:40:00.000Z'),
      ],
      15 * 60 * 1000,
      now,
    ),
    'stale',
  );
});

test('treats missing or future timestamps as unavailable', () => {
  assert.equal(getFreshnessState([], 1000, now), 'unavailable');
  assert.equal(
    getFreshnessState([measurement('invalid-date')], 1000, now),
    'unavailable',
  );
  assert.equal(getFreshnessState([{}], 1000, now), 'unavailable');
  assert.equal(getFreshnessState([null], 1000, now), 'unavailable');
  assert.equal(getFreshnessState(undefined, 1000, now), 'unavailable');
  assert.equal(
    getFreshnessState(
      [measurement('2026-11-02T08:01:00.000Z')],
      1000,
      now,
    ),
    'unavailable',
  );
});

test('provides dashboard freshness labels', () => {
  assert.equal(
    getFreshnessSummary([measurement('2026-11-02T07:59:00.000Z')], 15 * 60 * 1000, now),
    'up-to-date',
  );
  assert.equal(
    getFreshnessSummary([measurement('2026-11-02T07:00:00.000Z')], 15 * 60 * 1000, now),
    'stale',
  );
  assert.equal(getFreshnessSummary([], 15 * 60 * 1000, now), 'unavailable');
});

test('formats missing timestamps without suggesting a current reading', () => {
  assert.equal(formatObservedAt(undefined), 'time unavailable');
});
