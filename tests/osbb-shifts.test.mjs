import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateShiftMoney,
  shiftDateKey,
  shiftErrorMessage,
  shiftIsWorking,
  shiftTypeDescription,
  workShiftNamesFromResponse,
  workShiftRowsFromResponse,
} from '../src/osbb-shifts.js';

test('workShiftNamesFromResponse нормалізує налаштування імен', () => {
  const fallback = { sergiy: 'Сергій', oleksandr: 'Олександр' };
  assert.deepEqual(workShiftNamesFromResponse({
    employee_one_name: '  Іван  ',
    employee_two_name: '',
  }, fallback), { sergiy: 'Іван', oleksandr: 'Олександр' });
  assert.deepEqual(workShiftNamesFromResponse(null, fallback), fallback);
  assert.notEqual(workShiftNamesFromResponse(null, fallback), fallback);
});

test('workShiftRowsFromResponse індексує лише валідні зміни', () => {
  assert.deepEqual(workShiftRowsFromResponse([
    { shift_date: '2026-08-03', sergiy: ['day', 'invalid'], oleksandr: ['rest'] },
    { shift_date: '03.08.2026', sergiy: ['night'], oleksandr: [] },
    { shift_date: '2026-02-31', sergiy: ['night'], oleksandr: [] },
    null,
  ]), {
    '2026-08-03': { shift_date: '2026-08-03', sergiy: ['day'], oleksandr: ['rest'] },
  });
  assert.deepEqual(workShiftRowsFromResponse(null), {});
});

test('work shift boundaries do not propagate arbitrary payload properties', () => {
  const rows = workShiftRowsFromResponse([{
    shift_date: '2026-08-04', sergiy: ['day', '<img onerror=alert(1)>'], oleksandr: ['rest'], malicious: '<svg onload=alert(1)>',
  }]);
  assert.deepEqual(rows['2026-08-04'], { shift_date: '2026-08-04', sergiy: ['day'], oleksandr: ['rest'] });
  assert.equal('malicious' in rows['2026-08-04'], false);
});

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
