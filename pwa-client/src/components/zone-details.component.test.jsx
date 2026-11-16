import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ZoneDetails from './ZoneDetails.jsx';

afterEach(cleanup);

const zone = { id: 'salle-01', shortLabel: 'Salle 01' };

describe('ZoneDetails', () => {
  it('shows the zone coordinates and where each device location comes from', () => {
    render(
      <ZoneDetails
        zone={zone}
        zoneLocation={{ latitude: 36.8065, longitude: 10.1815, floor: 0 }}
        devices={[
          {
            deviceId: 'bme280-01',
            zoneId: 'salle-01',
            location: { latitude: 36.8065, longitude: 10.1815, floor: 0 },
            locationSource: 'zone',
          },
          {
            deviceId: 'bme280-02',
            zoneId: 'salle-01',
            location: { latitude: 36.80652, longitude: 10.18148, floor: 0 },
            locationSource: 'device',
          },
        ]}
      />,
    );

    expect(screen.getByText('Zone location (WGS84)')).toBeTruthy();
    expect(screen.getByText('36.80650, 10.18150 · Floor 0')).toBeTruthy();
    expect(screen.getByText('36.80650, 10.18150 · Floor 0 (from zone)')).toBeTruthy();
    expect(screen.getByText('36.80652, 10.18148 · Floor 0 (own position)')).toBeTruthy();
  });

  it('omits location rows when no coordinates are known', () => {
    render(<ZoneDetails zone={zone} devices={[{ deviceId: 'bme280-01', zoneId: 'salle-01' }]} />);
    expect(screen.queryByText('Zone location (WGS84)')).toBeNull();
    expect(screen.queryByText('Location')).toBeNull();
    expect(screen.getByText('bme280-01')).toBeTruthy();
  });
});
