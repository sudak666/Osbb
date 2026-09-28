import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladMovementsController } from '../src/sklad-movements-controller.js';

test('movements controller normalizes pending operation ids', () => {
  const controller = createSkladMovementsController({ db: {} });
  assert.equal(controller.setPending('editingLogId', '7'), true);
  assert.equal(controller.pending('editingLogId'), 7);
  controller.setPending('editingLogId', 'bad');
  assert.equal(controller.pending('editingLogId'), null);
});

test('movements controller maps delete transport failures to retryable network state', async () => {
  const warnings = [];
  const controller = createSkladMovementsController({ db: { rpc: async () => ({ data: null, error: { message: 'offline' } }) }, warn: (...args) => warnings.push(args) });
  assert.deepEqual(await controller.runDelete('delete_inventory_log', { p_log_id: 1 }), { ok: false, reason: 'network' });
  assert.equal(warnings.length, 1);
});

test('movements controller opens and completes guarded log deletion', async () => {
  const elements = { delLogItemName: { textContent: '' } };
  let modal = null;
  let pinAction = null;
  let loads = 0;
  const controller = createSkladMovementsController({
    db: { rpc: async () => ({ data: { ok: true }, error: null }) },
    document: { getElementById: id => elements[id] },
    getItems: () => [{ id: 2, unit: 'шт' }],
    getLogs: () => [{ id: 7, item_id: 2, item_name: 'Лампа', quantity: 1, issued_to: 'Іван' }],
    openModal: id => { modal = id; }, closeModal() {}, requestDeletePin: (_title, action) => { pinAction = action; },
    loadItems: async () => { loads++; }, loadLogs: async () => { loads++; }, toast() {},
  });
  controller.openDeleteLog(7);
  assert.equal(modal, 'delLogModal');
  assert.match(elements.delLogItemName.textContent, /Лампа · 1 шт · Іван/);
  await controller.confirmDeleteLog();
  assert.deepEqual(await pinAction('1234'), { ok: true });
  assert.equal(loads, 2);
  assert.equal(controller.pending('deletingLogId'), null);
});

test('issue reuses the request id after a transport failure and rotates it after a server answer', async () => {
  const calls = [];
  const replies = [
    { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } },
    { data: [{ new_quantity: 4, item_name: 'Лампа', unit: 'шт' }], error: null },
    { data: [{ new_quantity: 3, item_name: 'Лампа', unit: 'шт' }], error: null },
  ];
  let seq = 0;
  const toasts = [];
  const controller = createSkladMovementsController({
    db: { rpc: async (name, args) => { calls.push({ name, args }); return replies.shift(); } },
    getItems: () => [{ id: 2, name: 'Лампа', unit: 'шт', quantity: 5 }],
    toast: (message, type) => toasts.push({ message, type }),
    createRequestId: () => `req-${++seq}`,
  });
  assert.equal(await controller.issueItem(2, 1, 'Іван', '', null), false);
  assert.match(toasts[0].message, /дубля не буде/);
  assert.equal(await controller.issueItem(2, 1, 'Іван', '', null), true);
  assert.equal(await controller.issueItem(2, 1, 'Іван', '', null), true);
  assert.deepEqual(calls.map(call => call.args.p_client_request_id), ['req-1', 'req-1', 'req-2']);
  assert.equal(calls.every(call => call.name === 'issue_item'), true);
});

test('issue maps server errors to readable messages and drops the request id', async () => {
  const calls = [];
  const toasts = [];
  let seq = 0;
  const controller = createSkladMovementsController({
    db: { rpc: async (_name, args) => { calls.push(args); return { data: null, error: { message: 'item_not_found', code: 'P0001' } }; } },
    getItems: () => [{ id: 2, name: 'Лампа', unit: 'шт', quantity: 5 }],
    toast: message => toasts.push(message),
    createRequestId: () => `req-${++seq}`,
  });
  assert.equal(await controller.issueItem(2, 1, 'Іван', '', null), false);
  assert.equal(await controller.issueItem(2, 1, 'Іван', '', null), false);
  assert.deepEqual(toasts, ['Товар не знайдено — оновіть список.', 'Товар не знайдено — оновіть список.']);
  assert.deepEqual(calls.map(args => args.p_client_request_id), ['req-1', 'req-2']);
});
