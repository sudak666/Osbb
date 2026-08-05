import test from 'node:test';
import assert from 'node:assert/strict';

import { auditIdFromInsertResponse, calculateAuditSummary, createAuditData, parseAuditQuantity } from '../src/sklad-audit.js';

const items = [
    { id: 1, quantity: 5 },
    { id: 'second', quantity: 3 },
    { id: 3, quantity: 0 },
];

test('auditIdFromInsertResponse перевіряє ID створеної інвентаризації', () => {
    assert.equal(auditIdFromInsertResponse({ id: 42 }), 42);
    assert.equal(auditIdFromInsertResponse({ id: '42' }), null);
    assert.equal(auditIdFromInsertResponse({ id: Number.NaN }), null);
    assert.equal(auditIdFromInsertResponse(null), null);
});

test('createAuditData створює початковий стан інвентаризації', () => {
    assert.deepEqual(createAuditData(items), { 1: null, second: null, 3: null });
    assert.deepEqual(createAuditData(items, true), { 1: 5, second: 3, 3: 0 });
});

test('parseAuditQuantity безпечно обробляє введену кількість', () => {
    assert.equal(parseAuditQuantity('2.5'), 2.5);
    assert.equal(parseAuditQuantity(' 2,5 '), 2.5);
    assert.equal(parseAuditQuantity('2abc'), null);
    assert.equal(parseAuditQuantity('-1'), null);
    assert.equal(parseAuditQuantity(''), null);
    assert.equal(parseAuditQuantity('invalid'), null);
});

test('calculateAuditSummary рахує прогрес і розбіжності', () => {
    const summary = calculateAuditSummary(items, { 1: 7, second: 2, 3: null });

    assert.equal(summary.counted, 2);
    assert.equal(summary.uncounted, 1);
    assert.equal(summary.surplus, 1);
    assert.equal(summary.shortage, 1);
    assert.equal(summary.progress, 67);
    assert.deepEqual(summary.countedItems.map((item) => item.id), [1, 'second']);
    assert.deepEqual(summary.differenceItems.map((item) => item.id), [1, 'second']);
});

test('calculateAuditSummary обробляє порожній склад', () => {
    assert.deepEqual(calculateAuditSummary([], {}), {
        countedItems: [],
        differenceItems: [],
        counted: 0,
        uncounted: 0,
        surplus: 0,
        shortage: 0,
        progress: 0,
    });
});
