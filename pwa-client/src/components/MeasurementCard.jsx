import { getMeasurementMetadata } from '../utils/measurementData.js';

export default function MeasurementCard({
  definition,
  measurement,
  isDemo,
  freshness = 'unavailable',
}) {
  const value = Number.isFinite(measurement.value)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
        measurement.value,
      )
    : 'Unavailable';
  const metadata = getMeasurementMetadata(measurement, { isMock: isDemo });
  const sourceClass =
    measurement.source === 'real' || measurement.source === 'simulated'
      ? measurement.source
      : 'unknown';
  const sourceLabel =
    measurement.source === 'simulated'
      ? 'Simulated'
      : measurement.source === 'real'
        ? 'Real source'
        : measurement.source || 'Source unavailable';

  return (
    <article
      className={`measurement-card measurement-card--${sourceClass} measurement-card--freshness-${freshness}`}
    >
      <div className="measurement-card__topline">
        <span className="measurement-card__symbol" aria-hidden="true">
          {definition.symbol}
        </span>
        <span
          className={`measurement-card__source-badge measurement-card__source-badge--${sourceClass}`}
        >
          {sourceLabel}
        </span>
      </div>
      <h2 className="measurement-card__label">{definition.label}</h2>
      <p className="measurement-card__value">
        <span>{value}</span>
        {(measurement.unit || definition.unit) && (
          <span className="measurement-card__unit">
            {measurement.unit || definition.unit}
          </span>
        )}
      </p>
      <p className={`measurement-card__freshness measurement-card__freshness--${freshness}`}>
        {freshness === 'fresh'
          ? 'Up to date'
          : freshness === 'stale'
            ? 'Stale · last known reading'
            : 'Unavailable'}
      </p>
      <dl className="measurement-card__metadata">
        {metadata.map(([label, detail]) => (
          <div className="measurement-card__metadata-row" key={label}>
            <dt>{label}</dt>
            <dd>{isDemo && label === 'Source' ? `${detail} · mock` : detail}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
