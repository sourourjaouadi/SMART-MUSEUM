import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ClientLogin from './ClientLogin.jsx';
import * as api from '../services/api.js';

vi.mock('../services/api.js', () => ({ login: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ClientLogin', () => {
  it('submits the backend credentials and returns a saved session', async () => {
    api.login.mockResolvedValue({
      accessToken: 'jwt-value',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        userId: 'a4cd67bc-e1c7-43c8-9d8b-9058af504400',
        name: 'Curator',
        email: 'curator@example.org',
        role: 'CLIENT',
        status: 'active',
        zoneIds: ['salle-01'],
      },
    });
    const onAuthenticated = vi.fn();
    render(<ClientLogin onAuthenticated={onAuthenticated} onDemo={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'curator@example.org' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password-value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
    expect(api.login).toHaveBeenCalledWith('curator@example.org', 'password-value');
    expect(onAuthenticated.mock.calls[0][0].accessToken).toBe('jwt-value');
    expect(window.sessionStorage.getItem('smart-museum.client.session')).toContain('jwt-value');
  });

  it('shows a safe invalid-credentials message and keeps demo available', async () => {
    api.login.mockRejectedValue(Object.assign(new Error('backend details'), { status: 401 }));
    const onDemo = vi.fn();
    render(<ClientLogin onAuthenticated={vi.fn()} onDemo={onDemo} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nobody@example.org' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent)
      .toContain('email or password was not accepted');
    fireEvent.click(screen.getByRole('button', { name: 'Continue with demo data' }));
    expect(onDemo).toHaveBeenCalledOnce();
  });
});
