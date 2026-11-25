import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attendanceToday, formatLongDate, formatMoney, garbageToday, latestElevatorVisit, renderDashboard, stockSummary,
} from '../src/shell-dashboard.js';

test('attendanceToday reports who is at work, who finished and who is not marked', () => {
  const rows = attendanceToday({
    15: {
      janitor: { checkIn: '06:00', checkOut: '10:30' },
      plumber: { checkIn: '12:00' },
    },
  }, 15);
  assert.deepEqual(rows.map((row) => [row.role, row.status]), [['electrician', 'none'], ['janitor', 'done'], ['plumber', 'working']]);
  assert.match(rows[1].text, /^06:00–10:30 · /);
  assert.equal(rows[2].text, 'На роботі з 12:00');
  assert.equal(attendanceToday(null, 1).every((row) => row.status === 'none'), true);
  const withBreak = attendanceToday({ 16: { plumber: { checkIn: '11:00', breakStart: '12:00', breakEnd: '14:00', checkOut: '16:00' } } }, 16);
  assert.equal(withBreak[2].text, '11:00–16:00 · 3 год');
  assert.equal(withBreak[2].absence, 'відсутність 12:00–14:00');
  assert.equal(withBreak[0].absence, '');
});

test('garbageToday reads zero-padded day keys and month totals', () => {
  const month = { '02': { time: '06:00', types: { bins: 9 } }, '15': { time: '06:10', types: { bins: 3 } }, '16': { types: { plastic: 1 } } };
  assert.deepEqual(garbageToday(month, 15), { recorded: true, bins: 3, time: '06:10', monthDays: 3, monthBins: 12 });
  assert.equal(garbageToday(month, 3).recorded, false);
  assert.equal(garbageToday(month, 16).recorded, true);
});

test('stockSummary separates out-of-stock from low stock and skips internal items', () => {
  const items = [
    { id: 1, quantity: 0, price_unit: 100 },
    { id: 2, quantity: 2, price_unit: 50 },
    { id: 3, quantity: 10, price_unit: 10 },
    { id: 4, quantity: 0, is_internal: true },
  ];
  const summary = stockSummary(items, [{ item_id: 2, quantity: 3 }, { item_id: 99, quantity: 1 }]);
  assert.deepEqual(summary, { available: 2, outOfStock: 1, low: 1, value: 200, monthIssues: 2, monthSpend: 150 });
  // Один заданий мінімум не вимикає поріг «≤ 3» для решти товарів (було: 0 при десятках низьких залишків).
  const mixed = stockSummary([
    { id: 1, quantity: 2, min_quantity: 5 },
    { id: 2, quantity: 9, min_quantity: 5 },
    { id: 3, quantity: 1 },
    { id: 4, quantity: 7 },
    { id: 5, quantity: 0 },
  ], []);
  assert.equal(mixed.low, 2);
  assert.equal(mixed.outOfStock, 1);
});

test('latestElevatorVisit picks the newest past visit across two months', () => {
  const now = new Date(2026, 10, 15);
  const visit = latestElevatorVisit(
    [{ id: 'a', day: 20, text: 'майбутнє', createdAt: '', createdBy: '' }, { id: 'b', day: 3, text: 'огляд', createdAt: '', createdBy: '' }],
    [{ id: 'c', day: 28, text: 'жовтень', createdAt: '', createdBy: '' }],
    now,
  );
  assert.equal(visit.text, 'огляд');
  assert.equal(latestElevatorVisit([], [], now), null);
});

test('dashboard formatting and rendering escape user text', () => {
  assert.equal(formatMoney(124070.4), '124 070 грн');
  assert.equal(formatLongDate(new Date(2026, 10, 15)), 'неділя, 15 листопада');
  const html = renderDashboard({
    attendance: { state: 'loading' },
    garbage: { state: 'error' },
    stock: { state: 'ok', value: { summary: stockSummary([], []), recent: [{ item_id: 1, item_name: '<img src=x>', quantity: 1, issued_to: null, issued_at: '2026-11-01T10:00:00Z' }] } },
    works: { state: 'ok', value: { monthCount: 0, recent: [] } },
    elevator: { state: 'ok', value: null },
  }, new Date(2026, 10, 15));
  assert.equal(html.includes('<img src=x>'), false);
  assert.equal(html.includes('&lt;img src=x&gt;'), true);
  assert.equal(html.includes('data-dashboard-go="completed-work"'), true);
  assert.equal(html.includes('Не вдалося завантажити'), true);
});
