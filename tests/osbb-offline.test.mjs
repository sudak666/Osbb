import test from 'node:test';
import assert from 'node:assert/strict';

import {
  osbbOfflineMonthKey,
  readOsbbOfflineValue,
  removeOsbbOfflineValue,
  writeOsbbOfflineValue,
} from '../src/osbb-offline.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test('OSBB offline keys preserve existing domain formats', () => {
  assert.equal(osbbOfflineMonthKey('att', 2026, 0), 'att_2026_0');
  assert.equal(osbbOfflineMonthKey('garbage', 2026, 11), 'garbage_2026_11');
  assert.equal(osbbOfflineMonthKey('dispatcher', 2026, 7), 'dispatcher_2026_7');
  assert.equal(osbbOfflineMonthKey('elevator', 2026, 7), 'elevator_2026_7');
});

test('OSBB offline keys reject unknown scopes and invalid calendar values', () => {
  assert.throws(() => osbbOfflineMonthKey('chat', 2026, 0), /scope/i);
  assert.throws(() => osbbOfflineMonthKey('att', 1999, 0), /year/i);
  assert.throws(() => osbbOfflineMonthKey('att', 2026, 12), /month/i);
  assert.throws(() => osbbOfflineMonthKey('att', 2026, 1.5), /month/i);
});

test('OSBB offline values round-trip, remove, and fail closed', () => {
  const storage = memoryStorage();
  assert.equal(writeOsbbOfflineValue(storage, 'att_2026_0', { 1: { plumber: { checkIn: '08:00' } } }), true);
  assert.deepEqual(readOsbbOfflineValue(storage, 'att_2026_0'), { 1: { plumber: { checkIn: '08:00' } } });
  removeOsbbOfflineValue(storage, 'att_2026_0');
  assert.equal(readOsbbOfflineValue(storage, 'att_2026_0'), null);
  storage.values.set('broken', '{');
  assert.equal(readOsbbOfflineValue(storage, 'broken'), null);

  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(readOsbbOfflineValue(blocked, 'key'), null);
  assert.equal(writeOsbbOfflineValue(blocked, 'key', {}), false);
  assert.doesNotThrow(() => removeOsbbOfflineValue(blocked, 'key'));
  assert.equal(writeOsbbOfflineValue(storage, 'cyclic', (() => { const value = {}; value.self = value; return value; })()), false);
});
