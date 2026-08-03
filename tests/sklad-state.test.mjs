import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inventoryItemsFromResponse,
  inventoryLogsFromResponse,
  inventoryReceiptsFromResponse,
} from '../src/sklad-state.js';

test('Sklad response boundaries accept only arrays of row objects', () => {
  const item = { id: 1, name: 'Лампа' };

  assert.deepEqual(inventoryItemsFromResponse([item, null, 'invalid', []]), [item]);
  assert.deepEqual(inventoryLogsFromResponse(null), []);
  assert.deepEqual(inventoryReceiptsFromResponse({ data: [] }), []);
});
