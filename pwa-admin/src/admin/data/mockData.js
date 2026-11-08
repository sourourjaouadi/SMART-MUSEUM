export const ADMIN_MOCK_DATA = {
  label: 'Simulated admin data. Changes are kept in this browser session only.',
  devices: [
    { deviceId: 'bme280-01', type: 'BME280', zoneId: 'salle-01', gatewayId: 'gw-01', status: 'active', connectivity: 'online', lastSeenAt: '2026-11-08T10:05:00Z' },
    { deviceId: 'sim-bme280-02', type: 'BME280', zoneId: 'salle-02', gatewayId: 'gw-sim', status: 'active', connectivity: 'online', lastSeenAt: '2026-11-08T10:02:00Z' },
    { deviceId: 'bh1750-01', type: 'BH1750', zoneId: 'salle-01', gatewayId: 'gw-01', status: 'offline', connectivity: 'offline', lastSeenAt: '2026-11-08T07:00:00Z' },
    { deviceId: 'gateway-east-01', type: 'Gateway', zoneId: 'salle-03', gatewayId: 'gateway-east-01', status: 'maintenance', connectivity: null, lastSeenAt: '2026-11-07T09:00:00Z' },
    { deviceId: 'bme280-pending-03', type: 'BME280', zoneId: 'salle-03', gatewayId: 'gw-02', status: 'pending', connectivity: null, lastSeenAt: '2026-11-08T10:07:00Z' },
  ],
  zones: [
    { zoneId: 'salle-01', name: 'Textile gallery', floor: 'Ground floor', status: 'active' },
    { zoneId: 'salle-02', name: 'Manuscript room', floor: 'First floor', status: 'active' },
    { zoneId: 'salle-03', name: 'Ceramics wing', floor: 'Ground floor', status: 'active' },
  ],
  thresholds: [
    { id: 'temperature', label: 'Temperature', property: 'temperature', min: 18, max: 24, unit: '°C' },
    { id: 'humidity', label: 'Relative humidity', property: 'humidity', min: 45, max: 60, unit: '%' },
    { id: 'illuminance', label: 'Illuminance', property: 'illuminance', min: 0, max: 100, unit: 'lx' },
  ],
  users: [
    { id: 'usr-001', name: 'Amira Ben Salem', email: 'amira@example.test', accessRole: 'ADMIN', jobTitle: 'Conservator', status: 'active' },
    { id: 'usr-002', name: 'Youssef Khelifi', email: 'youssef@example.test', accessRole: 'CLIENT', jobTitle: 'Curator', status: 'active' },
    { id: 'usr-003', name: 'Meriem Trabelsi', email: 'meriem@example.test', accessRole: 'CLIENT', jobTitle: 'Viewer', status: 'invited' },
  ],
};
