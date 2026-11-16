// Short-lived ADMIN session kept in sessionStorage (per tab, cleared with the browser session).
// Same pattern as the Client PWA, with its own key: a CLIENT account is never stored here.
const SESSION_KEY = 'smart-museum.admin.session';
export const ADMIN_SESSION_EXPIRED_EVENT = 'smart-museum-admin:session-expired';

export class NotAdminError extends Error {
  constructor() {
    super('This account is not an administrator. Use an ADMIN account to open the Admin PWA.');
    this.name = 'NotAdminError';
    this.code = 'NOT_ADMIN';
  }
}

function storage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function isValidUser(user) {
  return (
    user != null &&
    typeof user.userId === 'string' &&
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    ['ADMIN', 'CLIENT'].includes(user.role) &&
    ['active', 'disabled'].includes(user.status) &&
    Array.isArray(user.zoneIds) &&
    user.zoneIds.every((zoneId) => typeof zoneId === 'string')
  );
}

function remove(store) {
  try { store.removeItem(SESSION_KEY); } catch { /* Storage may be disabled. */ }
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
      !isValidUser(session.user) ||
      session.user.role !== 'ADMIN'
    ) {
      if (session) remove(store);
      return null;
    }
    return session;
  } catch {
    remove(store);
    return null;
  }
}

export function getAccessToken() {
  return getSession()?.accessToken ?? null;
}

/** Validates the login response, refuses non-ADMIN accounts, and stores the session. */
export function saveSession(loginResponse) {
  if (
    !loginResponse ||
    typeof loginResponse.accessToken !== 'string' ||
    loginResponse.accessToken.length === 0 ||
    loginResponse.tokenType !== 'Bearer' ||
    !Number.isInteger(loginResponse.expiresIn) ||
    loginResponse.expiresIn < 60 ||
    loginResponse.expiresIn > 3600 ||
    !isValidUser(loginResponse.user)
  ) {
    throw new TypeError('The login response does not match the backend contract.');
  }
  if (loginResponse.user.role !== 'ADMIN' || loginResponse.user.status !== 'active') {
    throw new NotAdminError();
  }

  const session = {
    accessToken: loginResponse.accessToken,
    expiresAt: Date.now() + loginResponse.expiresIn * 1000,
    user: loginResponse.user,
  };
  const store = storage();
  if (!store) throw new Error('Browser session storage is unavailable. Sign-in cannot be kept safely.');
  try {
    store.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new Error('Browser session storage is unavailable. Sign-in cannot be kept safely.');
  }
  return session;
}

export function clearSession({ expired = false } = {}) {
  const store = storage();
  if (store) remove(store);
  if (expired && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
  }
}
