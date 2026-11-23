import { clearSession, getAccessToken } from './adminSession.js';

// Admin API client. Same patterns as pwa-client/src/services/api.js: base URL from
// VITE_API_BASE_URL, request timeout, Bearer token, ApiError, and 401 -> session cleared.
const DEFAULT_API_BASE_URL = 'https://api.smartmuseum.test/api';
const DEFAULT_TIMEOUT_MS = 10_000;
const SAFE_BACKEND_ERROR_CODE = /^[A-Z0-9_]{1,64}$/;
const DEVICE_STATUSES = new Set(['pending', 'active', 'rejected', 'offline']);

export class ApiError extends Error {
  constructor(message, { code, status, cause, backendError } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.backendErrorCode =
      typeof backendError?.error === 'string' && SAFE_BACKEND_ERROR_CODE.test(backendError.error)
        ? backendError.error
        : undefined;
    this.backendMessage =
      typeof backendError?.message === 'string' && backendError.message.length <= 300
        ? backendError.message
        : undefined;
  }
}

async function readBackendError(response) {
  try {
    const payload = JSON.parse(await response.text());
    return payload && typeof payload === 'object' && typeof payload.error === 'string'
      ? payload
      : undefined;
  } catch {
    return undefined;
  }
}

function httpErrorMessage(status, { authenticated, conflictMessage, notFoundMessage, backendError }) {
  if (status === 401) {
    return authenticated
      ? 'Your session has ended. Sign in again.'
      : 'The email or password was not accepted.';
  }
  if (status === 403) return 'This action requires an administrator account.';
  if (status === 404) return notFoundMessage ?? 'This device or zone no longer exists. Refresh the list.';
  if (status === 409) return conflictMessage ?? 'The request conflicts with the current state. Refresh and try again.';
  if (status === 400) {
    return typeof backendError?.message === 'string' && backendError.message.length <= 300
      ? `The server rejected the values: ${backendError.message}`
      : 'The server rejected the submitted values.';
  }
  if (status === 503) return 'A backend service is unavailable. Try again later.';
  return `The API request failed with HTTP ${status}.`;
}

function isLocation(location) {
  return (
    location != null &&
    typeof location === 'object' &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 && location.latitude <= 90 &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 && location.longitude <= 180 &&
    (location.floor == null || Number.isInteger(location.floor))
  );
}

function isDevice(device) {
  return (
    device != null &&
    typeof device === 'object' &&
    !Array.isArray(device) &&
    typeof device.deviceId === 'string' &&
    typeof device.zoneId === 'string' &&
    DEVICE_STATUSES.has(device.status) &&
    ['type', 'gatewayId', 'lastSeenAt', 'thingId'].every(
      (field) => device[field] == null || typeof device[field] === 'string',
    ) &&
    (device.location == null || isLocation(device.location)) &&
    (device.locationSource == null || ['device', 'zone'].includes(device.locationSource))
  );
}

function isZone(zone) {
  return (
    zone != null &&
    typeof zone === 'object' &&
    !Array.isArray(zone) &&
    typeof zone.zoneId === 'string' &&
    (zone.name == null || typeof zone.name === 'string') &&
    (zone.location == null || isLocation(zone.location))
  );
}

function isThingDescription(td) {
  return (
    td != null &&
    typeof td === 'object' &&
    !Array.isArray(td) &&
    typeof td.id === 'string' &&
    typeof td.title === 'string' &&
    ['properties', 'actions', 'events'].every(
      (field) => td[field] == null || (typeof td[field] === 'object' && !Array.isArray(td[field])),
    )
  );
}

function invalid(endpoint) {
  return new ApiError(`${endpoint} returned an unexpected response.`, { code: 'INVALID_RESPONSE' });
}

function list(payload, check, endpoint) {
  if (!Array.isArray(payload) || !payload.every(check)) throw invalid(endpoint);
  return payload;
}

function one(payload, check, endpoint) {
  if (!check(payload)) throw invalid(endpoint);
  return payload;
}

function segment(value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(value)) {
    throw new TypeError(`${name} must be a valid identifier.`);
  }
  return encodeURIComponent(value);
}

export function createAdminApiClient({
  baseUrl = import.meta.env?.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  timeoutMs = Number(import.meta.env?.VITE_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  getToken = getAccessToken,
  onUnauthorized = () => clearSession({ expired: true }),
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  function requestUrl(path) {
    const withoutDuplicateApi = normalizedBaseUrl.endsWith('/api') && path.startsWith('/api/')
      ? path.slice('/api'.length)
      : path;
    return `${normalizedBaseUrl}${withoutDuplicateApi}`;
  }

  async function request(path, {
    method = 'GET',
    body,
    authenticated = true,
    conflictMessage,
    notFoundMessage,
    signal,
  } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new ApiError('No fetch implementation is available.', { code: 'NETWORK_ERROR' });
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException('The API request timed out.', 'TimeoutError')),
      timeoutMs,
    );
    const abortFromCaller = () => controller.abort(signal.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener('abort', abortFromCaller, { once: true });

    const timedOut = () => controller.signal.reason?.name === 'TimeoutError';
    try {
      const headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const token = authenticated ? getToken() : null;
      if (token) headers.Authorization = `Bearer ${token}`;

      let response;
      try {
        response = await fetchImpl(requestUrl(path), {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
        });
      } catch (error) {
        if (timedOut()) {
          throw new ApiError(`The API did not answer within ${timeoutMs / 1000} s.`, { code: 'TIMEOUT', cause: error });
        }
        if (controller.signal.aborted) throw error;
        throw new ApiError('The API could not be reached. Check the network and the middleware.', {
          code: 'NETWORK_ERROR',
          cause: error,
        });
      }

      if (!response.ok) {
        const backendError = await readBackendError(response);
        if (response.status === 401 && authenticated) onUnauthorized();
        throw new ApiError(
          httpErrorMessage(response.status, { authenticated, conflictMessage, notFoundMessage, backendError }),
          { code: 'HTTP_ERROR', status: response.status, backendError },
        );
      }

      const text = await response.text();
      try {
        return text ? JSON.parse(text) : null;
      } catch (error) {
        throw new ApiError(`${method} ${path} returned invalid JSON.`, { code: 'INVALID_JSON', cause: error });
      }
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  return {
    async login(email, password, options = {}) {
      return request('/api/auth/login', {
        ...options,
        method: 'POST',
        body: { email, password },
        authenticated: false,
      });
    },

    async getDevices(options) {
      return list(await request('/api/devices', options), isDevice, '/api/devices');
    },

    /** W3C WoT Thing Description of a device (ADMIN only). */
    async getThingDescription(deviceId, options) {
      const path = `/api/things/${segment(deviceId, 'deviceId')}`;
      return one(await request(path, {
        ...options,
        notFoundMessage: 'No Thing Description is registered for this device.',
      }), isThingDescription, path);
    },

    async approveDevice(deviceId, options) {
      const path = `/api/devices/${segment(deviceId, 'deviceId')}/approve`;
      return one(await request(path, {
        ...options,
        method: 'POST',
        conflictMessage: 'This device cannot be approved yet: no Thing Description is registered for it.',
      }), isDevice, path);
    },

    async rejectDevice(deviceId, options) {
      const path = `/api/devices/${segment(deviceId, 'deviceId')}/reject`;
      return one(await request(path, { ...options, method: 'POST' }), isDevice, path);
    },

    async assignDeviceLocation(deviceId, location, options) {
      const path = `/api/devices/${segment(deviceId, 'deviceId')}/location`;
      return one(await request(path, {
        ...options,
        method: 'PUT',
        body: location,
        conflictMessage: 'Approve this device before assigning it a location.',
      }), isDevice, path);
    },

    async clearDeviceLocation(deviceId, options) {
      const path = `/api/devices/${segment(deviceId, 'deviceId')}/location`;
      return one(await request(path, {
        ...options,
        method: 'DELETE',
        conflictMessage: 'Approve this device before changing its location.',
      }), isDevice, path);
    },

    async getZones(options) {
      return list(await request('/api/zones', options), isZone, '/api/zones');
    },

    async saveZone(zoneId, { name, location }, options) {
      const path = `/api/zones/${segment(zoneId, 'zoneId')}`;
      return one(await request(path, { ...options, method: 'PUT', body: { name, location } }), isZone, path);
    },

    async provisionClient({ name, email, password, zoneIds }, options) {
      const account = await request('/api/users', {
        ...options,
        method: 'POST',
        body: { name, email, password, zoneIds },
        conflictMessage: 'An account with this email already exists.',
      });
      if (!account || typeof account.userId !== 'string' || account.role !== 'CLIENT') {
        throw invalid('/api/users');
      }
      return account;
    },
  };
}
