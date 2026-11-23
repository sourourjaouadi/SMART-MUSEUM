import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './services/adminApi.js';
import { fakeApi, openPage, renderApi } from './test-utils/fakeAdminApi.jsx';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('Thing Description view', () => {
  it('lets the ADMIN inspect a pending device before deciding', async () => {
    const api = renderApi();
    await screen.findByText('Total registered devices');
    await openPage('Pending approvals');
    const panel = screen.getByRole('region', { name: 'Thing Description of test-admin-pending-01' });
    fireEvent.click(within(panel).getByRole('button', { name: 'View Thing Description' }));
    expect(await within(panel).findByText('BME280 test-admin-pending-01')).toBeTruthy();
    expect(within(panel).getByText('temperature (Cel), humidity (%)')).toBeTruthy();
    expect(within(panel).getByText('alarm')).toBeTruthy();
    expect(api.getThingDescription).toHaveBeenCalledWith('test-admin-pending-01');
    fireEvent.click(within(panel).getByRole('button', { name: 'Hide Thing Description' }));
    expect(within(panel).queryByText('BME280 test-admin-pending-01')).toBeNull();
  });

  it('is available in device details and reports a missing description', async () => {
    renderApi(fakeApi({
      getThingDescription: vi.fn(async () => {
        throw new ApiError('No Thing Description is registered for this device.', { status: 404, code: 'HTTP_ERROR' });
      }),
    }));
    await screen.findByText('Total registered devices');
    await openPage('Device inventory');
    fireEvent.click(within(screen.getByRole('row', { name: /test-admin-offline-01/ })).getByRole('button', { name: 'View details' }));
    const panel = screen.getByRole('region', { name: 'Thing Description of test-admin-offline-01' });
    fireEvent.click(within(panel).getByRole('button', { name: 'View Thing Description' }));
    expect((await within(panel).findByRole('alert')).textContent).toBe('No Thing Description is registered for this device.');
  });
});
