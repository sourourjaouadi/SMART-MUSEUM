import assert from 'node:assert/strict';
import test from 'node:test';
import { clearSession, getAccessToken, getSession, saveSession } from './authSession.js';

function response(overrides = {}) {
  return {
    accessToken: 'test-access-token',
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
    ...overrides,
  };
}

test('saves a short-lived session and clears its token on logout', () => {
    clearSession();
    const session = saveSession(response());
    assert.equal(getAccessToken(), 'test-access-token');
    assert.equal(getSession().user.role, 'CLIENT');
    assert.ok(session.expiresAt > Date.now());
    clearSession();
    assert.equal(getAccessToken(), null);
  });

test('removes expired and malformed persisted sessions', () => {
    clearSession();
    globalThis.sessionStorage.setItem('smart-museum.client.session', JSON.stringify({
      accessToken: 'stale',
      expiresAt: Date.now() - 1,
      user: response().user,
    }));
    assert.equal(getSession(), null);
    assert.equal(globalThis.sessionStorage.getItem('smart-museum.client.session'), null);
    assert.throws(() => saveSession(response({ tokenType: 'Basic' })), /backend contract/);
});
