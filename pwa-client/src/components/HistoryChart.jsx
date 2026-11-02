import { getHistoryChartGeometry, getHistoryChartPoints } from '../utils/historyChart.js';

export default function HistoryChart({ measurements, definition }) {
  const points = getHistoryChartPoints(measurements);
  const { width, height, padding } = getHistoryChartGeometry();
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <figure className="history-chart">
      {points.length === 0 ? (
        <div className="history-chart__empty">
          No valid timestamps and values are available to plot.
        </div>
      ) : (
        <svg
          className="history-chart__svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby="history-chart-title history-chart-description"
        >
          <title id="history-chart-title">
            {definition.label} measurement history
          </title>
          <desc id="history-chart-description">
            {points.length} measurement{points.length === 1 ? '' : 's'} plotted
            in observedAt order. Exact values and timestamps are available in
            the accompanying table.
          </desc>
          {[0, 0.5, 1].map((fraction) => {
            const y = padding.top + fraction * (height - padding.top - padding.bottom);
            return (
              <line
                className="history-chart__gridline"
                key={fraction}
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
            );
          })}
          {points.length > 1 && <path className="history-chart__line" d={path} />}
          {points.map((point) => (
            <circle
              className="history-chart__point"
              key={point.key}
              cx={point.x}
              cy={point.y}
              r="6"
            >
              <title>
                {point.value} {definition.unit ?? ''} ·{' '}
                {new Date(point.observedAt).toLocaleString()}
              </title>
            </circle>
          ))}
        </svg>
      )}
      <figcaption className="history-chart__caption">
        {definition.label}{definition.unit ? ` (${definition.unit})` : ''} · ordered by observedAt
      </figcaption>
    </figure>
  );
}
