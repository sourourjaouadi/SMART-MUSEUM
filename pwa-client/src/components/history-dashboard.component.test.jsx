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

import { getZoneData } from '../services/dataSource.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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

    render(<ConservationDashboard />);

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

    render(<ConservationDashboard />);

    const apiMode = screen.getByRole('radio', { name: 'Live API' });
    fireEvent.click(apiMode);
    await waitFor(() => expect(apiMode.checked).toBe(true));

    const demoMode = screen.getByRole('radio', { name: 'Demo preview' });
    fireEvent.click(demoMode);
    await waitFor(() => expect(demoMode.checked).toBe(true));
    expect(screen.getByText('Illustrative mock records')).toBeTruthy();
  });
});
