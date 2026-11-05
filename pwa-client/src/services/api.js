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

  async function getJson(path, { signal } = {}) {
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
        response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          if (controller.signal.reason?.name === 'TimeoutError') {
            throw new ApiError(`GET ${path} timed out after ${timeoutMs} ms.`, {
              code: 'TIMEOUT',
              cause: error,
            });
          }
          throw error;
        }

        throw new ApiError(`GET ${path} failed because the API could not be reached.`, {
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
              throw new ApiError(`GET ${path} timed out after ${timeoutMs} ms.`, {
                code: 'TIMEOUT',
                cause: error,
              });
            }
            throw error;
          }
        }
        throw new ApiError(
          `GET ${path} failed with HTTP ${response.status}.`,
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
            throw new ApiError(`GET ${path} timed out after ${timeoutMs} ms.`, {
              code: 'TIMEOUT',
              cause: error,
            });
          }
          throw error;
        }
        throw new ApiError(`GET ${path} response body could not be read.`, {
          code: 'INVALID_RESPONSE',
          cause: error,
        });
      }

      try {
        return JSON.parse(responseText);
      } catch (error) {
        throw new ApiError(`GET ${path} returned invalid JSON.`, {
          code: 'INVALID_JSON',
          cause: error,
        });
      }
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  return {
    async getHealth(options) {
      return getJson('/api/health', options);
    },

    async getDevices(options) {
      return validateDevices(await getJson('/api/devices', options));
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
export const getDevices = (...args) => apiClient.getDevices(...args);
export const getLatestMeasurements = (...args) =>
  apiClient.getLatestMeasurements(...args);
export const getMeasurements = (...args) => apiClient.getMeasurements(...args);
