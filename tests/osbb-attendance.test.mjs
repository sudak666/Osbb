import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attendanceCellState,
  attendanceCellError,
  attendanceDayState,
  attendanceHours,
  calculateAttendanceTotals,
  formatAttendanceDuration,
  normalizeAttendanceMonth,
} from '../src/osbb-attendance.js';

test('normalizeAttendanceMonth відкидає некоректні дні, клітинки й час', () => {
  assert.deepEqual(normalizeAttendanceMonth({
    1: { plumber: { checkIn: '08:15', checkOut: '17:30' }, janitor: { checkIn: '99:00' } },
    bad: { plumber: { checkIn: '08:00' } },
    32: { plumber: { checkIn: '08:00' } },
    2: null,
  }), { 1: { plumber: { checkIn: '08:15', breakStart:undefined, breakEnd:undefined, checkOut: '17:30' } } });
  assert.deepEqual(normalizeAttendanceMonth([]), {});
});

test('attendanceHours supports regular and overnight shifts', () => {
  assert.equal(attendanceHours({ checkIn: '08:30', checkOut: '17:00' }), 8.5);
  assert.equal(attendanceHours({ checkIn: '08:30', breakStart:'12:00', breakEnd:'12:45', checkOut: '17:00' }), 7.75);
  assert.equal(attendanceHours({ checkIn: '22:00', checkOut: '06:00' }), 8);
  assert.equal(attendanceHours({ checkIn: '22:00', breakStart:'01:00', breakEnd:'01:30', checkOut: '06:00' }), 7.5);
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

test('normalizeAttendanceMonth ignores injected role and time payloads', () => {
  assert.deepEqual(normalizeAttendanceMonth({
    1: {
      plumber: { checkIn: '08:00', checkOut: '\" autofocus onfocus=alert(1) x=\"' },
      '<img onerror=alert(1)>': { checkIn: '09:00', checkOut: '17:00' },
    },
  }), { 1: { plumber: { checkIn: '08:00', breakStart:undefined, breakEnd:undefined, checkOut: undefined } } });
});

test('attendance validates absence pairs and their position inside a shift', () => {
  assert.equal(attendanceCellError({ checkIn:'08:00', breakStart:'12:00', breakEnd:'12:45', checkOut:'17:00' }), '');
  assert.match(attendanceCellError({ checkIn:'08:00', breakStart:'12:00', checkOut:'17:00' }), /виходу і повернення/);
  assert.match(attendanceCellError({ checkIn:'08:00', breakStart:'18:00', breakEnd:'18:30', checkOut:'17:00' }), /між приходом/);
  assert.equal(attendanceCellState({ checkIn:'08:00', breakStart:'12:00', checkOut:'17:00' }), 'is-partial-cell');
  assert.equal(formatAttendanceDuration(8.416666), '8 год 25 хв');
});

test('calculateAttendanceTotals aggregates days and fractional hours by role', () => {
  const totals = calculateAttendanceTotals({
    1: { plumber: { checkIn: '08:00', breakStart:'12:00', breakEnd:'13:00', checkOut: '17:00' }, janitor: { checkIn: '09:00', checkOut: '13:30' } },
    2: { plumber: { checkIn: '22:00', checkOut: '06:00' }, janitor: { checkIn: '09:00' } },
  }, ['plumber', 'janitor'], 31);
  assert.deepEqual(totals, {
    plumber: { days: 2, hours: 16 },
    janitor: { days: 1, hours: 4.5 },
  });
});
