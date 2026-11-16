import { useEffect, useMemo, useState } from 'react';
import { createMockDataSource } from './services/adminDataSource.js';
import './admin.css';

const defaultDataSource = createMockDataSource();

const NAV = [
  ['dashboard', 'Overview'],
  ['devices', 'Device inventory'],
  ['approvals', 'Pending approvals'],
  ['zones', 'Zones'],
  ['thresholds', 'Thresholds'],
  ['users', 'Users'],
];
const TITLES = Object.fromEntries(NAV);
const STATUS_FILTERS = ['active', 'pending', 'offline', 'maintenance', 'rejected'];
// Device statuses defined by the middleware contract (no mock-only "maintenance").
const API_STATUS_FILTERS = ['active', 'pending', 'offline', 'rejected'];

function Metric({ label, value, note }) {
  return (
    <article className="admin-metric">
      <span>{label}</span><strong>{value}</strong><small>{note}</small>
    </article>
  );
}

function Status({ value }) {
  return <span className={`admin-status admin-status--${value}`}>{value}</span>;
}

function AdminTable({ columns, rows, empty, emptyHint, caption }) {
  if (!rows.length) {
    return (
      <div className="admin-empty">
        <strong>{empty}</strong><span>{emptyHint}</span>
      </div>
    );
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.deviceId ?? row.id ?? row.zoneId}>
              {columns.map(([key]) => (
                <td key={key}>
                  {key === 'status' || key === 'connectivity'
                    ? row[key] ? <Status value={row[key]} /> : '—'
                    : key === 'action' ? row.action : row[key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCoordinates(location) {
  if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) return null;
  const text = `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
  return Number.isInteger(location.floor) ? `${text} · Floor ${location.floor}` : text;
}

/** Own position = a location not marked as inherited (the API sends locationSource "zone" for inherited ones). */
function ownLocation(device) {
  return device.location && device.locationSource !== 'zone' ? device.location : null;
}

function describeDeviceLocation(device, zones) {
  const own = formatCoordinates(ownLocation(device));
  if (own) return `${own} (own position)`;
  const inherited = formatCoordinates(device.location)
    ?? formatCoordinates(zones.find((zone) => zone.zoneId === device.zoneId)?.location);
  return inherited ? `${inherited} (from zone)` : 'Not set';
}

function LocationForm({ label, initial, initialName, withName = false, busy, onSave, onClear, clearLabel }) {
  const [values, setValues] = useState({
    ...(withName ? { name: initialName ?? '' } : {}),
    latitude: initial?.latitude ?? '',
    longitude: initial?.longitude ?? '',
    floor: initial?.floor ?? '',
  });
  const field = (name, text, inputMode) => (
    <label className="admin-location-form__field">
      <span>{text}</span>
      <input
        name={name}
        inputMode={inputMode}
        value={values[name]}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
      />
    </label>
  );
  return (
    <form
      className="admin-location-form"
      aria-label={label}
      onSubmit={(event) => { event.preventDefault(); onSave(values); }}
    >
      {withName && field('name', 'Zone name', 'text')}
      {field('latitude', 'Latitude', 'decimal')}
      {field('longitude', 'Longitude', 'decimal')}
      {field('floor', 'Floor', 'numeric')}
      <div className="admin-actions">
        {onClear && <button type="button" className="admin-button admin-button--quiet" disabled={busy} onClick={onClear}>{clearLabel}</button>}
        <button type="submit" className="admin-button" disabled={busy}>{busy ? 'Saving…' : 'Save location'}</button>
      </div>
    </form>
  );
}

function NotConnected() {
  return <span className="admin-status admin-status--not-connected">Not connected yet</span>;
}

function ClientAccountForm({ zones, busy, onSubmit }) {
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [zoneIds, setZoneIds] = useState([]);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const toggleZone = (zoneId) => setZoneIds((current) => (current.includes(zoneId)
    ? current.filter((id) => id !== zoneId)
    : [...current, zoneId]));

  return (
    <form
      className="admin-account-form"
      aria-label="Create CLIENT account"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onSubmit({ ...values, zoneIds })) {
          setValues({ name: '', email: '', password: '' });
          setZoneIds([]);
        } else {
          setValues((current) => ({ ...current, password: '' }));
        }
      }}
    >
      <label className="admin-location-form__field"><span>Name</span><input value={values.name} onChange={set('name')} autoComplete="off" /></label>
      <label className="admin-location-form__field"><span>Email</span><input type="email" value={values.email} onChange={set('email')} autoComplete="off" /></label>
      <label className="admin-location-form__field"><span>Initial password (12+ characters)</span><input type="password" value={values.password} onChange={set('password')} autoComplete="new-password" /></label>
      <fieldset className="admin-account-form__zones">
        <legend>Assigned zones</legend>
        {zones.length ? zones.map((zone) => (
          <label key={zone.zoneId}>
            <input type="checkbox" checked={zoneIds.includes(zone.zoneId)} onChange={() => toggleZone(zone.zoneId)} />
            {zone.zoneId}
          </label>
        )) : <span>No zones are known yet.</span>}
      </fieldset>
      <div className="admin-actions"><button type="submit" className="admin-button" disabled={busy}>{busy ? 'Creating…' : 'Create CLIENT account'}</button></div>
    </form>
  );
}

function formatTimestamp(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AdminApp({ dataSource = defaultDataSource, session = null, onLogout } = {}) {
  const [page, setPage] = useState(() => window.location.hash.slice(1) || 'dashboard');
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [editZoneId, setEditZoneId] = useState(null);

  const isDemo = dataSource.mode === 'mock';
  const loadFailure = isDemo ? 'Admin demo data could not be loaded.' : 'Admin data could not be loaded from the API.';
  const savedWhere = isDemo ? 'in the demo. This change was not sent to a server.' : 'on the server.';

  async function loadSnapshot() {
    setState('loading');
    setError('');
    try {
      setData(await dataSource.loadSnapshot());
      setState('ready');
    } catch (err) {
      setError(isDemo ? loadFailure : `${loadFailure} ${err.message ?? ''}`.trim());
      setState('error');
    }
  }

  useEffect(() => {
    let mounted = true;
    dataSource.loadSnapshot()
      .then((snapshot) => {
        if (mounted) {
          setData(snapshot);
          setState('ready');
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(isDemo ? loadFailure : `${loadFailure} ${err.message ?? ''}`.trim());
          setState('error');
        }
      });
    return () => { mounted = false; };
  }, [dataSource]);

  useEffect(() => {
    const sync = () => setPage(window.location.hash.slice(1) || 'dashboard');
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const devices = data?.devices ?? [];
  const zones = data?.zones ?? [];
  const pending = devices.filter((device) => device.status === 'pending');
  const activeZones = zones.filter((zone) => zone.status === 'active');
  const visibleDevices = useMemo(() => devices.filter((device) => {
    const searchable = [device.deviceId, device.type, device.zoneId, device.gatewayId]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    const statusMatches = page === 'approvals'
      || statusFilter === 'all'
      || device.status === statusFilter;
    return searchable.includes(query.trim().toLocaleLowerCase())
      && statusMatches
      && (zoneFilter === 'all' || device.zoneId === zoneFilter);
  }), [devices, page, query, statusFilter, zoneFilter]);

  useEffect(() => {
    if (page !== 'devices' || !visibleDevices.some((device) => device.deviceId === selectedDeviceId)) {
      setSelectedDeviceId(null);
    }
  }, [page, selectedDeviceId, visibleDevices]);

  async function decide(deviceId, decision) {
    if (processingId) return;
    setProcessingId(deviceId);
    setActionError('');
    setNotice('');
    try {
      const patch = await dataSource.decide(data, deviceId, decision);
      setData((current) => ({ ...current, ...patch }));
      setNotice(isDemo
        ? `${deviceId} ${decision} in the demo. This action was not sent to a server.`
        : `${deviceId} ${decision} on the server.`);
    } catch (err) {
      handleActionError(err);
    } finally {
      setProcessingId(null);
    }
  }

  async function saveLocation(kind, id, values) {
    if (processingId) return;
    setProcessingId(`location:${id}`);
    setActionError('');
    setNotice('');
    try {
      if (kind === 'zone') {
        const zone = zones.find((item) => item.zoneId === id);
        const { name = zone?.name ?? '', ...location } = values;
        const patch = await dataSource.saveZone(data, id, { name, location });
        setData((current) => ({ ...current, ...patch }));
        setNotice(`${id} coordinates saved ${savedWhere}`);
      } else {
        const patch = await dataSource.setDeviceLocation(data, id, values);
        setData((current) => ({ ...current, ...patch }));
        setNotice(values
          ? `${id} location assigned ${savedWhere}`
          : `${id} now uses its zone location ${savedWhere}`);
      }
    } catch (err) {
      handleActionError(err);
    } finally {
      setProcessingId(null);
    }
  }

  /**
   * Shows the safe API message. A 404 means the record disappeared on the server, so the
   * snapshot is reloaded in the background. A 401 is handled by the session layer (sign-in screen).
   */
  function handleActionError(err) {
    setActionError(err?.message || 'The action could not be completed.');
    if (err?.status === 404) {
      dataSource.loadSnapshot()
        .then((snapshot) => setData(snapshot))
        .catch(() => { /* The visible message already explains the failure. */ });
    }
  }

  async function provision(fields) {
    if (processingId) return false;
    setProcessingId('provision');
    setActionError('');
    setNotice('');
    try {
      const account = await dataSource.provisionClient(fields);
      const zonesText = account.zoneIds?.length ? account.zoneIds.join(', ') : 'no zones';
      setNotice(isDemo
        ? `CLIENT account ${account.email} validated in the demo (${zonesText}). No account was created.`
        : `CLIENT account ${account.email} created on the server (${zonesText}).`);
      return true;
    } catch (err) {
      handleActionError(err);
      return false;
    } finally {
      setProcessingId(null);
    }
  }

  function resetDeviceFilters() {
    setQuery('');
    setStatusFilter('all');
    setZoneFilter('all');
  }

  function renderContent() {
    if (state === 'loading') {
      return <div className="admin-state" role="status">{isDemo ? 'Loading simulated admin data…' : 'Loading admin data from the API…'}</div>;
    }
    if (state === 'error') {
      return (
        <div className="admin-state admin-state--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadSnapshot}>Retry</button>
        </div>
      );
    }

    if (page === 'dashboard') {
      const online = devices.filter((device) => device.connectivity === 'online').length;
      const offline = devices.filter((device) => device.connectivity === 'offline').length;
      const byStatus = (status) => devices.filter((device) => device.status === status).length;
      return <>
        {isDemo ? <div className="admin-metrics">
          <Metric label="Total registered devices" value={devices.length} note="All inventory records, including pending" />
          <Metric label="Online devices" value={online} note="Explicit online mock connectivity only" />
          <Metric label="Offline devices" value={offline} note="Explicit offline mock connectivity only" />
          <Metric label="Pending devices" value={pending.length} note="Not counted as online or offline" />
          <Metric label="Active zones" value={activeZones.length} note="Zones marked active in mock data" />
        </div> : <div className="admin-metrics">
          <Metric label="Total registered devices" value={devices.length} note="All devices known to the middleware" />
          <Metric label="Active devices" value={byStatus('active')} note="Approved; their measurements are accepted" />
          <Metric label="Pending devices" value={pending.length} note="Discovered, waiting for an ADMIN decision" />
          <Metric label="Offline or rejected" value={byStatus('offline') + byStatus('rejected')} note={`${byStatus('offline')} offline · ${byStatus('rejected')} rejected`} />
          <Metric label="Registered zones" value={zones.filter((zone) => !zone.unregistered).length} note="Zones with a record in the middleware" />
        </div>}
        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div><p className="admin-eyebrow">Review queue</p><h2>Devices awaiting approval</h2></div>
            <a className="admin-text-link" href="#approvals">View approvals →</a>
          </div>
          {pending.length ? pending.map((device) => (
            <ApprovalRow key={device.deviceId} device={device} processingId={processingId} onDecision={decide} />
          )) : <div className="admin-empty"><strong>No pending devices</strong><span>{isDemo ? 'New demo devices will appear here.' : 'Devices announced through discovery will appear here.'}</span></div>}
          {actionError && <p className="admin-inline-error" role="alert">{actionError}</p>}
        </section>
        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div><p className="admin-eyebrow">Inventory preview</p><h2>Device status</h2></div>
            <a className="admin-text-link" href="#devices">Open inventory →</a>
          </div>
          <AdminTable columns={deviceColumns} rows={devices.slice(0, 4)} caption="Device inventory preview" empty="No devices in the inventory" emptyHint="The demo inventory is empty." />
        </section>
      </>;
    }

    if (page === 'devices' || page === 'approvals') {
      const isApprovals = page === 'approvals';
      const rows = isApprovals ? visibleDevices.filter((device) => device.status === 'pending') : visibleDevices;
      const inventoryRows = rows.map((device) => ({
        ...device,
        action: <button
          type="button"
          className="admin-button admin-button--quiet"
          aria-expanded={selectedDeviceId === device.deviceId}
          aria-controls={`device-details-${device.deviceId}`}
          onClick={() => setSelectedDeviceId((current) => current === device.deviceId ? null : device.deviceId)}
        >{selectedDeviceId === device.deviceId ? 'Hide details' : 'View details'}</button>,
      }));

      return <section className="admin-panel">
        <div className="admin-panel__heading">
          <div><p className="admin-eyebrow">{isApprovals ? 'Trust workflow' : 'Connected hardware'}</p><h2>{isApprovals ? 'Review discovered devices' : 'All registered devices'}</h2></div>
        </div>
        <div className="admin-toolbar">
          <label className="admin-search"><span className="sr-only">Search devices</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, type, zone…" /></label>
          <label className="admin-filter"><span className="sr-only">Filter status</span><select aria-label="Filter by status" value={isApprovals ? 'pending' : statusFilter} disabled={isApprovals} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{(isDemo ? STATUS_FILTERS : API_STATUS_FILTERS).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <label className="admin-filter"><span className="sr-only">Filter zone</span><select aria-label="Filter by zone" value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}><option value="all">All zones</option>{zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.zoneId}</option>)}</select></label>
          <button type="button" className="admin-button admin-button--quiet" onClick={resetDeviceFilters} disabled={!query && statusFilter === 'all' && zoneFilter === 'all'}>Reset filters</button>
        </div>
        {isApprovals ? rows.length ? rows.map((device) => (
          <ApprovalRow key={device.deviceId} device={device} processingId={processingId} onDecision={decide} />
        )) : <div className="admin-empty"><strong>No pending approvals match these filters</strong><span>{isDemo ? 'Reset filters or wait for another demo device.' : 'Reset filters or wait for another discovered device.'}</span></div> : (
          <>
            <AdminTable columns={isDemo ? inventoryColumns : apiInventoryColumns} rows={inventoryRows} caption="Device inventory" empty="No matching devices" emptyHint="Change or reset the search and filters." />
            {selectedDeviceId && (() => {
              const selected = devices.find((device) => device.deviceId === selectedDeviceId);
              if (!selected) return null;
              return <section className="admin-device-details" id={`device-details-${selected.deviceId}`} aria-labelledby="device-details-title">
                <div className="admin-panel__heading"><div><p className="admin-eyebrow">Selected inventory record</p><h3 id="device-details-title">{selected.deviceId}</h3></div><button type="button" className="admin-button admin-button--quiet" onClick={() => setSelectedDeviceId(null)}>Close details</button></div>
                <dl className="admin-detail-grid">
                  <Detail label="Device ID" value={selected.deviceId} />
                  <Detail label="Device type" value={selected.type} />
                  <Detail label="Zone" value={selected.zoneId} />
                  <Detail label="Location (WGS84)" value={describeDeviceLocation(selected, zones)} />
                  <Detail label="Gateway ID" value={selected.gatewayId} />
                  <Detail label="Status" value={selected.status} />
                  {isDemo
                    ? <Detail label="Connectivity (mock)" value={selected.connectivity ?? 'Not specified'} />
                    : <Detail label="Thing Description" value={selected.thingId ?? 'Not registered'} />}
                  <Detail label="Last seen" value={formatTimestamp(selected.lastSeenAt)} />
                  <Detail label="Measurements" value={isDemo
                    ? 'No measurement records are included in this admin mock dataset.'
                    : 'Measurements are shown in the Client PWA for the zones of a CLIENT account.'} />
                </dl>
                <LocationForm
                  key={`${selected.deviceId}-${JSON.stringify(ownLocation(selected))}`}
                  label={`Assign location for ${selected.deviceId}`}
                  initial={ownLocation(selected)}
                  busy={processingId === `location:${selected.deviceId}`}
                  onSave={(values) => saveLocation('device', selected.deviceId, values)}
                  onClear={ownLocation(selected) ? () => saveLocation('device', selected.deviceId, null) : undefined}
                  clearLabel="Use zone location"
                />
              </section>;
            })()}
          </>
        )}
        {actionError && <p className="admin-inline-error" role="alert">{actionError}</p>}
      </section>;
    }

    if (page === 'zones') {
      const zoneRows = zones.map((zone) => ({
        ...zone,
        name: zone.unregistered ? 'No zone record yet' : zone.name,
        coordinates: formatCoordinates(zone.location) ?? 'Not set',
        devices: devices.filter((device) => device.zoneId === zone.zoneId).length,
      }));
      const editedZone = zones.find((zone) => zone.zoneId === editZoneId) ?? zones[0];
      return <section className="admin-panel">
        <div className="admin-panel__heading"><div><p className="admin-eyebrow">Museum layout</p><h2>Zone management</h2></div></div>
        <AdminTable columns={isDemo ? zoneColumns : apiZoneColumns} rows={zoneRows} caption="Museum zone inventory" empty="No zones configured" emptyHint={isDemo ? 'No zones are present in the mock data.' : 'No zone records or device zones exist yet.'} />
        {editedZone && <div className="admin-device-details">
          <div className="admin-panel__heading"><div><p className="admin-eyebrow">Geolocation</p><h3>{editedZone.unregistered ? 'Create zone record' : 'Edit zone coordinates'}</h3></div>
            <label className="admin-filter"><span className="sr-only">Zone to edit</span><select aria-label="Zone to edit" value={editedZone.zoneId} onChange={(event) => setEditZoneId(event.target.value)}>{zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.unregistered ? `${zone.zoneId} (no record)` : zone.zoneId}</option>)}</select></label>
          </div>
          <LocationForm
            key={`${editedZone.zoneId}-${editedZone.name ?? ''}-${JSON.stringify(editedZone.location ?? null)}`}
            label={`Coordinates for ${editedZone.zoneId}`}
            withName
            initialName={editedZone.name}
            initial={editedZone.location}
            busy={processingId === `location:${editedZone.zoneId}`}
            onSave={(values) => saveLocation('zone', editedZone.zoneId, values)}
          />
        </div>}
        {actionError && <p className="admin-inline-error" role="alert">{actionError}</p>}
      </section>;
    }
    if (page === 'thresholds') {
      return <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-eyebrow">Conservation limits</p><h2>Threshold management</h2></div><NotConnected /></div><p className="admin-copy">These illustrative limits are read-only and are not connected to alerts or measurement evaluation. The middleware has no thresholds endpoint yet.</p><AdminTable columns={thresholdColumns} rows={data.thresholds} caption="Illustrative environmental thresholds" empty="No thresholds configured" emptyHint="No threshold records are present in the mock data." /></section>;
    }
    if (page === 'users') {
      return <>
        <section className="admin-panel">
          <div className="admin-panel__heading"><div><p className="admin-eyebrow">Account provisioning</p><h2>Create a CLIENT account</h2></div></div>
          <p className="admin-copy">{isDemo
            ? 'Demo mode: the account is validated but not created on any server.'
            : 'Creates an active CLIENT account through the middleware. The account can only read the zones selected here.'}</p>
          <ClientAccountForm
            zones={zones}
            busy={processingId === 'provision'}
            onSubmit={provision}
          />
          {actionError && page === 'users' && <p className="admin-inline-error" role="alert">{actionError}</p>}
        </section>
        <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-eyebrow">Workspace directory</p><h2>User management</h2></div><NotConnected /></div>
          {isDemo
            ? <><p className="admin-copy">Sample entries only. These role labels do not create accounts or grant access.</p><AdminTable columns={userColumns} rows={data.users} caption="Illustrative user directory" empty="No users listed" emptyHint="No user records are present in the mock data." /></>
            : <div className="admin-empty"><strong>The user list is not connected yet</strong><span>The middleware has no endpoint that lists accounts. Created accounts are confirmed above.</span></div>}
        </section>
      </>;
    }
    return <section className="admin-panel"><h2>Page not found</h2><a href="#dashboard">Return to overview</a></section>;
  }

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="#dashboard"><img src="/icons/museum-mark.svg" alt="" /><span><strong>Smart Museum</strong><small>Administration</small></span></a>
      <nav aria-label="Admin navigation">{NAV.map(([id, label], index) => <a className={page === id ? 'is-active' : ''} aria-current={page === id ? 'page' : undefined} href={`#${id}`} key={id}><span>{String(index + 1).padStart(2, '0')}</span>{label}</a>)}</nav>
      <div className="admin-sidebar__foot"><span className="admin-demo-dot" /> {isDemo ? 'Mock workspace only' : 'Connected to the middleware API'}</div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><p>Smart Museum <span>/</span> Admin</p><strong>{TITLES[page] ?? 'Administration'}</strong></div><div className="admin-topbar__account">
        <span className="admin-app-label">{session?.user ? `Signed in as ${session.user.name} (ADMIN)` : 'Independent mock application'}</span>
        {onLogout && <button type="button" className="admin-button admin-button--quiet" onClick={onLogout}>{session ? 'Sign out' : 'Leave demo'}</button>}
      </div></header>
      <div className="admin-content">
        {isDemo
          ? <div className="admin-banner" role="note"><span aria-hidden="true">i</span><div><strong>Simulated admin workspace</strong><p>All records and actions are mock data. Approval decisions change this page’s session state only; nothing is sent to a backend.</p></div></div>
          : <div className="admin-banner admin-banner--live" role="note"><span aria-hidden="true">i</span><div><strong>Live admin workspace</strong><p>Devices, approvals, zones and locations are read from and saved to the middleware API. Thresholds and the user list are not connected yet.</p></div></div>}
        {notice && <div className="admin-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
        {renderContent()}
        <footer className="admin-footer">Smart Museum · Admin <span>{isDemo ? 'Mock data only' : 'Live API data'}</span></footer>
      </div>
    </main>
  </div>;
}

function ApprovalRow({ device, processingId, onDecision }) {
  const processing = processingId === device.deviceId;
  return <div className="admin-approval-row">
    <div><strong>{device.deviceId}</strong><span>{device.type} · {device.zoneId} · {device.gatewayId}</span><small>Discovered {formatTimestamp(device.lastSeenAt)}. Decision is simulated.</small></div>
    <div className="admin-actions">
      <button type="button" className="admin-button admin-button--quiet" disabled={Boolean(processingId)} onClick={() => onDecision(device.deviceId, 'rejected')}>{processing ? 'Saving…' : 'Reject'}</button>
      <button type="button" className="admin-button" disabled={Boolean(processingId)} onClick={() => onDecision(device.deviceId, 'active')}>{processing ? 'Saving…' : 'Approve'}</button>
    </div>
  </div>;
}

function Detail({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

const deviceColumns = [['deviceId', 'Device ID'], ['type', 'Type'], ['zoneId', 'Zone'], ['gatewayId', 'Gateway'], ['status', 'Status'], ['lastSeenAt', 'Last seen']];
const inventoryColumns = [['deviceId', 'Device ID'], ['type', 'Type'], ['zoneId', 'Zone'], ['gatewayId', 'Gateway'], ['status', 'Status'], ['connectivity', 'Connectivity'], ['lastSeenAt', 'Last seen'], ['action', 'Details']];
const apiInventoryColumns = inventoryColumns.filter(([key]) => key !== 'connectivity');
const zoneColumns = [['zoneId', 'Zone ID'], ['name', 'Name'], ['floor', 'Floor'], ['coordinates', 'Coordinates (WGS84)'], ['devices', 'Devices'], ['status', 'Status']];
// API zones have no floor label or status: the floor number is part of the coordinates.
const apiZoneColumns = [['zoneId', 'Zone ID'], ['name', 'Name'], ['coordinates', 'Coordinates (WGS84)'], ['devices', 'Devices']];
const thresholdColumns = [['label', 'Measurement'], ['property', 'Property'], ['min', 'Minimum'], ['max', 'Maximum'], ['unit', 'Unit']];
const userColumns = [['name', 'Name'], ['email', 'Email'], ['accessRole', 'Application role'], ['jobTitle', 'Job title'], ['status', 'Entry status']];
