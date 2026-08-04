import test from 'node:test';
import assert from 'node:assert/strict';

import {
  garbageBins,
  garbageMonthBinsTotal,
  garbageMonthKey,
  garbageMonthKeyCandidates,
  garbageYearRowsFromResponse,
  migrateGarbageData,
  normalizeGarbageMonth,
} from '../src/osbb-garbage.js';

test('garbageYearRowsFromResponse перевіряє межу річної відповіді', () => {
  assert.deepEqual(garbageYearRowsFromResponse([
    { month_key: '2026-7', data: { 1: { time: '08:00', worker: 'Іван', types: { bins: '2' } } } },
    { month_key: '2026-07', data: { 32: { types: { bins: 4 } } } },
    { month_key: '2026-12', data: {} },
    { month_key: 202607, data: {} },
    { month_key: '2026-8', data: null },
  ]), [
    { month_key: '2026-7', data: { 1: { time: '08:00', worker: 'Іван', types: { bins: 2 } } } },
    { month_key: '2026-07', data: {} },
  ]);
  assert.deepEqual(garbageYearRowsFromResponse({}), []);
});

test('normalizeGarbageMonth перевіряє дні, записи та кількість', () => {
  assert.deepEqual(normalizeGarbageMonth({
    1: { time: '08:00', worker: 'Іван', types: { bins: '3', glass: -1, unknown: 5 } },
    32: { types: { bins: 2 } },
    bad: 'invalid',
  }), {
    1: { time: '08:00', worker: 'Іван', types: { bins: 3 } },
  });
  assert.deepEqual(normalizeGarbageMonth([]), {});
});

test('garbage month keys preserve legacy and zero-padded lookup formats', () => {
  assert.equal(garbageMonthKey(2026, 7), '2026-7');
  assert.deepEqual(garbageMonthKeyCandidates(2026, 7), ['2026-7', '2026-07']);
  assert.deepEqual(garbageMonthKeyCandidates(2026, 10), ['2026-10']);
});

test('migrateGarbageData converts every legacy garbage type without mutating input', () => {
  const source = {
    '01': { count: '2', note: 'plastic', worker: 'Іван', time: '08:00' },
    '02': { count: 3, note: 'glass' },
    '03': { count: 1, note: 'both' },
    '04': { count: 4, note: 'mixed' },
    '05': { types: { bins: 9 }, worker: 'Олена' },
  };
  const result = migrateGarbageData(source);
  assert.equal(result.migrated, true);
  assert.deepEqual(result.data, {
    '01': { time: '08:00', worker: 'Іван', types: { plastic: 2 } },
    '02': { time: '', worker: '', types: { glass: 3 } },
    '03': { time: '', worker: '', types: { plastic: 1, glass: 1 } },
    '04': { time: '', worker: '', types: { bins: 4 } },
    '05': { types: { bins: 9 }, worker: 'Олена' },
  });
  assert.equal('types' in source['01'], false);
});

test('garbage migration and bin totals fail safely on empty values', () => {
  assert.deepEqual(migrateGarbageData(null), { data: null, migrated: false });
  assert.deepEqual(migrateGarbageData({ '01': { worker: 'Іван' } }), { data: { '01': { worker: 'Іван' } }, migrated: false });
  assert.equal(garbageBins({ bins: '12' }), 12);
  assert.equal(garbageBins({ bins: 'невідомо' }), 0);
  assert.equal(garbageBins(null), 0);
  assert.equal(garbageMonthBinsTotal({
    1: { types: { bins: '3' } },
    2: { count: '4', note: 'mixed' },
    3: null,
    32: { types: { bins: 100 } },
  }), 7);
  assert.equal(garbageMonthBinsTotal([]), 0);
});
