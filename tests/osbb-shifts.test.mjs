import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateShiftMoney,
  shiftDateKey,
  shiftErrorMessage,
  shiftIsWorking,
  shiftTypeDescription,
} from '../src/osbb-shifts.js';

test('shift helpers format keys and describe combinations', () => {
  assert.equal(shiftDateKey(2026, 0, 5), '2026-01-05');
  assert.equal(shiftIsWorking(['rest']), false);
  assert.equal(shiftIsWorking(['night']), true);
  assert.equal(shiftTypeDescription([]), 'вихідний');
  assert.equal(shiftTypeDescription(['rest']), 'вихідний');
  assert.equal(shiftTypeDescription(['day']), 'ціла зміна');
  assert.equal(shiftTypeDescription(['night_half2']), 'пів зміни');
  assert.equal(shiftTypeDescription(['night', 'night_half2']), 'ціла і пів зміни');
});

test('calculateShiftMoney applies current full and half shift rates', () => {
  assert.equal(calculateShiftMoney({ day: 2, night: 3, night_half2: 4 }), 6300);
  assert.equal(calculateShiftMoney({ day: 0, night: 0, night_half2: 0 }), 0);
});

test('shiftErrorMessage maps Supabase failures to actionable messages', () => {
  assert.equal(shiftErrorMessage({ message: 'PGRST205 table missing' }, 'Помилка'), 'Застосуйте SQL-міграції 011–013 у Supabase');
  assert.equal(shiftErrorMessage({ message: '23514 constraint' }, 'Помилка'), 'Supabase відхилив формат місяця — застосуйте міграцію 012');
  assert.equal(shiftErrorMessage({ message: '42501 forbidden' }, 'Помилка'), 'Немає дозволу на запис у Supabase');
  assert.equal(shiftErrorMessage(new Error('network'), 'Помилка мережі'), 'Помилка мережі');
});
