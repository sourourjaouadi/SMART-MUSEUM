import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientLogin from './ClientLogin.jsx';
import ConservationDashboard from '../pages/ConservationDashboard.jsx';
import { DATA_MODES, getZoneData } from '../services/dataSource.js';

vi.mock('../services/api.js', () => ({
  login: vi.fn(),
  getHealth: vi.fn(async () => ({ status: 'UP', mongo: 'UP' })),
}));
vi.mock('../services/dataSource.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getZoneData: vi.fn(),
}));

const session = {
  accessToken: 't',
  expiresAt: Date.now() + 600_000,
  user: { userId: 'u-1', name: 'Curator', role: 'CLIENT', zoneIds: ['salle-01'] },
};

beforeEach(() => vi.stubEnv('VITE_DATA_MODE', 'api'));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('api build', () => {
  it('offers no demo entry on the sign-in screen', () => {
    render(<ClientLogin onAuthenticated={vi.fn()} onDemo={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue with demo data' })).toBeNull();
  });

  it('has no demo data source and shows the zone name set by the administrator', async () => {
    getZoneData.mockResolvedValue({
      devices: [{ deviceId: 'bme280-01', zoneId: 'salle-01' }],
      measurements: [],
      zone: { zoneId: 'salle-01', name: 'Renamed by admin' },
    });
    render(<ConservationDashboard initialMode={DATA_MODES.API} session={session} />);
    expect(await screen.findByRole('heading', { name: 'Renamed by admin' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Demo preview' })).toBeNull();
    expect(screen.queryByText('Data source')).toBeNull();
  });
});
