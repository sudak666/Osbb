import test from 'node:test';
import assert from 'node:assert/strict';

import { dateInputToTimestamp, dateToInputValue } from '../src/sklad-dates.js';

test('dateInputToTimestamp keeps the current local operation time', () => {
  const now = new Date(2026, 7, 2, 14, 35, 27);
  const expected = new Date(2026, 0, 15, 14, 35, 27).toISOString();
  assert.equal(dateInputToTimestamp('2026-01-15', now), expected);
});

test('dateInputToTimestamp rejects empty and malformed values', () => {
  const now = new Date(2026, 7, 2, 14, 35, 27);
  assert.equal(dateInputToTimestamp('', now), null);
  assert.equal(dateInputToTimestamp('not-a-date', now), null);
  assert.equal(dateInputToTimestamp(null, now), null);
});

test('dateToInputValue formats local dates and uses a deterministic fallback', () => {
  const fallback = new Date(2026, 7, 2, 10, 0, 0);
  const value = new Date(2026, 0, 5, 10, 0, 0);
  assert.equal(dateToInputValue(value, fallback), '2026-01-05');
  assert.equal(dateToInputValue('invalid', fallback), '2026-08-02');
  assert.equal(dateToInputValue(null, fallback), '2026-08-02');
});
