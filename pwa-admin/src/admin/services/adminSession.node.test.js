import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

// Node exposes sessionStorage by default only from v25; use a local in-memory store.
const values = new Map();
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  },
});

const { NotAdminError, clearSession, getAccessToken, getSession, saveSession } = await import('./adminSession.js');

function login(role = 'ADMIN', overrides = {}) {
  return {
    accessToken: 'test-access-token',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: { userId: 'u-1', name: 'Test Admin', email: 'admin@example.org', role, status: 'active', zoneIds: [] },
    ...overrides,
  };
}

beforeEach(() => values.clear());

test('stores a short-lived ADMIN session and clears it on logout', () => {
  const session = saveSession(login());
  assert.equal(getAccessToken(), 'test-access-token');
  assert.equal(getSession().user.role, 'ADMIN');
  assert.ok(session.expiresAt > Date.now() && session.expiresAt <= Date.now() + 900_000);
  clearSession();
  assert.equal(getSession(), null);
  assert.equal(values.size, 0);
});

test('refuses CLIENT and disabled accounts without storing anything', () => {
  assert.throws(() => saveSession(login('CLIENT')), NotAdminError);
  const disabled = login();
  disabled.user.status = 'disabled';
  assert.throws(() => saveSession(disabled), NotAdminError);
  assert.equal(values.size, 0);
});

test('rejects malformed login responses', () => {
  assert.throws(() => saveSession(login('ADMIN', { tokenType: 'Basic' })), TypeError);
  assert.throws(() => saveSession(login('ADMIN', { expiresIn: 30 })), TypeError);
  assert.throws(() => saveSession({}), TypeError);
});

test('drops expired, tampered, and non-ADMIN stored sessions', () => {
  const key = 'smart-museum.admin.session';
  const user = login().user;
  values.set(key, JSON.stringify({ accessToken: 't', expiresAt: Date.now() - 1, user }));
  assert.equal(getSession(), null);
  assert.equal(values.has(key), false);

  values.set(key, JSON.stringify({ accessToken: 't', expiresAt: Date.now() + 60_000, user: { ...user, role: 'CLIENT' } }));
  assert.equal(getSession(), null);

  values.set(key, '{not json');
  assert.equal(getSession(), null);
  assert.equal(values.has(key), false);
});
