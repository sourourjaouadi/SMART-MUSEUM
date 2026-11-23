import { useState } from 'react';

function affordances(td, field) {
  return Object.entries(td[field] ?? {})
    .map(([name, value]) => (value?.unit ? `${name} (${value.unit})` : name))
    .join(', ') || 'None declared';
}

/** Read-only view of a device's W3C WoT Thing Description, loaded on demand. */
export default function ThingDescription({ deviceId, load }) {
  const [td, setTd] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (td) {
      setTd(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      setTd(await load(deviceId));
    } catch (cause) {
      setError(cause?.message || 'The Thing Description could not be loaded.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-td" aria-label={`Thing Description of ${deviceId}`}>
      <button type="button" className="admin-button admin-button--quiet" aria-expanded={Boolean(td)} disabled={busy} onClick={toggle}>
        {busy ? 'Loading…' : td ? 'Hide Thing Description' : 'View Thing Description'}
      </button>
      {error && <p className="admin-inline-error" role="alert">{error}</p>}
      {td && <>
        <dl className="admin-detail-grid">
          <div><dt>Title</dt><dd>{td.title}</dd></div>
          <div><dt>Thing ID</dt><dd>{td.id}</dd></div>
          <div><dt>Properties</dt><dd>{affordances(td, 'properties')}</dd></div>
          <div><dt>Actions</dt><dd>{affordances(td, 'actions')}</dd></div>
          <div><dt>Events</dt><dd>{affordances(td, 'events')}</dd></div>
          <div><dt>Security</dt><dd>{[].concat(td.security ?? 'Not declared').join(', ')}</dd></div>
        </dl>
        <details><summary>JSON-LD document</summary><pre>{JSON.stringify(td, null, 2)}</pre></details>
      </>}
    </section>
  );
}
