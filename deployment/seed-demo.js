const dbx = db.getSiblingDB('museum_m2_sandbox');

const testDeviceFilter = { $or: [{ _id: /^m2acc-/ }, { _id: /^m2rej-/ }] };
const devDel = dbx.devices.deleteMany(testDeviceFilter).deletedCount;
const thingDel = dbx.things.deleteMany(testDeviceFilter).deletedCount;
const measDel = dbx.measurements.deleteMany({
  $or: [{ deviceId: /^m2acc-/ }, { deviceId: /^m2rej-/ }],
}).deletedCount;
const userDel = dbx.users.deleteMany({ _id: /^m2-(client|empty-client)-/ }).deletedCount;
const seededDel = dbx.measurements.deleteMany({
  measurementId: /^00000000-0000-4000-8000-/,
}).deletedCount;

print('cleaned devices=' + devDel + ' things=' + thingDel + ' measurements=' + measDel +
  ' users=' + userDel + ' previousSeed=' + seededDel);

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261120);

function uuid(i) {
  return '00000000-0000-4000-8000-' + i.toString(16).padStart(12, '0');
}

const defs = {
  temperature: { unit: '\u00B0C', base: 21.5, amp: 3.0, noise: 0.4, min: -40, max: 85 },
  humidity: { unit: '%', base: 52, amp: 10, noise: 1.2, min: 0, max: 100 },
  pressure: { unit: 'hPa', base: 1012, amp: 3, noise: 0.5, min: 300, max: 1100 },
};
const devices = [
  { deviceId: 'bme280-01', zoneId: 'salle-01', gatewayId: 'gw-01', source: 'real' },
  { deviceId: 'sim-bme280-02', zoneId: 'salle-02', gatewayId: 'gw-sim', source: 'simulated' },
];

const now = Date.now();
const start = now - 30 * 24 * 60 * 60 * 1000;
const step = 15 * 60 * 1000;
const docs = [];
let counter = 0;

for (const dev of devices) {
  for (let t = start; t <= now; t += step) {
    const dayFraction = (t % 86400000) / 86400000;
    for (const property of Object.keys(defs)) {
      const def = defs[property];
      let value;
      if (property === 'temperature') {
        value = def.base + def.amp * Math.sin(2 * Math.PI * (dayFraction - 0.25)) + (rand() - 0.5) * 2 * def.noise;
      } else if (property === 'humidity') {
        value = def.base - def.amp * Math.sin(2 * Math.PI * (dayFraction - 0.25)) + (rand() - 0.5) * 2 * def.noise;
      } else {
        value = def.base + def.amp * Math.sin(2 * Math.PI * (t / (7 * 86400000))) + (rand() - 0.5) * 2 * def.noise;
      }
      value = Math.max(def.min, Math.min(def.max, value));
      value = Math.round(value * 10) / 10;
      const id = uuid(++counter);
      docs.push({
        _id: id,
        measurementId: id,
        deviceId: dev.deviceId,
        zoneId: dev.zoneId,
        gatewayId: dev.gatewayId,
        property: property,
        value: value,
        unit: def.unit,
        observedAt: new Date(t),
        receivedAt: new Date(t + (2 + Math.floor(rand() * 4)) * 1000),
        source: dev.source,
        quality: rand() < 0.02 ? 'uncertain' : 'good',
      });
    }
  }
}

let inserted = 0;
for (let i = 0; i < docs.length; i += 2000) {
  const result = dbx.measurements.insertMany(docs.slice(i, i + 2000), { ordered: false });
  inserted += result.insertedIds ? Object.keys(result.insertedIds).length : 0;
}

// Pending device in salle-02 so the ADMIN approval workflow can be demonstrated.
dbx.devices.deleteOne({ _id: 'demo-pending-01' });
dbx.things.deleteOne({ _id: 'demo-pending-01' });
const td = {
  '@context': ['https://www.w3.org/2022/wot/td/v1.1', { museum: 'urn:museum:' }],
  '@type': 'Thing',
  id: 'urn:museum:device:demo-pending-01',
  title: 'BME280 demo-pending-01',
  description: 'Capteur environnemental en attente de validation',
  securityDefinitions: { nosec_sc: { scheme: 'nosec' } },
  security: 'nosec_sc',
  properties: {
    temperature: { title: 'Temperature', type: 'number', unit: '\u00B0C', minimum: -40, maximum: 85, readOnly: true, observable: true, forms: [{ href: 'mqtt://localhost:1883/museum/v1/salle-02/demo-pending-01/telemetry', op: ['observeproperty'], contentType: 'application/json' }] },
    humidity: { title: 'Humidite', type: 'number', unit: '%', minimum: 0, maximum: 100, readOnly: true, observable: true, forms: [{ href: 'mqtt://localhost:1883/museum/v1/salle-02/demo-pending-01/telemetry', op: ['observeproperty'], contentType: 'application/json' }] },
    pressure: { title: 'Pression', type: 'number', unit: 'hPa', minimum: 300, maximum: 1100, readOnly: true, observable: true, forms: [{ href: 'mqtt://localhost:1883/museum/v1/salle-02/demo-pending-01/telemetry', op: ['observeproperty'], contentType: 'application/json' }] },
  },
};
const nowDate = new Date();
dbx.devices.insertOne({
  _id: 'demo-pending-01',
  type: 'bme280',
  zoneId: 'salle-02',
  gatewayId: 'gw-sim',
  status: 'pending',
  thingId: 'urn:museum:device:demo-pending-01',
  lastSeenAt: null,
  latitude: null,
  longitude: null,
  floor: null,
});
dbx.things.insertOne({
  _id: 'demo-pending-01',
  thingId: 'urn:museum:device:demo-pending-01',
  td: JSON.stringify(td),
  properties: ['temperature', 'humidity', 'pressure'],
  units: { temperature: '\u00B0C', humidity: '%', pressure: 'hPa' },
  registeredAt: nowDate,
  updatedAt: nowDate,
});

print('inserted measurements=' + inserted);
print('pending device demo-pending-01 ready (salle-02)');
print('final counts: devices=' + dbx.devices.countDocuments() +
  ' things=' + dbx.things.countDocuments() +
  ' measurements=' + dbx.measurements.countDocuments() +
  ' users=' + dbx.users.countDocuments() +
  ' zones=' + dbx.zones.countDocuments());
print('per device/property:');
printjson(dbx.measurements.aggregate([
  { $match: { deviceId: { $in: ['bme280-01', 'sim-bme280-02'] } } },
  { $group: { _id: { d: '$deviceId', p: '$property' }, n: { $sum: 1 }, first: { $min: '$observedAt' }, last: { $max: '$observedAt' } } },
  { $sort: { '_id.d': 1, '_id.p': 1 } },
]).toArray());
