export default function AlertsPlaceholder() {
  return (
    <section className="panel alerts-panel" id="alerts" aria-labelledby="alerts-title">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">Monitoring</p>
          <h2 id="alerts-title">Alerts</h2>
        </div>
        <span className="alerts-panel__tag">Integration pending</span>
      </div>
      <div className="alerts-panel__empty">
        <span className="alerts-panel__icon" aria-hidden="true">!</span>
        <div>
          <strong>Alert feed is not connected yet</strong>
          <p>
            This placeholder does not evaluate thresholds or request alert data.
            Backend alert integration can be added in a later task.
          </p>
        </div>
      </div>
    </section>
  );
}
