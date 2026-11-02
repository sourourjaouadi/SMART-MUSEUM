import assert from 'node:assert/strict';
import test from 'node:test';
import { createRefreshScheduler } from './refreshScheduler.js';

function createIntervalHarness() {
  let callback;
  let cleared = false;

  return {
    setIntervalFn(fn) {
      callback = fn;
      return 1;
    },
    clearIntervalFn() {
      cleared = true;
    },
    tick() {
      callback();
    },
    get cleared() {
      return cleared;
    },
  };
}

test('refreshes immediately and prevents overlapping refresh requests', async () => {
  const harness = createIntervalHarness();
  let resolveRefresh;
  let callCount = 0;
  const scheduler = createRefreshScheduler(
    () => {
      callCount += 1;
      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    },
    15000,
    harness,
  );

  scheduler.start();
  await Promise.resolve();
  harness.tick();
  assert.equal(callCount, 1);

  resolveRefresh();
  await Promise.resolve();
  harness.tick();
  await Promise.resolve();
  assert.equal(callCount, 2);

  scheduler.stop();
  assert.equal(harness.cleared, true);
});

test('routes refresh errors to the supplied handler', async () => {
  const harness = createIntervalHarness();
  let reportedError;
  const scheduler = createRefreshScheduler(
    async () => {
      throw new Error('offline');
    },
    15000,
    { ...harness, onError: (error) => { reportedError = error; } },
  );

  scheduler.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reportedError?.message, 'offline');
  scheduler.stop();
});
