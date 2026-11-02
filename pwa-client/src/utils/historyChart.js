const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const CHART_PADDING = { top: 20, right: 24, bottom: 20, left: 24 };

export function getHistoryChartPoints(measurements) {
  if (!Array.isArray(measurements) || measurements.length === 0) {
    return [];
  }

  const readings = measurements
    .map((measurement) => ({
      measurement,
      timestamp: Date.parse(measurement?.observedAt),
      value: measurement?.value,
    }))
    .filter(
      ({ timestamp, value }) =>
        Number.isFinite(timestamp) && Number.isFinite(value),
    )
    .sort((left, right) => left.timestamp - right.timestamp);

  if (readings.length === 0) {
    return [];
  }

  const minTime = readings[0].timestamp;
  const maxTime = readings.at(-1).timestamp;
  const values = readings.map(({ value }) => value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || Math.max(Math.abs(minValue) * 0.02, 1);
  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  return readings.map(({ measurement, timestamp, value }, index) => ({
    key: measurement.measurementId ?? `${timestamp}-${index}`,
    x:
      minTime === maxTime
        ? CHART_WIDTH / 2
        : CHART_PADDING.left + ((timestamp - minTime) / (maxTime - minTime)) * plotWidth,
    y:
      CHART_PADDING.top +
      ((maxValue + valueRange * 0.05 - value) / (valueRange * 1.1)) * plotHeight,
    value,
    observedAt: measurement.observedAt,
  }));
}

export function getHistoryChartGeometry() {
  return {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    padding: CHART_PADDING,
  };
}
