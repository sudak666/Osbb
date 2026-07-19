import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateInventoryStats,
  estimatedItemValue,
  filterInventoryItems,
  isLowStockItem,
  normalizeSearchText,
  valuesMatchSearch,
} from '../src/sklad-domain.js';

const items = [
  { id: 1, name: 'Лампа LED', category: 'Електрика', quantity: 2, unit: 'шт', min_quantity: 3, is_internal: false, price_unit: 120.5 },
  { id: 2, name: 'Віник', category: 'Прибирання', quantity: 10, unit: 'шт', min_quantity: 2, is_internal: false, price_unit: null },
  { id: 3, name: 'Ноутбук офісний', category: 'Оргтехніка', quantity: 1, unit: 'шт', min_quantity: 5, is_internal: true, price_unit: 15000 },
  { id: 4, name: 'Кабель HDMI', category: 'Електрика', quantity: 4.555, unit: 'м', min_quantity: null, is_internal: false, price_unit: 30 },
];

test('normalizeSearchText collapses whitespace and handles Ukrainian case-insensitive search', () => {
  assert.equal(normalizeSearchText('  ЛАМПА   Led  '), 'лампа led');
  assert.equal(valuesMatchSearch(['Електрика', 'Лампа LED'], 'лампа'), true);
  assert.equal(valuesMatchSearch(['Електрика', 'Лампа LED'], 'сантехніка'), false);
});

test('filterInventoryItems combines internal-use flags, category and text search', () => {
  assert.deepEqual(filterInventoryItems(items, { hideInternal: true }).map((item) => item.id), [4, 1, 2]);
  assert.deepEqual(filterInventoryItems(items, { onlyInternal: true }).map((item) => item.id), [3]);
  assert.deepEqual(filterInventoryItems(items, { category: 'Електрика', query: 'кабель' }).map((item) => item.id), [4]);
});

test('low-stock logic excludes internal items and missing minimums', () => {
  assert.equal(isLowStockItem(items[0]), true);
  assert.equal(isLowStockItem(items[2]), false);
  assert.equal(isLowStockItem(items[3]), false);
});

test('estimatedItemValue rounds money and ignores invalid values', () => {
  assert.equal(estimatedItemValue(items[0]), 241);
  assert.equal(estimatedItemValue(items[3]), 136.65);
  assert.equal(estimatedItemValue({ quantity: -1, price_unit: 100 }), 0);
});

test('calculateInventoryStats summarizes quantity, value, categories and low stock', () => {
  assert.deepEqual(calculateInventoryStats(items), {
    totalItems: 4,
    externalItems: 3,
    internalItems: 1,
    lowStockItems: 1,
    totalQuantity: 17.56,
    estimatedValue: 15377.65,
    categories: ['Електрика', 'Оргтехніка', 'Прибирання'],
  });
});
