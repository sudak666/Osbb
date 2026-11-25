import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPurchaseExportRows, buildPurchaseList, hasMinimums, isBelowMinimum, isLowStock, lowWithoutMinimum, parseMinQuantity, purchaseListTotal, spendByMonth, usageByCategory,
} from '../src/sklad-purchasing.js';

test('parseMinQuantity accepts empty, integers and decimal commas only', () => {
  assert.equal(parseMinQuantity(''), null);
  assert.equal(parseMinQuantity('  '), null);
  assert.equal(parseMinQuantity('5'), 5);
  assert.equal(parseMinQuantity('2,5'), 2.5);
  assert.equal(parseMinQuantity('-1'), 'invalid');
  assert.equal(parseMinQuantity('5 шт'), 'invalid');
});

test('only non-internal items with a minimum and a lower stock need buying', () => {
  assert.equal(isBelowMinimum({ id: 1, name: 'a', quantity: 2, min_quantity: 5 }), true);
  assert.equal(isBelowMinimum({ id: 2, name: 'b', quantity: 5, min_quantity: 5 }), false);
  assert.equal(isBelowMinimum({ id: 3, name: 'c', quantity: 0, min_quantity: null }), false);
  assert.equal(isBelowMinimum({ id: 4, name: 'd', quantity: 0, min_quantity: 2, is_internal: true }), false);
  assert.equal(hasMinimums([{ id: 1, name: 'a', quantity: 0 }]), false);
});

test('isLowStock uses the minimum when set and the 3-unit fallback otherwise', () => {
  assert.equal(isLowStock({ id: 1, name: 'a', quantity: 4, min_quantity: 5 }), true);
  assert.equal(isLowStock({ id: 2, name: 'b', quantity: 2, min_quantity: 1 }), false);
  assert.equal(isLowStock({ id: 3, name: 'c', quantity: 3 }), true);
  assert.equal(isLowStock({ id: 4, name: 'd', quantity: 0, min_quantity: null }), true);
  assert.equal(isLowStock({ id: 5, name: 'e', quantity: 4 }), false);
  assert.equal(isLowStock({ id: 6, name: 'f', quantity: 0, is_internal: true }), false);
  const unset = lowWithoutMinimum([
    { id: 1, name: 'a', quantity: 2 },
    { id: 2, name: 'b', quantity: 0 },
    { id: 3, name: 'c', quantity: 1, min_quantity: 5 },
    { id: 4, name: 'd', quantity: 9 },
  ]);
  assert.deepEqual(unset.map((i) => i.id), [2, 1]);
});

test('purchase list computes need, cost and the latest supplier', () => {
  const items = [
    { id: 1, name: 'Лампа', category: 'Електрика', unit: 'шт', quantity: 1, min_quantity: 6, price_unit: 32 },
    { id: 2, name: 'Мило', category: 'Прибирання', unit: 'л', quantity: -2, min_quantity: 3, price_unit: null },
    { id: 3, name: 'Кабель', category: 'Електрика', quantity: 50, min_quantity: 10, price_unit: 20 },
  ];
  const receipts = [
    { item_id: 1, quantity: 10, supplier: 'Епіцентр', received_at: '2026-07-01T10:00:00Z' },
    { item_id: 1, quantity: 5, supplier: 'Rozetka', received_at: '2026-08-01T10:00:00Z' },
  ];
  const rows = buildPurchaseList(items, receipts);
  assert.deepEqual(rows.map(r => [r.name, r.need, r.cost, r.supplier]), [['Лампа', 5, 160, 'Rozetka'], ['Мило', 3, 0, '']]);
  assert.deepEqual(purchaseListTotal(rows), { cost: 160, unpriced: 1 });
  assert.equal(buildPurchaseExportRows(rows)[0]['Докупити'], 5);
});

test('spendByMonth buckets purchases and issues into the last 12 months', () => {
  const items = [{ id: 1, name: 'a', quantity: 0, price_unit: 10 }];
  const months = spendByMonth(
    [{ item_id: 1, quantity: 3, received_at: '2026-10-05T10:00:00Z' }, { item_id: 1, quantity: 2, received_at: '2026-10-06T10:00:00Z', purchase_price_unit: 15 }, { item_id: 1, quantity: 9, received_at: '2024-01-01T00:00:00Z' }],
    [{ item_id: 1, quantity: 4, issued_at: '2026-11-02T10:00:00Z' }],
    items, new Date(2026, 10, 15),
  );
  assert.equal(months.length, 12);
  assert.equal(months.at(-1).key, '2026-11');
  assert.deepEqual(months.at(-2), { key: '2026-10', label: 'жов 26', purchased: 60, used: 0 });
  assert.equal(months.at(-1).used, 40);
});

test('usageByCategory sums issued value per category since a date', () => {
  const items = [{ id: 1, name: 'a', category: 'Електрика', quantity: 0, price_unit: 10 }, { id: 2, name: 'b', quantity: 0, price_unit: 5 }];
  const usage = usageByCategory([
    { item_id: 1, quantity: 2, issued_at: '2026-11-01T00:00:00Z' },
    { item_id: 2, quantity: 10, issued_at: '2026-11-01T00:00:00Z' },
    { item_id: 1, quantity: 100, issued_at: '2020-01-01T00:00:00Z' },
  ], items, new Date(2026, 0, 1));
  assert.deepEqual(usage, [{ category: 'Інше', amount: 50 }, { category: 'Електрика', amount: 20 }]);
});
