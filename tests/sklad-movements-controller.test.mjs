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
