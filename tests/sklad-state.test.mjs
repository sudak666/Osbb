import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inventoryItemsFromResponse,
  inventoryLogsFromResponse,
  inventoryReceiptsFromResponse,
  inventoryUnitFromRpcResponse,
} from '../src/sklad-state.js';

test('inventoryUnitFromRpcResponse перевіряє одиницю з RPC-відповіді', () => {
  assert.equal(inventoryUnitFromRpcResponse([{ unit: '  шт ' }], 'од.'), 'шт');
  assert.equal(inventoryUnitFromRpcResponse([{ unit: '' }], 'од.'), 'од.');
  assert.equal(inventoryUnitFromRpcResponse([{ unit: 5 }], 'од.'), 'од.');
  assert.equal(inventoryUnitFromRpcResponse(null, 'од.'), 'од.');
});

test('inventoryItemsFromResponse validates required fields and normalizes optional fields', () => {
  assert.deepEqual(inventoryItemsFromResponse([
    { id: 1, name: '  Лампа  ', quantity: 2, unit: ' шт ', price_unit: Number.NaN, is_internal: 'yes' },
    { id: '2', name: 'Некоректний товар', quantity: 1, unit: 'шт' },
    { id: 3, name: '   ', quantity: 1, unit: 'шт' },
    { id: 4, name: 'Без одиниці', quantity: 1, unit: '' },
    null,
  ]), [{
    id: 1,
    name: 'Лампа',
    category: null,
    quantity: 2,
    unit: 'шт',
    min_quantity: null,
    photo_url: null,
    created_at: null,
    updated_at: null,
    is_internal: false,
    price_unit: null,
    price_source: null,
    price_url: null,
    price_checked_at: null,
    price_confidence: null,
  }]);
});

test('movement response boundaries reject incomplete and malformed rows', () => {
  const log = { id: 1, item_id: 2, item_name: 'Лампа', quantity: 1, issued_at: '2026-08-03T10:00:00Z' };
  const receipt = { id: 2, item_id: 2, item_name: 'Лампа', quantity: 4, received_at: '2026-08-03T11:00:00Z' };

  assert.deepEqual(inventoryLogsFromResponse([log, { id: 3 }, { ...log, id: 4, issued_at: 'invalid' }]), [{ ...log, issued_to: null, note: null }]);
  assert.deepEqual(inventoryReceiptsFromResponse([receipt, [], { ...receipt, id: 5, received_at: '' }]), [{ ...receipt, purchase_price_unit: null, supplier: null, note: null }]);
  assert.deepEqual(inventoryReceiptsFromResponse({ data: [] }), []);
});
