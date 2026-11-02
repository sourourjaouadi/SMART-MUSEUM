export const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;
export const DEFAULT_REFRESH_INTERVAL_MS = 15 * 1000;
export const MIN_REFRESH_INTERVAL_MS = 10 * 1000;
export const MAX_REFRESH_INTERVAL_MS = 30 * 1000;

export function getStaleAfterMs(configuredValue) {
  if (configuredValue === undefined || configuredValue === null) {
    return DEFAULT_STALE_AFTER_MS;
  }

  if (typeof configuredValue !== 'string' || configuredValue.trim() === '') {
    throw new Error('VITE_STALE_AFTER_MS must be a positive number of milliseconds.');
  }

  const threshold = Number(configuredValue);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new Error('VITE_STALE_AFTER_MS must be a positive number of milliseconds.');
  }

  return threshold;
}

export function getRefreshIntervalMs(configuredValue) {
  if (configuredValue === undefined || configuredValue === null) {
    return DEFAULT_REFRESH_INTERVAL_MS;
  }

  if (typeof configuredValue !== 'string' || configuredValue.trim() === '') {
    throw new Error(
      'VITE_REFRESH_INTERVAL_MS must be between 10000 and 30000 milliseconds.',
    );
  }

  const interval = Number(configuredValue);
  if (
    !Number.isInteger(interval) ||
    interval < MIN_REFRESH_INTERVAL_MS ||
    interval > MAX_REFRESH_INTERVAL_MS
  ) {
    throw new Error(
      'VITE_REFRESH_INTERVAL_MS must be between 10000 and 30000 milliseconds.',
    );
  }

  return interval;
}

export function getFreshnessState(measurements, staleAfterMs, now = Date.now()) {
  if (!Array.isArray(measurements) || measurements.length === 0) {
    return 'unavailable';
  }

  const ages = measurements.map((measurement) => {
    if (!measurement || typeof measurement.observedAt !== 'string') {
      return null;
    }

    const observedAt = Date.parse(measurement.observedAt);
    if (!Number.isFinite(observedAt) || observedAt > now) {
      return null;
    }
    return now - observedAt;
  });

  if (ages.some((age) => age === null)) {
    return 'unavailable';
  }

  return ages.some((age) => age > staleAfterMs) ? 'stale' : 'fresh';
}

export function getFreshnessSummary(measurements, staleAfterMs, now = Date.now()) {
  const freshness = getFreshnessState(measurements, staleAfterMs, now);
  if (freshness === 'unavailable') {
    return 'unavailable';
  }
  return freshness === 'stale' ? 'stale' : 'up-to-date';
}

export function formatObservedAt(observedAt) {
  if (!observedAt || !Number.isFinite(Date.parse(observedAt))) {
    return 'time unavailable';
  }
  return new Date(observedAt).toLocaleString();
}
