import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App.jsx';
import { ADMIN_SESSION_EXPIRED_EVENT } from './admin/services/adminSession.js';

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.location.hash = '';
});

describe('App access gate', () => {
  it('requires an ADMIN sign-in in API builds, with no demo entry', () => {
    render(<App buildMode="api" />);
    expect(screen.getByRole('heading', { name: 'Administrator sign-in' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue with demo data' })).toBeNull();
  });

  it('opens the mock workspace from the demo button in mock builds and can leave it', async () => {
    render(<App buildMode="mock" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with demo data' }));
    expect(await screen.findByText('Simulated admin workspace')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave demo' }));
    expect(screen.getByRole('heading', { name: 'Administrator sign-in' })).toBeTruthy();
  });

  it('returns to the sign-in screen with a notice when the session expires', async () => {
    render(<App buildMode="mock" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with demo data' }));
    await screen.findByText('Simulated admin workspace');
    act(() => window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT)));
    expect(screen.getByRole('status').textContent).toMatch(/session ended/);
    expect(screen.queryByText('Simulated admin workspace')).toBeNull();
  });
});
