import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBalanceExportRows,
  buildInventoryExportRows,
  buildIssueExportRows,
  calculateInventoryValueSummary,
  sortLowStockItems,
  sortUnpricedItems,
  summarizeInventoryCategories,
} from '../src/sklad-reporting.js';

const items = [
  { id: 1, name: 'Лампа', category: 'Електрика', quantity: 2, unit: 'шт', is_internal: false, price_unit: 100, price_source: 'Закупівля', price_checked_at: '2026-08-03T10:00:00Z' },
  { id: 2, name: 'Віник', category: 'Прибирання', quantity: 5, unit: 'шт', is_internal: false, price_unit: null },
  { id: 3, name: 'Рукавиці', category: 'Прибирання', quantity: 0, unit: 'пара', is_internal: true, price_unit: 50 },
];

test('calculateInventoryValueSummary готує загальну та фільтровану статистику', () => {
  assert.deepEqual(calculateInventoryValueSummary(items, [items[0], items[2]]), {
    balanceItems: 2,
    internalItems: 1,
    pricedItems: 2,
    balanceValue: 200,
    filteredValue: 200,
    filteredItems: 2,
    filteredPriced: 2,
    filteredInStock: 1,
    filteredInternal: 1,
  });
});

test('reporting helpers готують категорії та списки проблемних позицій', () => {
  assert.deepEqual(summarizeInventoryCategories(items), [
    { category: 'Електрика', count: 1, percentage: 33 },
    { category: 'Прибирання', count: 2, percentage: 67 },
  ]);
  assert.deepEqual(sortLowStockItems(items).map((item) => item.id), [3, 1]);
  assert.deepEqual(sortUnpricedItems(items).map((item) => item.id), [2]);
});

test('export builders повертають готові рядки для трьох Excel-аркушів', () => {
  const inventoryRows = buildInventoryExportRows(items, 'en-CA');
  assert.equal(inventoryRows[0]['Назва товару'], 'Лампа');
  assert.equal(inventoryRows[0]['Оцінка залишку, грн'], 200);
  assert.equal(inventoryRows[2]['Внутрішнє використання'], 'Так');

  const balanceRows = buildBalanceExportRows(items);
  assert.equal(balanceRows[0]['Значення'], 2);
  assert.equal(balanceRows[3]['Значення'], 200);
  assert.equal(balanceRows[4]['Значення'], 0);

  const issueRows = buildIssueExportRows([{ issued_at: null, item_name: 'Лампа', quantity: 1, issued_to: null, note: null }]);
  assert.deepEqual(issueRows[0], { 'Дата': '', 'Товар': 'Лампа', 'К-сть': 1, 'Кому': '', 'Примітка': '' });
});
