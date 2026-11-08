import { clearSession, getAccessToken } from './authSession.js';

const DEFAULT_API_BASE_URL = 'http://localhost:8080';
const DEFAULT_TIMEOUT_MS = 10_000;
const VALID_SOURCES = new Set(['real', 'simulated']);
const VALID_QUALITY_VALUES = new Set(['good', 'uncertain', 'bad']);
const SAFE_BACKEND_ERROR_CODE = /^[A-Z0-9_]{1,64}$/;

export class ApiError extends Error {
  constructor(message, { code, status, cause, backendError } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.backendError = backendError;
    this.backendErrorCode =
      typeof backendError?.error === 'string' &&
      SAFE_BACKEND_ERROR_CODE.test(backendError.error)
        ? backendError.error
        : undefined;
  }
}

async function readBackendError(response) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return undefined;
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    typeof payload.error !== 'string' ||
    typeof payload.message !== 'string'
  ) {
    return undefined;
  }

  return {
    error: payload.error,
    message: payload.message,
  };
}

function validateMeasurements(payload, endpoint) {
  if (!Array.isArray(payload)) {
    throw new ApiError(`${endpoint} returned an invalid response; expected an array.`, {
      code: 'INVALID_RESPONSE',
    });
  }

  const requiredFields = [
    'measurementId',
    'deviceId',
    'zoneId',
    'property',
    'unit',
    'observedAt',
  ];

  const invalidIndex = payload.findIndex((measurement) => {
    if (!measurement || typeof measurement !== 'object' || Array.isArray(measurement)) {
      return true;
    }

    if (
      requiredFields.some((field) => typeof measurement[field] !== 'string') ||
      typeof measurement.value !== 'number' ||
      !Number.isFinite(measurement.value) ||
      !VALID_SOURCES.has(measurement.source) ||
      !Number.isFinite(Date.parse(measurement.observedAt))
    ) {
      return true;
    }

    if (
      measurement.gatewayId != null &&
      typeof measurement.gatewayId !== 'string'
    ) {
      return true;
    }

    if (
      measurement.receivedAt != null &&
      (typeof measurement.receivedAt !== 'string' ||
        !Number.isFinite(Date.parse(measurement.receivedAt)))
    ) {
      return true;
    }

    return (
      measurement.quality != null &&
      !VALID_QUALITY_VALUES.has(measurement.quality)
    );
  });

  if (invalidIndex !== -1) {
    throw new ApiError(
      `${endpoint} returned an invalid measurement at index ${invalidIndex}.`,
      { code: 'INVALID_RESPONSE' },
    );
  }

  return payload;
}

function validateDevices(payload) {
  if (!Array.isArray(payload)) {
    throw new ApiError('/api/devices returned an invalid response; expected an array.', {
      code: 'INVALID_RESPONSE',
    });
  }

  const optionalStringFields = ['gatewayId', 'status', 'lastSeenAt'];
  const invalidIndex = payload.findIndex((device) => {
    if (
      !device ||
      typeof device !== 'object' ||
      Array.isArray(device) ||
      typeof device.deviceId !== 'string' ||
      typeof device.zoneId !== 'string'
    ) {
      return true;
    }

    return optionalStringFields.some(
      (field) =>
        device[field] != null &&
        typeof device[field] !== 'string',
    );
  });

  if (invalidIndex !== -1) {
    throw new ApiError(
      `/api/devices returned an invalid device at index ${invalidIndex}.`,
      { code: 'INVALID_RESPONSE' },
    );
  }

  return payload;
}

export function createApiClient({
  baseUrl = import.meta.env?.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  timeoutMs = Number(import.meta.env?.VITE_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required to create the API client.');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  async function requestJson(path, {
    signal,
    method = 'GET',
    body,
    authenticated = path !== '/api/health',
  } = {}) {
    const accessToken = authenticated ? getAccessToken() : null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new DOMException('The API request timed out.', 'TimeoutError'));
    }, timeoutMs);

    const abortFromCaller = () => controller.abort(signal.reason);
    if (signal?.aborted) {
      abortFromCaller();
    } else {
      signal?.addEventListener('abort', abortFromCaller, { once: true });
    }

    try {
      let response;
      try {
        const headers = { Accept: 'application/json' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          if (controller.signal.reason?.name === 'TimeoutError') {
            throw new ApiError(`${method} ${path} timed out after ${timeoutMs} ms.`, {
              code: 'TIMEOUT',
              cause: error,
            });
          }
          throw error;
        }

        throw new ApiError(`${method} ${path} failed because the API could not be reached.`, {
          code: 'NETWORK_ERROR',
          cause: error,
        });
      }

      if (!response.ok) {
        let backendError;
        try {
          backendError = await readBackendError(response);
        } catch (error) {
          if (controller.signal.aborted) {
            if (controller.signal.reason?.name === 'TimeoutError') {
              throw new ApiError(`${method} ${path} timed out after ${timeoutMs} ms.`, {
                code: 'TIMEOUT',
                cause: error,
              });
            }
            throw error;
          }
        }
        if (response.status === 401 && authenticated) {
          clearSession({ expired: true });
        }
        const safeMessage = response.status === 403
          ? 'Access denied. Your account may not be assigned to this zone.'
          : response.status === 401
            ? authenticated
              ? 'Your session is invalid or expired. Sign in again.'
              : 'Email or password was not accepted.'
            : `${method} ${path} failed with HTTP ${response.status}.`;
        throw new ApiError(
          safeMessage,
          {
            code: 'HTTP_ERROR',
            status: response.status,
            backendError,
          },
        );
      }

      let responseText;
      try {
        responseText = await response.text();
      } catch (error) {
        if (controller.signal.aborted) {
          if (controller.signal.reason?.name === 'TimeoutError') {
            throw new ApiError(`${method} ${path} timed out after ${timeoutMs} ms.`, {
              code: 'TIMEOUT',
              cause: error,
            });
          }
          throw error;
        }
        throw new ApiError(`${method} ${path} response body could not be read.`, {
          code: 'INVALID_RESPONSE',
          cause: error,
        });
      }

      try {
        return JSON.parse(responseText);
      } catch (error) {
        throw new ApiError(`${method} ${path} returned invalid JSON.`, {
          code: 'INVALID_JSON',
          cause: error,
        });
      }
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  const getJson = (path, options) => requestJson(path, options);

  return {
    async login(email, password, options = {}) {
      if (typeof email !== 'string' || typeof password !== 'string') {
        throw new TypeError('Email and password are required.');
      }
      const response = await requestJson('/api/auth/login', {
        ...options,
        method: 'POST',
        body: { email, password },
        authenticated: false,
      });
      if (
        !response ||
        typeof response.accessToken !== 'string' ||
        response.tokenType !== 'Bearer' ||
        !Number.isInteger(response.expiresIn) ||
        response.expiresIn < 60 ||
        response.expiresIn > 3600 ||
        !response.user ||
        typeof response.user.userId !== 'string' ||
        typeof response.user.name !== 'string' ||
        typeof response.user.email !== 'string' ||
        !['ADMIN', 'CLIENT'].includes(response.user.role) ||
        !['active', 'disabled'].includes(response.user.status) ||
        !Array.isArray(response.user.zoneIds) ||
        response.user.zoneIds.some((zoneId) => typeof zoneId !== 'string')
      ) {
        throw new ApiError('POST /api/auth/login returned an invalid response.', {
          code: 'INVALID_RESPONSE',
        });
      }
      return response;
    },

    async getHealth(options) {
      return getJson('/api/health', options);
    },

    async getDevices(options) {
      return validateDevices(await getJson('/api/devices', options));
    },

    async getDevice(deviceId, options) {
      if (typeof deviceId !== 'string' || deviceId.length === 0) {
        throw new TypeError('deviceId must be a non-empty string.');
      }
      const path = `/api/devices/${encodeURIComponent(deviceId)}`;
      const device = await getJson(path, options);
      if (!Array.isArray(device) && device && typeof device === 'object') {
        const validation = validateDevices([device]);
        return validation[0];
      }
      throw new ApiError(`${path} returned an invalid device response.`, {
        code: 'INVALID_RESPONSE',
      });
    },

    async getLatestMeasurements(zoneId, options) {
      if (typeof zoneId !== 'string' || zoneId.length === 0) {
        throw new TypeError('zoneId must be a non-empty string.');
      }
      const query = new URLSearchParams({ zoneId });
      const endpoint = `/api/measurements/latest?${query}`;
      return validateMeasurements(await getJson(endpoint, options), endpoint);
    },

    async getMeasurements({
      deviceId,
      property,
      from,
      to,
      limit,
      signal,
    } = {}) {
      if (limit !== undefined && limit !== null && limit !== '') {
        const parsedLimit = Number(limit);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 5000) {
          throw new RangeError('History limit must be an integer between 1 and 5000.');
        }
      }

      const query = new URLSearchParams();
      for (const [key, value] of Object.entries({ deviceId, property, from, to, limit })) {
        if (value !== undefined && value !== null && value !== '') {
          query.set(key, String(value));
        }
      }

      const queryString = query.toString();
      const endpoint = `/api/measurements${queryString ? `?${queryString}` : ''}`;
      return validateMeasurements(
        await getJson(endpoint, { signal }),
        endpoint,
      );
    },
  };
}

const apiClient = createApiClient();

export const getHealth = (...args) => apiClient.getHealth(...args);
export const login = (...args) => apiClient.login(...args);
export const getDevices = (...args) => apiClient.getDevices(...args);
export const getDevice = (...args) => apiClient.getDevice(...args);
export const getLatestMeasurements = (...args) =>
  apiClient.getLatestMeasurements(...args);
export const getMeasurements = (...args) => apiClient.getMeasurements(...args);
