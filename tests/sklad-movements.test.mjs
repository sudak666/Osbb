import test from 'node:test';
import assert from 'node:assert/strict';

import { filterInventoryLogs, filterInventoryReceipts } from '../src/sklad-movements.js';

const items = [
    { id: 1, category: 'Електрика', unit: 'шт' },
    { id: 2, category: 'Сантехніка', unit: 'комплект' },
];

const logs = [
    { id: 10, item_id: 1, item_name: 'Лампа', issued_to: 'Іван', note: 'Підвал' },
    { id: 11, item_id: 2, item_name: 'Кран', issued_to: 'Петро', note: null },
];

test('filterInventoryLogs фільтрує видачі за категорією', () => {
    assert.deepEqual(filterInventoryLogs(logs, items, '', 'Електрика').map((log) => log.id), [10]);
    assert.deepEqual(filterInventoryLogs(logs, items, '', 'Ремонт'), []);
});

test('filterInventoryLogs шукає за товаром, отримувачем і даними товару', () => {
    assert.deepEqual(filterInventoryLogs(logs, items, 'лампа підвал').map((log) => log.id), [10]);
    assert.deepEqual(filterInventoryLogs(logs, items, 'петро комплект').map((log) => log.id), [11]);
    assert.deepEqual(filterInventoryLogs(logs, items, 'електрика', 'Сантехніка'), []);
});

test('filterInventoryReceipts шукає за товаром, постачальником і приміткою', () => {
    const receipts = [
        { id: 20, item_name: 'Фарба', supplier: 'Епіцентр', note: 'Накладна 12' },
        { id: 21, item_name: 'Рукавиці', supplier: 'Rozetka', note: null },
    ];

    assert.deepEqual(filterInventoryReceipts(receipts, 'епіцентр накладна').map((receipt) => receipt.id), [20]);
    assert.deepEqual(filterInventoryReceipts(receipts, 'рукавиці').map((receipt) => receipt.id), [21]);
    assert.equal(filterInventoryReceipts(receipts).length, 2);
});
