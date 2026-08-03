import test from 'node:test';
import assert from 'node:assert/strict';

import {
    adjustedStockAfterMovementEdit,
    buildIssueEditPatch,
    buildIssuePayload,
    buildReceiptPayload,
    buildReceiptEditPatch,
    filterInventoryLogs,
    filterInventoryReceipts,
} from '../src/sklad-movements.js';

test('buildIssuePayload нормалізує та перевіряє дані видачі', () => {
    assert.deepEqual(buildIssuePayload({ itemId: '4', quantity: '2.5', person: ' Іван ', note: '  ', occurredAt: '2026-08-03T00:00:00Z' }), {
        ok: true,
        value: { itemId: 4, quantity: 2.5, person: 'Іван', note: null, occurredAt: '2026-08-03T00:00:00Z' },
    });
    assert.deepEqual(buildIssuePayload({ itemId: '', quantity: 1, person: 'Іван' }), { ok: false, error: 'item' });
    assert.deepEqual(buildIssuePayload({ itemId: 1, quantity: 0, person: 'Іван' }), { ok: false, error: 'quantity' });
    assert.deepEqual(buildIssuePayload({ itemId: 1, quantity: 1, person: ' ' }), { ok: false, error: 'person' });
});

test('buildReceiptPayload нормалізує та перевіряє дані приходу', () => {
    assert.deepEqual(buildReceiptPayload({ itemId: 2, quantity: '3', purchasePrice: '12.50', supplier: ' Склад ', note: '' }), {
        ok: true,
        value: { itemId: 2, quantity: 3, purchasePrice: 12.5, supplier: 'Склад', note: null, occurredAt: null },
    });
    assert.equal(buildReceiptPayload({ itemId: 2, quantity: 3, purchasePrice: '' }).ok, true);
    assert.deepEqual(buildReceiptPayload({ itemId: 2, quantity: 3, purchasePrice: -1 }), { ok: false, error: 'price' });
    assert.deepEqual(buildReceiptPayload({ itemId: 2, quantity: Number.NaN, purchasePrice: null }), { ok: false, error: 'quantity' });
});

test('builders редагування формують готові patch-обʼєкти', () => {
    assert.deepEqual(buildIssueEditPatch({ quantity: '0', person: ' Петро ', note: '', occurredAt: '2026-08-03T10:00:00Z' }), {
        ok: true,
        value: { quantity: 0, issued_to: 'Петро', note: null, issued_at: '2026-08-03T10:00:00Z' },
    });
    assert.deepEqual(buildReceiptEditPatch({ quantity: '4', purchasePrice: '', supplier: ' ', note: ' Накладна ' }), {
        ok: true,
        value: { quantity: 4, purchase_price_unit: null, supplier: null, note: 'Накладна' },
    });
    assert.deepEqual(buildIssueEditPatch({ quantity: -1 }), { ok: false, error: 'quantity' });
    assert.deepEqual(buildReceiptEditPatch({ quantity: 1, purchasePrice: Number.NaN }), { ok: false, error: 'price' });
});

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

test('adjustedStockAfterMovementEdit коригує залишок після редагування видачі', () => {
    assert.equal(adjustedStockAfterMovementEdit(8, 2, 5, 'issue'), 5);
    assert.equal(adjustedStockAfterMovementEdit(8, 5, 2, 'issue'), 11);
    assert.equal(adjustedStockAfterMovementEdit(1, 2, 5, 'issue'), null);
});

test('adjustedStockAfterMovementEdit коригує залишок після редагування приходу', () => {
    assert.equal(adjustedStockAfterMovementEdit(8, 2, 5, 'receipt'), 11);
    assert.equal(adjustedStockAfterMovementEdit(8, 5, 2, 'receipt'), 5);
    assert.equal(adjustedStockAfterMovementEdit(2, 5, 1, 'receipt'), null);
    assert.equal(adjustedStockAfterMovementEdit('invalid', 1, 2, 'receipt'), null);
});
