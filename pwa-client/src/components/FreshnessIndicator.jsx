const FRESHNESS_LABELS = {
  'up-to-date': 'Up to date',
  stale: 'Stale',
  unavailable: 'Unavailable',
};

export default function FreshnessIndicator({
  freshness = 'unavailable',
  observedAt = 'time unavailable',
  isDemo,
  refreshIntervalMs,
}) {
  const label = FRESHNESS_LABELS[freshness] ?? FRESHNESS_LABELS.unavailable;

  return (
    <section
      className={`freshness-indicator freshness-indicator--${freshness}`}
      aria-label="Measurement freshness"
      role="status"
    >
      <span className="freshness-indicator__icon" aria-hidden="true">
        {freshness === 'up-to-date' ? '✓' : freshness === 'stale' ? '!' : '—'}
      </span>
      <div>
        <p className="eyebrow">Data freshness</p>
        <strong>{label}</strong>
        <p>
          {freshness === 'unavailable'
            ? 'No valid measurement timestamp is available.'
            : `Latest observed at ${observedAt}.`}
          {isDemo
            ? ' Demonstration data; not a live sensor status.'
            : ` Latest data checked every ${refreshIntervalMs / 1000} seconds.`}
        </p>
      </div>
    </section>
  );
}
