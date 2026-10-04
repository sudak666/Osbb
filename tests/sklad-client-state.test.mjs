import test from 'node:test';
import assert from 'node:assert/strict';
import { PURCHASE_PRICE_RPC_UNAVAILABLE_KEY, SKLAD_THEME_STORAGE_KEY, SUPPLIER_TAGS_STORAGE_KEY, loadStoredSupplierTags, saveStoredSupplierTags } from '../src/sklad-client-state.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

test('stored supplier tags are normalized, deduplicated, and bounded', () => {
  const storage = memoryStorage({ [SUPPLIER_TAGS_STORAGE_KEY]: JSON.stringify(['  Постачальник  ', 'постачальник', '', ...Array.from({ length: 20 }, (_, index) => `Тег ${index}`)]) });
  const tags = loadStoredSupplierTags(storage);
  assert.equal(tags[0], 'Постачальник');
  assert.equal(tags.length, 12);
  assert.equal(saveStoredSupplierTags(storage, [' A ', 'a', 'B']), true);
  assert.deepEqual(JSON.parse(storage.values.get(SUPPLIER_TAGS_STORAGE_KEY)), ['A', 'B']);
});

