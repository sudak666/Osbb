import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROMIN_BASE_URL,
  PROMIN_DU_PULSE_MS,
  createProminClient,
  createProminPolling,
  parseEquipmentState,
  parsePultState,
} from '../src/promin-api.js';

function jsonResponse(data, overrides = {}) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => data, ...overrides };
}

test('parsePultState normalizes houses, alarms and connection loss', () => {
  const result = parsePultState({
    pults: [{ GlobalID: 'p1' }],
    streetAndHouses: [
      { GlobalID: 10, Caption: 'Будинок 10', Alarmed: '-1', Color: '0' },
      { GlobalID: '11', Caption: 'Будинок 11', Alarmed: '0', Color: '12615935' },
      { Caption: 'Без ID' },
    ],
  });

  assert.equal(result.pults.length, 1);
  assert.deepEqual(result.houses, [
    { globalId: '10', caption: 'Будинок 10', alarmed: true, disconnected: false },
    { globalId: '11', caption: 'Будинок 11', alarmed: false, disconnected: true },
  ]);
});

test('parseEquipmentState safely handles Calls and HTML fields', () => {
  assert.deepEqual(parseEquipmentState({
    AvariasAsHtml: '<b>Аварія</b>', TemperatureAsHtml: '21 °C', Calls: [{ id: 1 }, null, 'bad'],
    Updated: '12:00', CurrentWindow: 'main',
  }), {
    avariasAsHtml: '<b>Аварія</b>', temperatureAsHtml: '21 °C', calls: [{ id: '1' }],
    updated: '12:00', currentWindow: 'main',
  });
});

test('Promin boundaries limit malicious HTML, nested calls and oversized identifiers', async () => {
  const state = parseEquipmentState({
    AvariasAsHtml: '<img src=x onerror=alert(1)>',
    TemperatureAsHtml: 'x'.repeat(20_001),
    Calls: [
      { id: 1, nested: { html: '<script>alert(1)</script>' }, payload: '<svg onload=alert(1)>' },
      ...Array.from({ length: 205 }, (_, id) => ({ id })),
    ],
    Updated: 'x'.repeat(201),
  });
  assert.equal(state.avariasAsHtml, '<img src=x onerror=alert(1)>');
  assert.equal(state.temperatureAsHtml, '');
  assert.deepEqual(state.calls[0], { id: '1', payload: '<svg onload=alert(1)>' });
  assert.equal(state.calls.length, 200);
  assert.equal(state.updated, '');

  const pults = parsePultState({
    pults: [{ GlobalID: 'p1', nested: { attack: true } }],
    streetAndHouses: [{ GlobalID: 'x'.repeat(101), Caption: 'bad' }, { GlobalID: 'ok', Caption: 'x'.repeat(301) }],
  });
  assert.deepEqual(pults.pults, [{ GlobalID: 'p1' }]);
  assert.deepEqual(pults.houses, [{ globalId: 'ok', caption: '', alarmed: false, disconnected: false }]);

  const client = createProminClient({ fetcher: async () => jsonResponse({}) });
  await assert.rejects(() => client.getEquipmentState('x'.repeat(101)), /валідний ID/);
  await assert.rejects(() => client.executeDU('x'.repeat(101), 'On'), /валідний ID/);
});

test('client sends GET JSON requests to configured Promin endpoints', async () => {
  const calls = [];
  const client = createProminClient({
    baseUrl: `${PROMIN_BASE_URL}/`,
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(url.includes('pultState') ? { pults: [], streetAndHouses: [] } : { Calls: [] });
    },
  });

  await client.getPultState(2);
  await client.getEquipmentState('obor 7');

  assert.equal(calls[0].url, 'http://192.168.0.11/pultState?tab=2');
  assert.equal(calls[1].url, 'http://192.168.0.11/oborState?obor=obor+7');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.Accept, 'application/json');
});

test('executeDU sends Down, waits five seconds and sends Up', async () => {
  const sequence = [];
  const client = createProminClient({
    fetcher: async (url) => { sequence.push(url); return jsonResponse({ ok: true }); },
    sleep: async (milliseconds) => { sequence.push(milliseconds); },
  });

  await client.executeDU('42', 'On');

  assert.equal(sequence[0], 'http://192.168.0.11/du?action=On&state=Down&obor=42');
  assert.equal(sequence[1], PROMIN_DU_PULSE_MS);
  assert.equal(sequence[2], 'http://192.168.0.11/du?action=On&state=Up&obor=42');
  await assert.rejects(() => client.executeDU('42', 'Invalid'), /On або Off/);
});

test('client validates IDs and reports HTTP and JSON errors', async () => {
  const client = createProminClient({ fetcher: async () => jsonResponse(null) });
  await assert.rejects(() => client.getPultState(-1), /tabIndex/);
  await assert.rejects(() => client.getEquipmentState(''), /ID обладнання/);

  const httpClient = createProminClient({ fetcher: async () => jsonResponse(null, { ok: false, status: 503, statusText: 'Offline' }) });
  await assert.rejects(() => httpClient.getPultState(), /HTTP 503 Offline/);

  const invalidJsonClient = createProminClient({ fetcher: async () => jsonResponse(null, { json: async () => { throw new SyntaxError('bad'); } }) });
  await assert.rejects(() => invalidJsonClient.getPultState(), /некоректний JSON/);
});

test('polling exposes immediate manual polls and reports errors', async () => {
  const received = [];
  const errors = [];
  const client = {
    getPultState: async () => ({ pults: [], houses: [] }),
    getEquipmentState: async (id) => id === 'bad' ? Promise.reject(new Error('offline')) : ({ calls: [] }),
  };
  const polling = createProminPolling(client, {
    onPultState: (state) => received.push(['pult', state]),
    onEquipmentState: (state, id) => received.push([id, state]),
    onError: (error, source) => errors.push([source, error.message]),
  });

  await polling.pollPults();
  polling.selectEquipment('ok');
  await new Promise((resolve) => setImmediate(resolve));
  polling.selectEquipment('bad');
  await new Promise((resolve) => setImmediate(resolve));
  polling.stop();

  assert.equal(received.some(([source]) => source === 'pult'), true);
  assert.equal(received.some(([source]) => source === 'ok'), true);
  assert.deepEqual(errors, [['oborState', 'offline']]);
});
