import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMonthlyReportSheets, monthRange, monthlyReportFileName } from '../src/monthly-report.js';

test('monthRange covers the whole calendar month', () => {
  const range = monthRange(2026, 1);
  assert.equal(range.first, '2026-02-01');
  assert.equal(range.last, '2026-02-28');
  assert.equal(range.days, 28);
  assert.equal(monthlyReportFileName(2026, 10), 'Звіт_ОСББ_2026-11.xlsx');
});

test('monthly report builds every sheet with summary totals and placeholders for empty data', () => {
  const sheets = buildMonthlyReportSheets({
    year: 2026, month: 10,
    works: [{ work_date: '2026-11-03', worker_role: 'electrician', description: 'Замінив лампу', note: '' }],
    attendance: { 3: { electrician: { checkIn: '08:00', checkOut: '12:00' } } },
    garbage: { '02': { time: '06:00', types: { bins: 9 } }, '03': { time: '06:10', types: { bins: 3 } } },
    elevator: [],
    issues: [{ issued_at: '2026-11-03T09:00:00Z', item_id: 1, item_name: 'Лампа', quantity: 2, issued_to: 'Електрик' }],
    receipts: [],
    items: [{ id: 1, category: 'Електрика', price_unit: 32 }],
  });
  assert.deepEqual(sheets.map(s => s.name), ['Підсумок', 'Виконані роботи', 'Табель — підсумок', 'Табель — по днях', 'Сміття', 'Ліфтер', 'Склад — видачі', 'Склад — надходження']);
  const summary = Object.fromEntries(sheets[0].rows.map(r => [r['Показник'], r['Значення']]));
  assert.equal(summary['Місяць'], 'Листопад 2026');
  assert.equal(summary['Виконаних робіт'], 1);
  assert.equal(summary['Вивезено баків'], 12);
  assert.equal(summary['Видано матеріалів на суму ≈, грн'], 64);
  assert.equal(summary['Електрик: відпрацьовано'], '1 дн., 4 год');
  assert.deepEqual(sheets[5].rows, [{ 'Примітка': 'За цей місяць записів немає' }]);
  assert.equal(sheets[3].rows.length, 1);
  for (const sheet of sheets) assert.ok(sheet.name.length <= 31, `${sheet.name} задовга назва аркуша для Excel`);
});
