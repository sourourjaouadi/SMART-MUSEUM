import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { ApiError } from './services/adminApi.js';
import { fakeApi, openPage, renderApi } from './test-utils/fakeAdminApi.jsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.location.hash = '';
});

const networkError = () => new ApiError('The API could not be reached. Check the network and the middleware.', { code: 'NETWORK_ERROR' });

describe('Admin API error states', () => {
  it('shows a network failure with Retry and recovers', async () => {
    const api = fakeApi();
    const devices = await api.getDevices();
    api.getDevices.mockRejectedValueOnce(networkError()).mockResolvedValue(devices);
    renderApi(api);
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be loaded from the API\. The API could not be reached/);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Total registered devices')).toBeTruthy();
  });

  it('reports a timeout during an action without leaving the page', async () => {
    const api = fakeApi({
      approveDevice: vi.fn(async () => { throw new ApiError('The API did not answer within 10 s.', { code: 'TIMEOUT' }); }),
    });
    renderApi(api);
    await screen.findByText('Total registered devices');
    await openPage('Pending approvals');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect((await screen.findByRole('alert')).textContent).toBe('The API did not answer within 10 s.');
    expect(screen.getByRole('button', { name: 'Approve' }).disabled).toBe(false);
  });

  it('reloads the inventory after a 404 so a vanished device disappears', async () => {
    const api = fakeApi();
    const devices = await api.getDevices();
    api.approveDevice.mockRejectedValueOnce(new ApiError('This device or zone no longer exists. Refresh the list.', { status: 404, code: 'HTTP_ERROR' }));
    renderApi(api);
    await screen.findByText('Total registered devices');
    await openPage('Pending approvals');
    api.getDevices.mockResolvedValue(devices.filter((d) => d.deviceId !== 'test-admin-pending-01'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/no longer exists/);
    await waitFor(() => expect(screen.queryByText('test-admin-pending-01')).toBeNull());
  });

  it('shows the ADMIN-required message for a 403', async () => {
    renderApi(fakeApi({
      saveZone: vi.fn(async () => { throw new ApiError('This action requires an administrator account.', { status: 403, code: 'HTTP_ERROR' }); }),
    }));
    await screen.findByText('Total registered devices');
    await openPage('Zones');
    const form = screen.getByRole('form', { name: 'Coordinates for salle-01' });
    fireEvent.click(within(form).getByRole('button', { name: 'Save location' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This action requires an administrator account.');
  });

  it('a 401 from the real API client clears the session and returns to sign-in', async () => {
    window.sessionStorage.setItem('smart-museum.admin.session', JSON.stringify({
      accessToken: 'expired-token',
      expiresAt: Date.now() + 600_000,
      user: { userId: 'u-1', name: 'Test Admin', email: 'admin@example.org', role: 'ADMIN', status: 'active', zoneIds: [] },
    }));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'UNAUTHORIZED', message: 'Invalid or expired access token' }),
    })));
    render(<App buildMode="api" />);
    expect(await screen.findByRole('heading', { name: 'Administrator sign-in' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/session ended/);
    expect(window.sessionStorage.getItem('smart-museum.admin.session')).toBeNull();
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer expired-token');
  });
});
