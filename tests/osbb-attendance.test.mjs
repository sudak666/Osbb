import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attendanceCellState,
  attendanceDayState,
  attendanceHours,
  calculateAttendanceTotals,
} from '../src/osbb-attendance.js';

test('attendanceHours supports regular and overnight shifts', () => {
  assert.equal(attendanceHours({ checkIn: '08:30', checkOut: '17:00' }), 8.5);
  assert.equal(attendanceHours({ checkIn: '22:00', checkOut: '06:00' }), 8);
  assert.equal(attendanceHours({ checkIn: '08:00', checkOut: '' }), 0);
  assert.equal(attendanceHours({ checkIn: '25:00', checkOut: '26:00' }), 0);
});

test('attendance states distinguish empty, partial and completed records', () => {
  assert.equal(attendanceCellState({}), 'is-empty-cell');
  assert.equal(attendanceCellState({ checkIn: '08:00' }), 'is-partial-cell');
  assert.equal(attendanceCellState({ checkIn: '08:00', checkOut: '17:00' }), 'is-complete-cell');
  assert.equal(attendanceDayState([{}, {}]), 'is-empty-day');
  assert.equal(attendanceDayState([{ checkIn: '08:00' }, {}]), 'is-partial-day');
  assert.equal(attendanceDayState([
    { checkIn: '08:00', checkOut: '17:00' },
    { checkIn: '09:00', checkOut: '18:00' },
  ]), 'is-filled-day');
});

test('calculateAttendanceTotals aggregates days and fractional hours by role', () => {
  const totals = calculateAttendanceTotals({
    1: { plumber: { checkIn: '08:00', checkOut: '17:00' }, janitor: { checkIn: '09:00', checkOut: '13:30' } },
    2: { plumber: { checkIn: '22:00', checkOut: '06:00' }, janitor: { checkIn: '09:00' } },
  }, ['plumber', 'janitor'], 31);
  assert.deepEqual(totals, {
    plumber: { days: 2, hours: 17 },
    janitor: { days: 1, hours: 4.5 },
  });
});
