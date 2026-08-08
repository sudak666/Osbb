import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladDataController } from '../src/sklad-data-controller.js';

function query(result) {
  const chain = {
    select: () => chain,
    order: () => chain,
    limit: async () => result,
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
  assert.deepEqual(messages[0], ['Товари не завантажились: offline', 'error']);
});

test('receipt failure renders migration guidance without rejecting refresh flow', async () => {
  const { controller, elements, messages } = makeController({
    inventory_receipts: { data: null, error: { message: 'missing table' } },
  });
  const table = { innerHTML: '' };
  const mobile = { innerHTML: '' };
  elements.set('recTable', table);
  elements.set('recMobileList', mobile);
  await controller.loadReceipts();
  assert.match(table.innerHTML, /missing table/);
  assert.match(mobile.innerHTML, /002_receipts_table\.sql/);
  assert.deepEqual(messages.at(-1), ['Прихід: missing table', 'error']);
});
