const SESSION_KEY = 'smart-museum.client.session';
export const SESSION_EXPIRED_EVENT = 'smart-museum:session-expired';

function storage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function notifySessionExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

export function getSession() {
  const store = storage();
  if (!store) return null;
  try {
    const session = JSON.parse(store.getItem(SESSION_KEY) || 'null');
    if (
      !session ||
      typeof session.accessToken !== 'string' ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now() ||
      !session.user ||
      typeof session.user.userId !== 'string' ||
      typeof session.user.name !== 'string' ||
      typeof session.user.email !== 'string' ||
      !['ADMIN', 'CLIENT'].includes(session.user.role) ||
      !['active', 'disabled'].includes(session.user.status) ||
      !Array.isArray(session.user.zoneIds) ||
      session.user.zoneIds.some((zoneId) => typeof zoneId !== 'string')
    ) {
      try { store.removeItem(SESSION_KEY); } catch { /* Storage may be disabled. */ }
      return null;
    }
    return session;
  } catch {
    try { store.removeItem(SESSION_KEY); } catch { /* Storage may be disabled. */ }
    return null;
  }
}

export function getAccessToken() {
  return getSession()?.accessToken ?? null;
}

export function saveSession(loginResponse) {
  if (
    !loginResponse ||
    typeof loginResponse.accessToken !== 'string' ||
    loginResponse.accessToken.length === 0 ||
    loginResponse.tokenType !== 'Bearer' ||
    !Number.isInteger(loginResponse.expiresIn) ||
    loginResponse.expiresIn < 60 ||
    loginResponse.expiresIn > 3600 ||
    !loginResponse.user ||
    typeof loginResponse.user.userId !== 'string' ||
    typeof loginResponse.user.name !== 'string' ||
    typeof loginResponse.user.email !== 'string' ||
    !['ADMIN', 'CLIENT'].includes(loginResponse.user.role) ||
    !['active', 'disabled'].includes(loginResponse.user.status) ||
    !Array.isArray(loginResponse.user.zoneIds) ||
    loginResponse.user.zoneIds.some((zoneId) => typeof zoneId !== 'string')
  ) {
    throw new TypeError('The login response does not match the backend contract.');
  }

  const session = {
    accessToken: loginResponse.accessToken,
    expiresAt: Date.now() + loginResponse.expiresIn * 1000,
    user: loginResponse.user,
  };
  const store = storage();
  if (!store) throw new Error('Browser session storage is unavailable.');
  try {
    store.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new Error('Browser session storage is unavailable. Sign-in cannot be kept safely.');
  }
  return session;
}

export function clearSession({ expired = false } = {}) {
  try { storage()?.removeItem(SESSION_KEY); } catch { /* Best-effort local cleanup. */ }
  if (expired) notifySessionExpired();
}
