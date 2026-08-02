import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMoney,
  isPurchasePriceSchemaError,
  itemPriceValue,
  itemStockValue,
  parseOptionalPrice,
} from '../src/sklad-pricing.js';

test('parseOptionalPrice accepts decimal comma and rejects invalid prices', () => {
  assert.equal(parseOptionalPrice(' 12,345 '), 12.35);
  assert.equal(parseOptionalPrice(''), null);
  assert.equal(Number.isNaN(parseOptionalPrice('0')), true);
  assert.equal(Number.isNaN(parseOptionalPrice('невідомо')), true);
});

test('price helpers safely handle incomplete inventory values', () => {
  assert.equal(itemPriceValue({ price_unit: '25.5' }), 25.5);
  assert.equal(itemPriceValue({ price_unit: -1 }), 0);
  assert.equal(itemStockValue({ price_unit: 25.5, quantity: 4 }), 102);
  assert.equal(itemStockValue({ price_unit: 25.5, quantity: 'невідомо' }), 0);
});

test('formatMoney preserves the Sklad empty-price marker and UAH formatting', () => {
  assert.equal(formatMoney(null), '—');
  assert.equal(formatMoney(-5), '—');
  assert.match(formatMoney(120.5), /121\s*₴/u);
  assert.match(formatMoney(12.5), /12,50\s*₴/u);
});

test('schema error detection only accepts known purchase-price failures', () => {
  assert.equal(isPurchasePriceSchemaError({ message: 'column purchase_price_unit does not exist' }), true);
  assert.equal(isPurchasePriceSchemaError({ message: 'RPC receive_item was not found' }), true);
  assert.equal(isPurchasePriceSchemaError({ message: 'network unavailable' }), false);
  assert.equal(isPurchasePriceSchemaError(null), false);
});
