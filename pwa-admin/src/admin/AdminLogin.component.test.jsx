import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLogin from './AdminLogin.jsx';
import { ApiError } from './services/adminApi.js';

const SESSION_KEY = 'smart-museum.admin.session';

function loginResponse(role) {
  return {
    accessToken: 'jwt-value',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: { userId: 'u-1', name: 'Test Admin', email: 'admin@example.org', role, status: 'active', zoneIds: [] },
  };
}

function submit(email = 'admin@example.org', password = 'password-value') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('AdminLogin', () => {
  it('signs in an ADMIN account and stores the short-lived session', async () => {
    const login = vi.fn().mockResolvedValue(loginResponse('ADMIN'));
    const onAuthenticated = vi.fn();
    render(<AdminLogin login={login} onAuthenticated={onAuthenticated} />);
    submit();
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
    expect(login).toHaveBeenCalledWith('admin@example.org', 'password-value');
    expect(onAuthenticated.mock.calls[0][0].user.role).toBe('ADMIN');
    expect(window.sessionStorage.getItem(SESSION_KEY)).toContain('jwt-value');
  });

  it('refuses a CLIENT account in the UI and keeps no session', async () => {
    const onAuthenticated = vi.fn();
    render(<AdminLogin login={vi.fn().mockResolvedValue(loginResponse('CLIENT'))} onAuthenticated={onAuthenticated} />);
    submit('curator@example.org');
    expect((await screen.findByRole('alert')).textContent).toMatch(/not an administrator/);
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('shows safe messages for rejected credentials and an unreachable API', async () => {
    const login = vi.fn()
      .mockRejectedValueOnce(new ApiError('x', { status: 401, code: 'HTTP_ERROR' }))
      .mockRejectedValueOnce(new ApiError('The API could not be reached. Check the network and the middleware.', { code: 'NETWORK_ERROR' }));
    render(<AdminLogin login={login} onAuthenticated={vi.fn()} />);
    submit();
    expect((await screen.findByRole('alert')).textContent).toBe('The email or password was not accepted.');
    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not be reached/));
  });

  it('offers demo data only when allowed and shows an expired-session notice', () => {
    const { unmount } = render(<AdminLogin login={vi.fn()} onAuthenticated={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Continue with demo data' })).toBeNull();
    unmount();
    const onDemo = vi.fn();
    render(<AdminLogin login={vi.fn()} onAuthenticated={vi.fn()} onDemo={onDemo} allowDemo expired />);
    expect(screen.getByRole('status').textContent).toMatch(/session ended/);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with demo data' }));
    expect(onDemo).toHaveBeenCalled();
  });
});
