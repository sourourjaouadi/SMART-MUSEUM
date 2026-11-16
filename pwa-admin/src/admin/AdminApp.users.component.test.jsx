import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminApp from './AdminApp.jsx';
import { ApiError } from './services/adminApi.js';
import { fakeApi, openPage, renderApi } from './test-utils/fakeAdminApi.jsx';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

function createAccount({ name = 'Test Curator', email = 'curator@example.org', password = 'test-only-password', zones = ['salle-01'] } = {}) {
  const form = screen.getByRole('form', { name: 'Create CLIENT account' });
  fireEvent.change(within(form).getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(within(form).getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(within(form).getByLabelText(/Initial password/), { target: { value: password } });
  for (const zone of zones) fireEvent.click(within(form).getByLabelText(zone));
  fireEvent.click(within(form).getByRole('button', { name: 'Create CLIENT account' }));
  return form;
}

describe('Users and thresholds pages', () => {
  it('creates a CLIENT account through POST /api/users with the selected zones', async () => {
    const api = renderApi();
    await screen.findByText('Live admin workspace');
    await openPage('Users');
    const form = createAccount();
    expect(await screen.findByText('CLIENT account curator@example.org created on the server (salle-01).')).toBeTruthy();
    expect(api.provisionClient).toHaveBeenCalledWith({
      name: 'Test Curator', email: 'curator@example.org', password: 'test-only-password', zoneIds: ['salle-01'],
    });
    expect(within(form).getByLabelText(/Initial password/).value).toBe('');
    expect(screen.getByText('The user list is not connected yet')).toBeTruthy();
  });

  it('validates locally and reports a duplicate email from the server', async () => {
    const api = fakeApi({
      provisionClient: vi.fn(async () => {
        throw new ApiError('An account with this email already exists.', { status: 409, code: 'HTTP_ERROR' });
      }),
    });
    renderApi(api);
    await screen.findByText('Live admin workspace');
    await openPage('Users');
    createAccount({ password: 'short' });
    expect((await screen.findByRole('alert')).textContent).toMatch(/at least 12 characters/);
    expect(api.provisionClient).not.toHaveBeenCalled();

    cleanup();
    renderApi(api);
    await screen.findByText('Live admin workspace');
    await openPage('Users');
    createAccount();
    expect((await screen.findByRole('alert')).textContent).toBe('An account with this email already exists.');
  });

  it('marks thresholds as not connected and keeps their values illustrative', async () => {
    renderApi();
    await screen.findByText('Live admin workspace');
    await openPage('Thresholds');
    expect(screen.getByText('Not connected yet')).toBeTruthy();
    expect(screen.getByText(/no thresholds endpoint yet/)).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Illustrative environmental thresholds' })).toBeTruthy();
  });

  it('only simulates account creation in demo mode', async () => {
    render(<AdminApp />);
    await screen.findByText('Total registered devices');
    await openPage('Users');
    createAccount({ zones: [] });
    expect(await screen.findByText(/validated in the demo \(no zones\)\. No account was created\./)).toBeTruthy();
  });
});
