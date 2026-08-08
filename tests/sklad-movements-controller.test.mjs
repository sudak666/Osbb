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
