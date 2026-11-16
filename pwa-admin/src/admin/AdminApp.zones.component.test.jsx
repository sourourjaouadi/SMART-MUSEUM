import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './services/adminApi.js';
import { fakeApi, openPage, renderApi } from './test-utils/fakeAdminApi.jsx';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

function fill(form, values) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(within(form).getByLabelText(label), { target: { value } });
  }
  fireEvent.click(within(form).getByRole('button', { name: 'Save location' }));
}

async function openDevice(deviceId) {
  await openPage('Device inventory');
  fireEvent.click(within(screen.getByRole('row', { name: new RegExp(deviceId) })).getByRole('button', { name: 'View details' }));
  return screen.getByRole('region', { name: deviceId });
}

describe('AdminApp zones and device locations with the API', () => {
  it('saves zone coordinates with its name and refreshes inherited device locations', async () => {
    const api = renderApi();
    await screen.findByText('Live admin workspace');
    await openPage('Zones');
    const form = screen.getByRole('form', { name: 'Coordinates for salle-01' });
    expect(within(form).getByLabelText('Zone name').value).toBe('Textile gallery');
    fill(form, { Latitude: '36.8070', Longitude: '10.1820', Floor: '0' });

    expect(await screen.findByText('salle-01 coordinates saved on the server.')).toBeTruthy();
    expect(api.saveZone).toHaveBeenCalledWith('salle-01', {
      name: 'Textile gallery',
      location: { latitude: 36.807, longitude: 10.182, floor: 0 },
    });
    expect(within(screen.getByRole('row', { name: /salle-01/ })).getByText('36.80700, 10.18200 · Floor 0')).toBeTruthy();

    const details = await openDevice('bme280-01');
    expect(within(details).getByText('36.80700, 10.18200 · Floor 0 (from zone)')).toBeTruthy();
  });

  it('creates a zone record for a device zone that has none yet', async () => {
    const api = fakeApi();
    const baseDevices = await api.getDevices();
    api.getDevices.mockImplementation(async () => [
      ...baseDevices,
      { deviceId: 'test-admin-archive-01', zoneId: 'salle-09', status: 'active' },
    ]);
    renderApi(api);
    await screen.findByText('Live admin workspace');
    await openPage('Zones');
    expect(within(screen.getByRole('row', { name: /salle-09/ })).getByText('No zone record yet')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Zone to edit'), { target: { value: 'salle-09' } });
    expect(screen.getByRole('heading', { name: 'Create zone record' })).toBeTruthy();
    const form = screen.getByRole('form', { name: 'Coordinates for salle-09' });
    fill(form, { Latitude: '36.807', Longitude: '10.183' });
    expect((await screen.findByRole('alert')).textContent).toMatch(/Zone name is required/);
    expect(api.saveZone).not.toHaveBeenCalled();

    fill(form, { 'Zone name': 'Archive' });
    expect(await screen.findByText('salle-09 coordinates saved on the server.')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /salle-09/ })).getByText('Archive')).toBeTruthy();
  });

  it('assigns an own device position and reverts to the zone location; zoneId never changes', async () => {
    const api = renderApi();
    await screen.findByText('Live admin workspace');
    let details = await openDevice('bme280-01');
    expect(within(details).queryByRole('button', { name: 'Use zone location' })).toBeNull();

    fill(within(details).getByRole('form', { name: 'Assign location for bme280-01' }), { Latitude: '36.80652', Longitude: '10.18148', Floor: '0' });
    expect(await screen.findByText('bme280-01 location assigned on the server.')).toBeTruthy();
    expect(api.assignDeviceLocation).toHaveBeenCalledWith('bme280-01', { latitude: 36.80652, longitude: 10.18148, floor: 0 });
    details = screen.getByRole('region', { name: 'bme280-01' });
    expect(within(details).getByText('36.80652, 10.18148 · Floor 0 (own position)')).toBeTruthy();
    expect(within(details).getByText('salle-01')).toBeTruthy();

    fireEvent.click(within(details).getByRole('button', { name: 'Use zone location' }));
    expect(await screen.findByText('bme280-01 now uses its zone location on the server.')).toBeTruthy();
    expect(api.clearDeviceLocation).toHaveBeenCalledWith('bme280-01');
    expect(within(screen.getByRole('region', { name: 'bme280-01' })).getByText('36.80650, 10.18150 · Floor 0 (from zone)')).toBeTruthy();
  });

  it('shows the 409 reason when the device is not approved', async () => {
    const api = fakeApi({
      assignDeviceLocation: vi.fn(async () => {
        throw new ApiError('Approve this device before assigning it a location.', { status: 409, code: 'HTTP_ERROR' });
      }),
    });
    renderApi(api);
    await screen.findByText('Live admin workspace');
    const details = await openDevice('test-admin-pending-01');
    fill(within(details).getByRole('form', { name: 'Assign location for test-admin-pending-01' }), { Latitude: '36.8', Longitude: '10.18' });
    expect((await screen.findByRole('alert')).textContent).toBe('Approve this device before assigning it a location.');
  });
});
