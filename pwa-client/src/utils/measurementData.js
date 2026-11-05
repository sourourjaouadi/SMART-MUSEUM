import { formatObservedAt } from './measurements.js';

const KNOWN_PROPERTIES = {
  temperature: { label: 'Temperature', unit: '°C', symbol: '°' },
  humidity: { label: 'Humidity', unit: '%', symbol: 'RH' },
  pressure: { label: 'Pressure', unit: 'hPa', symbol: 'P' },
  illuminance: { label: 'Illuminance', unit: 'lx', symbol: 'LUX' },
};

export function getMeasurementDefinition(property, unit) {
  const knownDefinition = KNOWN_PROPERTIES[property];
  if (knownDefinition) {
    return {
      property,
      ...knownDefinition,
      unit: typeof unit === 'string' && unit.length > 0 ? unit : knownDefinition.unit,
    };
  }

  return {
    property,
    label: property || 'Unknown property',
    unit: typeof unit === 'string' && unit.length > 0 ? unit : null,
    symbol: '?',
  };
}

export function groupMeasurementsByProperty(measurements) {
  if (!Array.isArray(measurements)) {
    return [];
  }

  const groups = new Map();
  for (const measurement of measurements) {
    if (!measurement || typeof measurement.property !== 'string' || !measurement.property) {
      continue;
    }

    const group = groups.get(measurement.property) ?? {
      property: measurement.property,
      measurements: [],
    };
    group.measurements.push(measurement);
    groups.set(measurement.property, group);
  }

  return Array.from(groups.values(), (group) => ({
    ...group,
    definition: getMeasurementDefinition(group.property, group.measurements[0].unit),
  }));
}

export function getMeasurementMetadata(measurement, { isMock = false } = {}) {
  if (!measurement || typeof measurement !== 'object') {
    return [];
  }

  const metadata = [
    ['Timestamp', formatObservedAt(measurement.observedAt)],
    ['Device', measurement.deviceId],
    ['Zone', measurement.zoneId],
    ['Gateway ID', measurement.gatewayId],
    ['Source', measurement.source],
    ['Quality', measurement.quality],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  if (isMock) {
    metadata.push(['Data mode', 'Demonstration data']);
  }

  return metadata;
}
