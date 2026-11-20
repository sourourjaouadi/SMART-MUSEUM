// Tests du flux Node-RED sans Node-RED ni broker : structure de flows.json et logique de
// chaque noeud « function » (validation, source, aiguillage des reponses, nouveaux essais).
// Lancement : node --test node-red/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const flows = JSON.parse(readFileSync(new URL('../flows.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(flows.map((n) => [n.id, n]));
const ENV = { INGEST_SERVICE_TOKEN: 'jeton-de-test', BACKEND_URL: 'http://middleware:8080/', INGEST_MAX_ATTEMPTS: '3' };

function run(id, msg, env = ENV) {
  const n = byId[id];
  assert.equal(n?.type, 'function', `noeud function ${id} absent`);
  const statuses = [];
  const errors = [];
  const node = { status: (s) => statuses.push(s), error: (e) => errors.push(e), warn: () => {} };
  const fn = new Function('msg', 'node', 'env', 'context', 'flow', 'global', n.func);
  const out = fn(structuredClone(msg), node, { get: (k) => env[k] }, {}, {}, {});
  return { out: Array.isArray(out) ? out : [out], errors, statuses };
}

const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const measurement = (over = {}) => ({
  measurementId: randomUUID(), deviceId: 'sim-bme280-02', zoneId: 'salle-02', gatewayId: 'gw-sim',
  property: 'temperature', value: 21.4, unit: '°C', observedAt: now(), quality: 'good', ...over,
});
const telemetry = (m, topic = `museum/v1/${m.zoneId}/${m.deviceId}/telemetry`) => ({ topic, payload: JSON.stringify(m) });

// ---------------------------------------------------------------- structure
test('flows.json : chaque fil et chaque portee de catch vise un noeud existant', () => {
  for (const n of flows) {
    for (const output of n.wires || []) for (const target of output) assert.ok(byId[target], `${n.id} -> ${target} absent`);
    for (const target of n.scope || []) assert.ok(byId[target], `catch ${n.id} -> ${target} absent`);
    if (n.z) assert.equal(byId[n.z]?.type, 'tab', `${n.id} : onglet ${n.z} absent`);
    if (n.type === 'function') assert.equal(n.wires.length, n.outputs, `${n.id} : ${n.outputs} sorties mais ${n.wires.length} fils`);
  }
});

test('flows.json : abonnements MQTT attendus en QoS 1', () => {
  const topics = flows.filter((n) => n.type === 'mqtt in').map((n) => [n.topic, n.qos, n.datatype]);
  for (const t of ['museum/v1/+/+/telemetry', 'museum/v1/+/+/status', 'museum/v1/+/+/td']) {
    assert.deepEqual(topics.find((x) => x[0] === t), [t, '1', 'utf8'], `abonnement ${t}`);
  }
});

test('flows.json : aucun secret, broker et jeton par variables d environnement', () => {
  const text = JSON.stringify(flows);
  assert.ok(!flows.some((n) => n.credentials), 'credentials dans flows.json');
  assert.ok(!/"X-Service-Token"\s*:\s*"[^"]/.test(text), 'jeton en clair');
  assert.equal(byId.broker.broker, '${MQTT_HOST}');
  assert.equal(byId.broker.port, '${MQTT_PORT}');
  for (const n of flows.filter((x) => x.type === 'http request')) assert.equal(n.url, '', `${n.id} : URL fixee dans le flux`);
  for (const n of flows.filter((x) => x.type === 'function')) {
    if (n.func.includes('X-Service-Token')) assert.ok(n.func.includes("env.get('INGEST_SERVICE_TOKEN')"), n.id);
  }
});

test('flows.json : le code de chaque noeud function est du JavaScript valide', () => {
  for (const n of flows.filter((x) => x.type === 'function')) assert.doesNotThrow(() => new Function('msg', 'node', 'env', n.func), n.id);
});

// ---------------------------------------------------------------- mesures (A6)
test('mesure valide : source simulated, POST vers /api/ingest/measurements avec le jeton', () => {
  const m = measurement();
  const { out } = run('fn-validate', telemetry(m));
  assert.equal(out[1], null);
  assert.equal(out[0].payload.source, 'simulated');
  assert.equal(out[0].url, 'http://middleware:8080/api/ingest/measurements');
  assert.equal(out[0].headers['X-Service-Token'], 'jeton-de-test');
  assert.equal(out[0].payload.measurementId, m.measurementId);
});

test('mesure d un capteur reel : source real', () => {
  const m = measurement({ deviceId: 'bme280-01', zoneId: 'salle-01', gatewayId: 'gw-01' });
  assert.equal(run('fn-validate', telemetry(m)).out[0].payload.source, 'real');
});

test('source envoyee par l emetteur ignoree, receivedAt retire', () => {
  const m = measurement({ deviceId: 'bme280-01', zoneId: 'salle-01', gatewayId: 'gw-01', source: 'simulated', receivedAt: now() });
  const sent = run('fn-validate', telemetry(m)).out[0].payload;
  assert.equal(sent.source, 'real');
  assert.equal(sent.receivedAt, undefined);
});

for (const [label, msg, reason] of [
  ['JSON casse', { topic: 'museum/v1/salle-02/sim-bme280-02/telemetry', payload: '{"measurementId": "oops", "value": ' }, 'JSON_INVALIDE'],
  ['UUID invalide', telemetry(measurement({ measurementId: 'oops' })), 'SCHEMA_INVALIDE'],
  ['propriete inconnue', telemetry(measurement({ property: 'co2' })), 'SCHEMA_INVALIDE'],
  ['valeur non numerique', telemetry(measurement({ value: '21' })), 'SCHEMA_INVALIDE'],
  ['date sans Z', telemetry(measurement({ observedAt: '2026-11-21T10:00:00' })), 'SCHEMA_INVALIDE'],
  ['identifiant trop long', telemetry(measurement({ gatewayId: 'g'.repeat(65) })), 'SCHEMA_INVALIDE'],
  ['topic incoherent', telemetry(measurement(), 'museum/v1/salle-01/sim-bme280-02/telemetry'), 'TOPIC_INCOHERENT'],
]) {
  test(`mesure rejetee : ${label}`, () => {
    const { out } = run('fn-validate', msg);
    assert.equal(out[0], null);
    assert.equal(out[1].reason, reason);
  });
}

test('jeton absent : rien n est envoye, erreur signalee', () => {
  const { out, errors } = run('fn-validate', telemetry(measurement()), { BACKEND_URL: 'http://x' });
  assert.equal(out[0], null);
  assert.equal(out[1].reason, 'TOKEN_ABSENT');
  assert.equal(errors.length, 1);
});

test('aiguillage des reponses de /api/ingest/measurements', () => {
  const base = { measurement: measurement(), payload: '{}' };
  const route = (statusCode) => run('fn-route', { ...base, statusCode }).out.findIndex((o) => o !== null);
  assert.equal(route(202), 0);
  assert.equal(route(200), 0);   // doublon : pas une erreur
  for (const c of [400, 403, 422]) assert.equal(route(c), 1);
  for (const c of [0, 500, 503]) assert.equal(route(c), 2);
  assert.equal(route(401), 3);
});

test('nouvel essai : meme measurementId, attente croissante, abandon apres le maximum', () => {
  const m = measurement();
  const first = run('fn-retry', { measurement: m, attempt: 0, retryReason: 'HTTP 503', headers: {} }).out;
  assert.equal(first[0].payload.measurementId, m.measurementId);
  assert.equal(first[0].delay, 2000);
  assert.equal(first[0].headers['X-Service-Token'], 'jeton-de-test');
  const last = run('fn-retry', { measurement: m, attempt: 3, retryReason: 'HTTP 503' }).out;
  assert.equal(last[0], null);
  assert.match(last[1].reason, /^ABANDON_APRES_3_ESSAIS$/);
});

test('journal des rejets : une ligne JSON avec le motif', () => {
  const { out } = run('fn-reject', { reason: 'SCHEMA_INVALIDE', detail: 'x', topic: 't', raw: '{}' }, { REJECTED_LOG_FILE: '/tmp/r.jsonl' });
  assert.equal(out[0].filename, '/tmp/r.jsonl');
  assert.equal(out[0].payload.reason, 'SCHEMA_INVALIDE');
  assert.ok(!Number.isNaN(Date.parse(out[0].payload.rejectedAt)));
});

test('les boutons de test produisent un message accepte et un message rejete', () => {
  const ok = run('fn-gen-ok', {}).out[0];
  assert.equal(run('fn-validate', ok).out[0].payload.source, 'simulated');
  const broken = run('fn-gen-broken', {}).out[0];
  assert.equal(run('fn-validate', broken).out[1].reason, 'JSON_INVALIDE');
});

// ---------------------------------------------------------------- annonces TD (P1.3)
const announcementMsg = () => run('fn-gen-td', {}, {}).out[0];

test('annonce TD valide : POST /api/things avec le jeton', () => {
  const msg = announcementMsg();
  assert.equal(msg.topic, 'museum/v1/salle-02/sim-bme280-03/td');
  const { out } = run('fn-td-validate', msg);
  assert.equal(out[1], null);
  assert.equal(out[0].url, 'http://middleware:8080/api/things');
  assert.equal(out[0].headers['X-Service-Token'], 'jeton-de-test');
  assert.equal(out[0].payload.td.id, 'urn:museum:device:sim-bme280-03');
  assert.deepEqual(Object.keys(out[0].payload).sort(), ['deviceId', 'gatewayId', 'td', 'type', 'zoneId']);
});

const mutate = (change, topic) => {
  const msg = announcementMsg();
  const a = JSON.parse(msg.payload);
  change(a);
  return { topic: topic || msg.topic, payload: JSON.stringify(a) };
};
for (const [label, msg, reason] of [
  ['JSON casse', { topic: 'museum/v1/salle-02/sim-bme280-03/td', payload: '{"deviceId":' }, 'JSON_INVALIDE'],
  ['deviceId invalide', mutate((a) => { a.deviceId = 'a b'; }), 'ANNONCE_INVALIDE'],
  ['type invalide', mutate((a) => { a.type = 'x/y'; }), 'ANNONCE_INVALIDE'],
  ['topic incoherent', mutate(() => {}, 'museum/v1/salle-01/sim-bme280-03/td'), 'TOPIC_INCOHERENT'],
  ['td absente', mutate((a) => { delete a.td; }), 'TD_INVALIDE'],
  ['contexte TD 1.0', mutate((a) => { a.td['@context'] = 'https://www.w3.org/2019/wot/td/v1'; }), 'TD_INVALIDE'],
  ['id de TD d un autre appareil', mutate((a) => { a.td.id = 'urn:museum:device:autre'; }), 'TD_INVALIDE'],
  ['title vide', mutate((a) => { a.td.title = ' '; }), 'TD_INVALIDE'],
]) {
  test(`annonce TD rejetee : ${label}`, () => {
    const { out } = run('fn-td-validate', msg);
    assert.equal(out[0], null);
    assert.equal(out[1].reason, reason);
  });
}

test('aiguillage des reponses de /api/things', () => {
  const announcement = JSON.parse(announcementMsg().payload);
  const route = (statusCode, payload = '{}') => run('fn-td-route', { announcement, statusCode, payload }).out;
  const created = route(201, '{"status":"registered","deviceId":"sim-bme280-03","deviceStatus":"pending"}');
  assert.equal(created[0].result, 'registered (pending)');
  assert.equal(route(200, '{"deviceStatus":"active"}')[0].result, 'updated (active)');
  for (const c of [400, 403, 422]) assert.match(route(c)[1].reason, new RegExp(`^ANNONCE_REJETEE_${c}$`));
  for (const c of [0, 409, 500]) assert.ok(route(c)[2], `code ${c} reessaye`);
  assert.equal(route(401)[3].reason, 'JETON_REFUSE_401');
});

test('nouvel essai d annonce : meme corps, attente croissante, abandon', () => {
  const announcement = JSON.parse(announcementMsg().payload);
  const first = run('fn-td-retry', { announcement, attempt: 1, retryReason: 'HTTP 503' }).out;
  assert.deepEqual(first[0].payload, announcement);
  assert.equal(first[0].delay, 4000);
  assert.equal(first[0].headers['X-Service-Token'], 'jeton-de-test');
  assert.match(run('fn-td-retry', { announcement, attempt: 3, retryReason: 'HTTP 503' }).out[1].reason, /^ABANDON_ANNONCE_APRES_3_ESSAIS$/);
});

test('erreur reseau (TD) : code 0 puis nouvel essai', () => {
  const marked = run('fn-td-network-error', { error: { message: 'ECONNREFUSED' } }).out[0];
  assert.equal(marked.statusCode, 0);
  const announcement = JSON.parse(announcementMsg().payload);
  assert.match(run('fn-td-route', { ...marked, announcement }).out[2].retryReason, /ECONNREFUSED/);
});
