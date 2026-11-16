import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openPage, renderApi } from './test-utils/fakeAdminApi.jsx';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('AdminApp with the middleware API', () => {
  it('shows live KPIs from API statuses and the signed-in ADMIN', async () => {
    renderApi();
    expect(await screen.findByText('Live admin workspace')).toBeTruthy();
    expect(screen.getByText('Signed in as Test Admin (ADMIN)')).toBeTruthy();
    const metric = (label) => screen.getByText(label).closest('.admin-metric').querySelector('strong').textContent;
    expect(metric('Total registered devices')).toBe('3');
    expect(metric('Active devices')).toBe('1');
    expect(metric('Pending devices')).toBe('1');
    expect(metric('Offline or rejected')).toBe('1');
    expect(metric('Registered zones')).toBe('2');
    expect(screen.queryByText('Online devices')).toBeNull();
  });

  it('lists devices without mock-only connectivity or maintenance status', async () => {
    renderApi();
    await screen.findByText('Live admin workspace');
    await openPage('Device inventory');
    const table = screen.getByRole('table', { name: 'Device inventory' });
    expect(within(table).queryByText('Connectivity')).toBeNull();
    const statuses = [...screen.getByLabelText('Filter by status').options].map((option) => option.value);
    expect(statuses).toEqual(['all', 'active', 'pending', 'offline', 'rejected']);
    fireEvent.click(within(screen.getByRole('row', { name: /bme280-01/ })).getByRole('button', { name: 'View details' }));
    expect(within(screen.getByRole('region', { name: 'bme280-01' })).getByText('urn:museum:device:bme280-01')).toBeTruthy();
  });

  it.each([
    ['Approve', 'active', 'approveDevice'],
    ['Reject', 'rejected', 'rejectDevice'],
  ])('%s sends the decision to the API and shows the reloaded status', async (action, status, call) => {
    const api = renderApi();
    await screen.findByText('Live admin workspace');
    await openPage('Pending approvals');
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(await screen.findByText(`test-admin-pending-01 ${status} on the server.`)).toBeTruthy();
    expect(api[call]).toHaveBeenCalledWith('test-admin-pending-01');
    expect(api.getDevices).toHaveBeenCalledTimes(2);
    await openPage('Device inventory');
    expect(within(screen.getByRole('row', { name: /test-admin-pending-01/ })).getByText(status)).toBeTruthy();
  });
});
