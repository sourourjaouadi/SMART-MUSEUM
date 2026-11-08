import { useEffect, useMemo, useState } from 'react';
import { getAdminSnapshot, setDeviceDecision } from './services/adminService.js';
import './admin.css';

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

function formatTimestamp(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AdminApp() {
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

  async function loadSnapshot() {
    setState('loading');
    setError('');
    try {
      setData(await getAdminSnapshot());
      setState('ready');
    } catch {
      setError('Admin demo data could not be loaded.');
      setState('error');
    }
  }

  useEffect(() => {
    let mounted = true;
    getAdminSnapshot()
      .then((snapshot) => {
        if (mounted) {
          setData(snapshot);
          setState('ready');
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Admin demo data could not be loaded.');
          setState('error');
        }
      });
    return () => { mounted = false; };
  }, []);

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
      const updatedDevices = await setDeviceDecision(devices, deviceId, decision);
      setData((current) => ({ ...current, devices: updatedDevices }));
      setNotice(`${deviceId} ${decision} in the demo. This action was not sent to a server.`);
    } catch (err) {
      setActionError(err.message);
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
      return <div className="admin-state" role="status">Loading simulated admin data…</div>;
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
      return <>
        <div className="admin-metrics">
          <Metric label="Total registered devices" value={devices.length} note="All inventory records, including pending" />
          <Metric label="Online devices" value={online} note="Explicit online mock connectivity only" />
          <Metric label="Offline devices" value={offline} note="Explicit offline mock connectivity only" />
          <Metric label="Pending devices" value={pending.length} note="Not counted as online or offline" />
          <Metric label="Active zones" value={activeZones.length} note="Zones marked active in mock data" />
        </div>
        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div><p className="admin-eyebrow">Review queue</p><h2>Devices awaiting approval</h2></div>
            <a className="admin-text-link" href="#approvals">View approvals →</a>
          </div>
          {pending.length ? pending.map((device) => (
            <ApprovalRow key={device.deviceId} device={device} processingId={processingId} onDecision={decide} />
          )) : <div className="admin-empty"><strong>No pending devices</strong><span>New demo devices will appear here.</span></div>}
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
          <label className="admin-filter"><span className="sr-only">Filter status</span><select aria-label="Filter by status" value={isApprovals ? 'pending' : statusFilter} disabled={isApprovals} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{STATUS_FILTERS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <label className="admin-filter"><span className="sr-only">Filter zone</span><select aria-label="Filter by zone" value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}><option value="all">All zones</option>{zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.zoneId}</option>)}</select></label>
          <button type="button" className="admin-button admin-button--quiet" onClick={resetDeviceFilters} disabled={!query && statusFilter === 'all' && zoneFilter === 'all'}>Reset filters</button>
        </div>
        {isApprovals ? rows.length ? rows.map((device) => (
          <ApprovalRow key={device.deviceId} device={device} processingId={processingId} onDecision={decide} />
        )) : <div className="admin-empty"><strong>No pending approvals match these filters</strong><span>Reset filters or wait for another demo device.</span></div> : (
          <>
            <AdminTable columns={inventoryColumns} rows={inventoryRows} caption="Device inventory" empty="No matching devices" emptyHint="Change or reset the search and filters." />
            {selectedDeviceId && (() => {
              const selected = devices.find((device) => device.deviceId === selectedDeviceId);
              if (!selected) return null;
              return <section className="admin-device-details" id={`device-details-${selected.deviceId}`} aria-labelledby="device-details-title">
                <div className="admin-panel__heading"><div><p className="admin-eyebrow">Selected inventory record</p><h3 id="device-details-title">{selected.deviceId}</h3></div><button type="button" className="admin-button admin-button--quiet" onClick={() => setSelectedDeviceId(null)}>Close details</button></div>
                <dl className="admin-detail-grid">
                  <Detail label="Device ID" value={selected.deviceId} />
                  <Detail label="Device type" value={selected.type} />
                  <Detail label="Zone" value={selected.zoneId} />
                  <Detail label="Gateway ID" value={selected.gatewayId} />
                  <Detail label="Status" value={selected.status} />
                  <Detail label="Connectivity (mock)" value={selected.connectivity ?? 'Not specified'} />
                  <Detail label="Last seen" value={formatTimestamp(selected.lastSeenAt)} />
                  <Detail label="Measurements" value="No measurement records are included in this admin mock dataset." />
                </dl>
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
        devices: devices.filter((device) => device.zoneId === zone.zoneId).length,
      }));
      return <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-eyebrow">Museum layout</p><h2>Zone management</h2></div></div><AdminTable columns={zoneColumns} rows={zoneRows} caption="Museum zone inventory" empty="No zones configured" emptyHint="No zones are present in the mock data." /></section>;
    }
    if (page === 'thresholds') {
      return <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-eyebrow">Conservation limits</p><h2>Threshold management</h2></div></div><p className="admin-copy">These illustrative limits are read-only and are not connected to alerts or measurement evaluation.</p><AdminTable columns={thresholdColumns} rows={data.thresholds} caption="Illustrative environmental thresholds" empty="No thresholds configured" emptyHint="No threshold records are present in the mock data." /></section>;
    }
    if (page === 'users') {
      return <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-eyebrow">Workspace directory</p><h2>User management</h2></div></div><p className="admin-copy">Sample entries only. These role labels do not create accounts or grant access.</p><AdminTable columns={userColumns} rows={data.users} caption="Illustrative user directory" empty="No users listed" emptyHint="No user records are present in the mock data." /></section>;
    }
    return <section className="admin-panel"><h2>Page not found</h2><a href="#dashboard">Return to overview</a></section>;
  }

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="#dashboard"><img src="/icons/museum-mark.svg" alt="" /><span><strong>Smart Museum</strong><small>Administration</small></span></a>
      <nav aria-label="Admin navigation">{NAV.map(([id, label], index) => <a className={page === id ? 'is-active' : ''} aria-current={page === id ? 'page' : undefined} href={`#${id}`} key={id}><span>{String(index + 1).padStart(2, '0')}</span>{label}</a>)}</nav>
      <div className="admin-sidebar__foot"><span className="admin-demo-dot" /> Mock workspace only</div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><p>Smart Museum <span>/</span> Admin</p><strong>{TITLES[page] ?? 'Administration'}</strong></div><span className="admin-app-label">Independent mock application</span></header>
      <div className="admin-content">
        <div className="admin-banner" role="note"><span aria-hidden="true">i</span><div><strong>Simulated admin workspace</strong><p>All records and actions are mock data. Approval decisions change this page’s session state only; nothing is sent to a backend.</p></div></div>
        {notice && <div className="admin-notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
        {renderContent()}
        <footer className="admin-footer">Smart Museum · Admin prototype <span>Mock data only</span></footer>
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
const zoneColumns = [['zoneId', 'Zone ID'], ['name', 'Name'], ['floor', 'Location'], ['devices', 'Devices'], ['status', 'Status']];
const thresholdColumns = [['label', 'Measurement'], ['property', 'Property'], ['min', 'Minimum'], ['max', 'Maximum'], ['unit', 'Unit']];
const userColumns = [['name', 'Name'], ['email', 'Email'], ['accessRole', 'Application role'], ['jobTitle', 'Job title'], ['status', 'Entry status']];
