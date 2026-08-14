import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adjacentCalendarDays,
  calendarMonthDays,
  isCalendarMonth,
  mondayFirstDayOffset,
  oneBasedMonthKey,
  shiftCalendarMonth,
  sundayFirstDayOffset,
  zeroBasedMonthKey,
} from '../src/osbb-calendar.js';

test('adjacent calendar days fill incomplete weeks', () => {
  assert.deepEqual(adjacentCalendarDays(2026, 7), {
    leading: [
      { year: 2026, month: 6, day: 27 },
      { year: 2026, month: 6, day: 28 },
      { year: 2026, month: 6, day: 29 },
      { year: 2026, month: 6, day: 30 },
      { year: 2026, month: 6, day: 31 },
    ],
    trailing: [
      { year: 2026, month: 8, day: 1 },
      { year: 2026, month: 8, day: 2 },
      { year: 2026, month: 8, day: 3 },
      { year: 2026, month: 8, day: 4 },
      { year: 2026, month: 8, day: 5 },
      { year: 2026, month: 8, day: 6 },
    ],
  });
});

test('calendar month shifting crosses years and respects UI bounds', () => {
  assert.deepEqual(shiftCalendarMonth(2026, 0, -1, 2025, 2030), { year: 2025, month: 11 });
  assert.deepEqual(shiftCalendarMonth(2026, 11, 1, 2025, 2030), { year: 2027, month: 0 });
  assert.deepEqual(shiftCalendarMonth(2026, 5, 18, 2025, 2030), { year: 2027, month: 11 });
  assert.equal(shiftCalendarMonth(2025, 0, -1, 2025, 2030), null);
  assert.equal(shiftCalendarMonth(2030, 11, 1, 2025, 2030), null);
});

test('calendar helpers preserve leap years, offsets, and legacy keys', () => {
  assert.equal(calendarMonthDays(2024, 1), 29);
  assert.equal(calendarMonthDays(2026, 1), 28);
  assert.equal(mondayFirstDayOffset(2026, 7), 5);
  assert.equal(sundayFirstDayOffset(2026, 7), 6);
  assert.equal(zeroBasedMonthKey(2026, 7), '2026-7');
  assert.equal(oneBasedMonthKey(2026, 7), '2026-08');
});

test('calendar month matching uses local date fields and rejects invalid input', () => {
  assert.equal(isCalendarMonth(2026, 7, new Date(2026, 7, 15)), true);
  assert.equal(isCalendarMonth(2026, 7, new Date(2026, 8, 1)), false);
  assert.throws(() => calendarMonthDays(2026, 12), /month/i);
  assert.throws(() => shiftCalendarMonth(2026, 0, 1.5), /range/i);
});
