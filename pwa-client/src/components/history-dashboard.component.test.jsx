import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HistoricalMeasurements from './HistoricalMeasurements.jsx';
import ConservationDashboard from '../pages/ConservationDashboard.jsx';
import { MOCK_DATA } from '../services/mockData.js';

vi.mock('../services/dataSource.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getZoneData: vi.fn(),
}));

vi.mock('../services/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getHealth: vi.fn().mockResolvedValue({ status: 'UP', mongo: 'UP' }),
}));

import { DATA_MODES, getZoneData } from '../services/dataSource.js';
import { getHealth } from '../services/api.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  getHealth.mockResolvedValue({ status: 'UP', mongo: 'UP' });
});

describe('HistoricalMeasurements', () => {
  it('keeps chart and table labels tied to the displayed query after a filter edit', async () => {
    render(
      <HistoricalMeasurements
        zones={[
          { id: 'salle-01', name: 'Salle 01' },
          { id: 'salle-02', name: 'Salle 02' },
        ]}
        devices={MOCK_DATA.devices}
        mode="mock"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load history' }));

    expect(await screen.findByRole('img', { name: /Temperature measurement history/ }))
      .toBeTruthy();
    expect(screen.getByRole('table', { name: 'Temperature (°C) for bme280-01' }))
      .toBeTruthy();
    expect(screen.getByText('19.4 °C')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Measurement'), {
      target: { value: 'humidity' },
    });

    expect(screen.getByRole('img', { name: /Temperature measurement history/ }))
      .toBeTruthy();
    expect(screen.getByRole('table', { name: 'Temperature (°C) for bme280-01' }))
      .toBeTruthy();
    expect(screen.getByText('19.4 °C')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Load history' }));

    expect(await screen.findByRole('img', { name: /Humidity measurement history/ }))
      .toBeTruthy();
    expect(screen.getByRole('table', { name: 'Humidity (%) for bme280-01' }))
      .toBeTruthy();
    expect(screen.getByText('51.8 %')).toBeTruthy();
  });
});

describe('ConservationDashboard', () => {
  it('updates zone measurements and device details when the zone changes', async () => {
    getZoneData.mockImplementation(async (zoneId) => ({
      devices: MOCK_DATA.devices.filter((device) => device.zoneId === zoneId),
      measurements: MOCK_DATA.measurements.filter(
        (measurement) => measurement.zoneId === zoneId,
      ),
    }));

    render(<ConservationDashboard initialMode={DATA_MODES.MOCK} />);

    expect(await screen.findByText('bme280-01')).toBeTruthy();
    expect(screen.getByText('19.4')).toBeTruthy();
    expect(screen.getByText('°C')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Monitoring zone'), {
      target: { value: 'salle-02' },
    });

    expect((await screen.findAllByText('sim-bme280-02')).length).toBeGreaterThan(0);
    expect(screen.getByText('20.1')).toBeTruthy();
    expect(screen.getAllByText('Simulated').length).toBeGreaterThan(0);
    expect(screen.getByText('°C')).toBeTruthy();
  });

  it('allows selecting mock and API data-source modes', async () => {
    getZoneData.mockImplementation(async (zoneId) => ({
      devices: MOCK_DATA.devices.filter((device) => device.zoneId === zoneId),
      measurements: MOCK_DATA.measurements.filter(
        (measurement) => measurement.zoneId === zoneId,
      ),
    }));

    render(<ConservationDashboard initialMode={DATA_MODES.MOCK} />);

    const apiMode = screen.getByRole('radio', { name: 'Live API' });
    fireEvent.click(apiMode);
    await waitFor(() => expect(apiMode.checked).toBe(true));

    const demoMode = screen.getByRole('radio', { name: 'Demo preview' });
    fireEvent.click(demoMode);
    await waitFor(() => expect(demoMode.checked).toBe(true));
    expect(screen.getByText('Illustrative mock records')).toBeTruthy();
  });

  it('uses unique API zones and displays optional device status fields', async () => {
    const apiDevices = [
      {
        deviceId: 'api-device-a',
        zoneId: 'gallery-east',
        gatewayId: 'gateway-east',
        status: 'ACTIVE',
        lastSeenAt: '2026-11-02T08:30:00Z',
      },
      {
        deviceId: 'api-device-b',
        zoneId: 'gallery-east',
        gatewayId: 'gateway-east',
      },
      {
        deviceId: 'api-device-c',
        zoneId: 'archive-2',
        status: 'MAINTENANCE',
      },
    ];
    const apiMeasurement = {
      ...MOCK_DATA.measurements[0],
      measurementId: 'api-reading',
      deviceId: 'api-device-a',
      zoneId: 'gallery-east',
    };
    getZoneData.mockImplementation(async (zoneId, { mode }) => ({
      devices: mode === DATA_MODES.API
        ? apiDevices
        : MOCK_DATA.devices.filter((device) => device.zoneId === zoneId),
      measurements: mode === DATA_MODES.API
        ? zoneId === 'gallery-east' ? [apiMeasurement] : []
        : MOCK_DATA.measurements.filter(
          (measurement) => measurement.zoneId === zoneId,
        ),
    }));

    render(<ConservationDashboard initialMode={DATA_MODES.MOCK} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Live API' }));

    const zoneSelector = screen.getByLabelText('Monitoring zone');
    await waitFor(() => {
      expect(zoneSelector.options).toHaveLength(2);
      expect(zoneSelector.options[0].value).toBe('gallery-east');
    });
    expect(zoneSelector.options[0].value).toBe('gallery-east');
    expect(zoneSelector.options[1].value).toBe('archive-2');
    expect((await screen.findAllByText('api-device-a')).length).toBeGreaterThan(0);
    expect(screen.getByText('ACTIVE')).toBeTruthy();
    expect(screen.getByText('2026-11-02T08:30:00Z')).toBeTruthy();

    fireEvent.change(zoneSelector, { target: { value: 'archive-2' } });
    expect(await screen.findByText('MAINTENANCE')).toBeTruthy();
    expect(screen.getByText('No environmental readings are available for this zone.'))
      .toBeTruthy();
  });

  it('handles an empty API device list without retaining mock zones', async () => {
    getZoneData.mockResolvedValue({ devices: [], measurements: [] });
    render(<ConservationDashboard initialMode={DATA_MODES.MOCK} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Live API' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Monitoring zone').options[0].value).toBe('');
      expect(screen.getByLabelText('Zone').options[0].value).toBe('');
    });
    expect(screen.getByText('Measurement data unavailable')).toBeTruthy();
  });

  it('shows a safe backend error code without exposing its message', async () => {
    const apiError = new Error('GET /api/devices failed with HTTP 500.');
    apiError.backendErrorCode = 'INTERNAL_ERROR';
    apiError.backendError = {
      error: 'INTERNAL_ERROR',
      message: 'Sensitive server detail must not be shown.',
    };
    getZoneData.mockRejectedValue(apiError);

    render(<ConservationDashboard />);
    fireEvent.click(screen.getByRole('radio', { name: 'Live API' }));

    expect(await screen.findByText('Backend error code: INTERNAL_ERROR')).toBeTruthy();
    expect(screen.queryByText(/Sensitive server detail/)).toBeNull();
  });

  it('shows a clear zone authorization message for API 403 responses', async () => {
    const forbidden = Object.assign(new Error('Access denied'), { status: 403 });
    getZoneData.mockRejectedValue(forbidden);
    render(<ConservationDashboard initialMode={DATA_MODES.API} />);
    expect(await screen.findByText('Access to this zone is denied')).toBeTruthy();
    expect(screen.getByText(/not assigned to this zone/i)).toBeTruthy();
  });

  it('shows backend health failures without requesting or substituting demo data', async () => {
    getHealth.mockResolvedValue({ status: 'UP', mongo: 'DOWN' });
    render(<ConservationDashboard initialMode={DATA_MODES.API} />);
    expect(await screen.findByText(/Backend health check failed/)).toBeTruthy();
    expect(getZoneData).not.toHaveBeenCalled();
  });
});
