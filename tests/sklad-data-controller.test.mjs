import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladDataController } from '../src/sklad-data-controller.js';

function query(result) {
  const chain = {
    select: () => chain,
    order: () => chain,
    limit: async () => result,
    range: async () => result,
  };
  return chain;
}

function makeController(results = {}) {
  const received = { items: [], logs: [], receipts: [] };
  const messages = [];
  const elements = new Map();
  const document = {
    activeElement: null,
    getElementById: id => elements.get(id) ?? null,
    querySelector: () => null,
    addEventListener: () => {},
  };
  const db = {
    from: table => query(results[table] ?? { data: [], error: null }),
    channel: () => ({ on() { return this; }, subscribe() {} }),
  };
  const controller = createSkladDataController({
    db,
    document,
    window: { matchMedia: () => ({ matches: false }) },
    toast: (message, type) => messages.push([message, type]),
    iconHtml: name => `<i>${name}</i>`,
    skeletonRows: () => 'rows',
    skeletonStack: () => 'stack',
    loadSupplierTags: async () => {},
    onItems: value => { received.items = value; },
    onLogs: value => { received.logs = value; },
    onReceipts: value => { received.receipts = value; },
  });
  return { controller, document, elements, messages, received };
}

test('data controller normalizes and publishes inventory collections', async () => {
  const { controller, received } = makeController({
    inventory_items: { data: [{ id: 1, name: 'Кабель', quantity: 2, unit: 'м' }], error: null },
    inventory_logs: { data: [{ id: 2, item_id: 1, item_name: 'Кабель', quantity: 1, issued_at: '2026-08-08T10:00:00Z' }], error: null },
    inventory_receipts: { data: [{ id: 3, item_id: 1, item_name: 'Кабель', quantity: 4, received_at: '2026-08-08T11:00:00Z' }], error: null },
  });
  await controller.loadItems();
  await controller.loadLogs();
  await controller.loadReceipts();
  assert.equal(received.items[0].name, 'Кабель');
  assert.equal(received.logs[0].id, 2);
  assert.equal(received.receipts[0].id, 3);
});

test('refresh reports a failed required load and always releases its button', async () => {
  const { controller, elements, messages } = makeController({
    inventory_items: { data: null, error: { message: 'offline' } },
  });
  const button = { disabled: false, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  elements.set('refreshBtn', button);
  assert.equal(await controller.refreshAll(), false);
  assert.equal(button.disabled, false);
  assert.equal(button.attributes['aria-busy'], 'false');
  assert.deepEqual(messages[0], ['Товари не завантажились: немає зʼєднання з сервером. Спробуйте «Оновити».', 'error']);
});

test('receipt failure renders a readable error with retry without rejecting refresh flow', async () => {
  const { controller, elements, messages } = makeController({
    inventory_receipts: { data: null, error: { message: 'relation "inventory_receipts" does not exist', code: '42P01' } },
  });
  const table = { innerHTML: '' };
  const mobile = { innerHTML: '' };
  elements.set('recTable', table);
  elements.set('recMobileList', mobile);
  await controller.loadReceipts();
  assert.match(table.innerHTML, /Помилка сервера/);
  assert.match(mobile.innerHTML, /data-receipts-retry/);
  assert.doesNotMatch(mobile.innerHTML, /inventory_receipts|002_receipts_table/);
  assert.deepEqual(messages.at(-1), ['Надходження не завантажились: помилка сервера.', 'error']);
});

test('fetchAllPages reads every page instead of silently truncating', async () => {
  const { fetchAllPages } = await import('../src/sklad-data-controller.js');
  const ranges = [];
  const rows = Array.from({ length: 5 }, (_, id) => ({ id }));
  const result = await fetchAllPages(() => ({ range: async (from, to) => { ranges.push([from, to]); return { data: rows.slice(from, to + 1), error: null }; } }), 2);
  assert.deepEqual(result, { data: rows, error: null });
  assert.deepEqual(ranges, [[0, 1], [2, 3], [4, 5]]);
});

test('loadErrorMessage hides transport details', async () => {
  const { loadErrorMessage } = await import('../src/sklad-data-controller.js');
  assert.equal(loadErrorMessage({ message: 'TypeError: Failed to fetch', code: '' }), 'Немає зʼєднання з сервером');
  assert.equal(loadErrorMessage({ message: 'relation does not exist', code: '42P01' }), 'Помилка сервера');
});
