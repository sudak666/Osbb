import test from 'node:test';
import assert from 'node:assert/strict';
import { PURCHASE_PRICE_RPC_UNAVAILABLE_KEY, SKLAD_THEME_STORAGE_KEY, SUPPLIER_TAGS_STORAGE_KEY, loadPurchasePriceRpcAvailable, loadStoredSupplierTags, markPurchasePriceRpcUnavailable, nextSkladTheme, saveSkladTheme, saveStoredSupplierTags } from '../src/sklad-client-state.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

test('purchase-price capability flag preserves fallback behavior', () => {
  const storage = memoryStorage();
  assert.equal(loadPurchasePriceRpcAvailable(storage), true);
  assert.equal(markPurchasePriceRpcUnavailable(storage), true);
  assert.equal(storage.values.get(PURCHASE_PRICE_RPC_UNAVAILABLE_KEY), '1');
  assert.equal(loadPurchasePriceRpcAvailable(storage), false);
});

test('stored supplier tags are normalized, deduplicated, and bounded', () => {
  const storage = memoryStorage({ [SUPPLIER_TAGS_STORAGE_KEY]: JSON.stringify(['  Постачальник  ', 'постачальник', '', ...Array.from({ length: 20 }, (_, index) => `Тег ${index}`)]) });
  const tags = loadStoredSupplierTags(storage);
  assert.equal(tags[0], 'Постачальник');
  assert.equal(tags.length, 12);
  assert.equal(saveStoredSupplierTags(storage, [' A ', 'a', 'B']), true);
  assert.deepEqual(JSON.parse(storage.values.get(SUPPLIER_TAGS_STORAGE_KEY)), ['A', 'B']);
});

test('client settings fail closed when storage is malformed or unavailable', () => {
  assert.deepEqual(loadStoredSupplierTags(memoryStorage({ [SUPPLIER_TAGS_STORAGE_KEY]: '{' })), []);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(loadPurchasePriceRpcAvailable(blocked), true);
  assert.equal(markPurchasePriceRpcUnavailable(blocked), false);
  assert.equal(saveStoredSupplierTags(blocked, ['A']), false);
  assert.equal(saveSkladTheme(blocked, 'theme-dark'), false);
});

test('theme helpers only persist known themes', () => {
  const storage = memoryStorage();
  assert.equal(nextSkladTheme('theme-light'), 'theme-dark');
  assert.equal(nextSkladTheme('theme-dark'), 'theme-light');
  assert.equal(saveSkladTheme(storage, 'theme-dark'), true);
  assert.equal(storage.values.get(SKLAD_THEME_STORAGE_KEY), 'theme-dark');
  assert.equal(saveSkladTheme(storage, 'neon'), false);
});
