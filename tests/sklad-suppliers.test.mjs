import test from 'node:test';
import assert from 'node:assert/strict';

import { hasSupplierTag, mergeSupplierTags, normalizeSupplierTag, supplierTagKey, supplierTagsFromResponse } from '../src/sklad-suppliers.js';

test('supplierTagsFromResponse перевіряє хмарні теги постачальників', () => {
    assert.deepEqual(supplierTagsFromResponse([
        { name: '  Епіцентр ' },
        { name: 'епіцентр' },
        { name: 42 },
        null,
    ]), ['Епіцентр']);
    assert.deepEqual(supplierTagsFromResponse({ data: [] }), []);
});

test('normalizeSupplierTag очищає пробіли в назві', () => {
    assert.equal(normalizeSupplierTag('  Нова   Лінія  '), 'Нова Лінія');
    assert.equal(normalizeSupplierTag(null), '');
    assert.equal(supplierTagKey('  ЕПІЦЕНТР '), 'епіцентр');
});

test('mergeSupplierTags обʼєднує локальні та хмарні теги без дублів', () => {
    assert.deepEqual(mergeSupplierTags([
        ['Епіцентр', 'Нова Лінія'],
        [' епіцентр ', 'Rozetka', '', null],
    ]), ['Епіцентр', 'Нова Лінія', 'Rozetka']);
});

test('mergeSupplierTags дотримується заданого ліміту', () => {
    assert.deepEqual(mergeSupplierTags([['A', 'B', 'C']], 2), ['A', 'B']);
});

test('hasSupplierTag порівнює назви без урахування регістру та пробілів', () => {
    assert.equal(hasSupplierTag(['Нова Лінія'], ' нова   лінія '), true);
    assert.equal(hasSupplierTag(['Нова Лінія'], 'Rozetka'), false);
    assert.equal(hasSupplierTag([], ''), false);
});
