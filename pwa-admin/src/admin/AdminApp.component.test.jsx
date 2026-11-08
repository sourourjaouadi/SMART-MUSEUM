import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminApp from './AdminApp.jsx';
import { ADMIN_MOCK_DATA } from './data/mockData.js';
import { getAdminSnapshot } from './services/adminService.js';

vi.mock('./services/adminService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminSnapshot: vi.fn(),
}));

function mockSnapshot(overrides = {}) {
  return { ...structuredClone(ADMIN_MOCK_DATA), ...overrides };
}

async function openPage(label) {
  fireEvent.click(screen.getByRole('link', { name: new RegExp(label) }));
  await waitFor(() => expect(screen.getByRole('link', { name: new RegExp(label) }).getAttribute('aria-current')).toBe('page'));
}

beforeEach(() => {
  getAdminSnapshot.mockResolvedValue(mockSnapshot());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.location.hash = '';
});

describe('AdminApp', () => {
  it('calculates dashboard KPIs from the explicit mock fields', async () => {
    render(<AdminApp />);
    await screen.findByText('Simulated admin workspace');
    const valueFor = (label) => screen.getByText(label).closest('article').querySelector('strong').textContent;
    expect(valueFor('Total registered devices')).toBe('5');
    expect(valueFor('Online devices')).toBe('2');
    expect(valueFor('Offline devices')).toBe('1');
    expect(valueFor('Pending devices')).toBe('1');
    expect(valueFor('Active zones')).toBe('3');
  });

  it('applies text, status, and zone filters together and resets them', async () => {
    render(<AdminApp />);
    await screen.findByText('Simulated admin workspace');
    await openPage('Device inventory');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search devices' }), { target: { value: 'bme280' } });
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'active' } });
    fireEvent.change(screen.getByLabelText('Filter by zone'), { target: { value: 'salle-01' } });
    expect(screen.getByRole('row', { name: /bme280-01/ })).toBeTruthy();
    expect(screen.queryByRole('row', { name: /sim-bme280-02/ })).toBeNull();
    expect(screen.queryByRole('row', { name: /bme280-pending-03/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByRole('row', { name: /sim-bme280-02/ })).toBeTruthy();
    expect(screen.getByRole('row', { name: /bme280-pending-03/ })).toBeTruthy();
  });

  it('shows device details and states that this fixture has no measurements', async () => {
    render(<AdminApp />);
    await screen.findByText('Simulated admin workspace');
    await openPage('Device inventory');
    const row = screen.getByRole('row', { name: /bme280-01/ });
    fireEvent.click(within(row).getByRole('button', { name: 'View details' }));

    const details = screen.getByRole('region', { name: 'bme280-01' });
    expect(within(details).getByText('BME280')).toBeTruthy();
    expect(within(details).getByText('salle-01')).toBeTruthy();
    expect(within(details).getByText('gw-01')).toBeTruthy();
    expect(within(details).getByText('No measurement records are included in this admin mock dataset.')).toBeTruthy();
  });

  it('shows status and zone counts derived from the device records', async () => {
    render(<AdminApp />);
    await screen.findByText('Simulated admin workspace');
    await openPage('Zones');
    const table = screen.getByRole('table', { name: 'Museum zone inventory' });
    expect(within(screen.getByRole('row', { name: /salle-01/ })).getByText('2')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /salle-02/ })).getByText('1')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /salle-03/ })).getByText('2')).toBeTruthy();
    expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(5);
  });

  it.each([
    ['Approve', 'active'],
    ['Reject', 'rejected'],
  ])('applies simulated %s and reflects the result in inventory', async (action, status) => {
    render(<AdminApp />);
    await screen.findByText('Simulated admin workspace');
    await openPage('Pending approvals');
    const actionButton = screen.getByRole('button', { name: action });
    fireEvent.click(actionButton);
    expect(actionButton.disabled).toBe(true);
    expect(await screen.findByText(new RegExp(`bme280-pending-03 ${status} in the demo`))).toBeTruthy();
    expect(screen.queryByText('bme280-pending-03')).toBeNull();

    await openPage('Device inventory');
    const row = screen.getByRole('row', { name: /bme280-pending-03/ });
    expect(within(row).getByText(status)).toBeTruthy();
  });

  it('recovers from an initial load error and a failed retry', async () => {
    let rejectRetry;
    getAdminSnapshot
      .mockRejectedValueOnce(new Error('initial mock failure'))
      .mockImplementationOnce(() => new Promise((resolve, reject) => { rejectRetry = reject; }))
      .mockResolvedValueOnce(mockSnapshot());

    render(<AdminApp />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be loaded/);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByRole('status').textContent).toMatch(/Loading simulated admin data/);
    await act(async () => rejectRetry(new Error('retry failed')));
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be loaded/);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Total registered devices')).toBeTruthy();
  });

  it('uses page-specific empty states for zones and users', async () => {
    getAdminSnapshot.mockResolvedValue(mockSnapshot({ zones: [], users: [] }));
    render(<AdminApp />);
    await screen.findByText('Simulated admin workspace');
    await openPage('Zones');
    expect(screen.getByText('No zones configured')).toBeTruthy();
    expect(screen.getByText('No zones are present in the mock data.')).toBeTruthy();
    await openPage('Users');
    expect(screen.getByText('No users listed')).toBeTruthy();
    expect(screen.getByText('No user records are present in the mock data.')).toBeTruthy();
  });
});
