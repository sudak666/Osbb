import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildManagementReport, DEFAULT_REPORT_SECTIONS, managementReportFileName, periodMonths, renderManagementReport, reportPeriod, shiftReportAnchor,
} from '../src/management-report.js';

test('periods: day, Monday–Sunday week across months, calendar month', () => {
  const tue = new Date(2026, 10, 17);
  assert.equal(reportPeriod('day', tue).label, 'вівторок, 17 листопада 2026');
  const week = reportPeriod('week', tue);
  assert.equal(week.label, '16–22 листопада 2026');
  assert.equal(week.from.getDay(), 1);
  const crossing = reportPeriod('week', new Date(2026, 10, 1));
  assert.equal(crossing.label, '26 жовтня – 1 листопада 2026');
  assert.deepEqual(periodMonths(crossing), [[2026, 9], [2026, 10]]);
  assert.equal(reportPeriod('month', tue).label, 'Листопад 2026');
  assert.equal(reportPeriod('month', shiftReportAnchor('month', tue, -1)).label, 'Жовтень 2026');
  assert.equal(managementReportFileName(week), 'Звіт ОСББ — тиждень — 2026-11-16');
});

const source = {
  attendance: { '2026-11': { 16: { plumber: { checkIn: '11:00', breakStart: '12:00', breakEnd: '14:00', checkOut: '16:00' } }, 17: { janitor: { checkIn: '06:00', checkOut: '09:30' } } } },
  garbage: { '2026-10': { '16': { time: '05:55', types: { bins: 11 } }, '17': { time: '06:00', types: { bins: 3 } } } },
  elevator: { '2026-10': [{ id: 'a', day: 12, text: 'відводка дверей', createdAt: '', createdBy: '' }, { id: 'b', day: 17, text: 'огляд <b>', createdAt: '', createdBy: '' }] },
  works: [{ work_date: '2026-11-17', worker_role: 'security', description: 'Обхід території' }, { work_date: '2026-11-01', worker_role: 'electrician', description: 'поза тижнем' }],
  issues: [{ issued_at: '2026-11-17T08:00:00Z', item_id: 1, item_name: 'Лампа', quantity: 2 }],
  receipts: [],
  items: [{ id: 1, name: 'Лампа', unit: 'шт', quantity: 0, price_unit: 32 }],
};

test('week report sums attendance without absence, garbage and in-range works only', () => {
  const now = new Date(2026, 10, 17, 18, 0);
  const m = buildManagementReport(reportPeriod('week', now), source, now);
  assert.equal(m.attendance.find(a => a.label === 'Сантехнік').hours, 3);
  assert.equal(m.attendance.find(a => a.label === 'Двірник').hours, 3.5);
  assert.equal(m.totalHours, 6.5);
  assert.equal(m.garbageDays, 2);
  assert.equal(m.garbageBins, 14);
  assert.deepEqual(m.works.map(w => w.role), ['Охорона']);
  assert.equal(m.elevator.length, 1);
  assert.equal(m.elapsedDays, 2);
  assert.equal(m.stock.issuedSum, 64);
  assert.equal(m.stock.outOfStock, 1);
});

test('rendered report escapes text and respects section toggles', () => {
  const now = new Date(2026, 10, 17, 18, 0);
  const m = buildManagementReport(reportPeriod('week', now), source, now);
  const html = renderManagementReport(m, new Set(DEFAULT_REPORT_SECTIONS));
  assert.match(html, /Звіт за тиждень/);
  assert.match(html, /станом на 17 листопада/);
  assert.equal(html.includes('огляд <b>'), false);
  assert.equal(html.includes('огляд &lt;b&gt;'), true);
  assert.equal(html.includes('Склад'), false, 'склад вимкнено за замовчуванням');
  const withStock = renderManagementReport(m, new Set([...DEFAULT_REPORT_SECTIONS, 'stock']));
  assert.match(withStock, /Видач: <strong>1<\/strong>/);
  const day = renderManagementReport(buildManagementReport(reportPeriod('day', new Date(2026, 10, 16)), source, now), new Set(DEFAULT_REPORT_SECTIONS));
  assert.match(day, /12:00–14:00/);
  assert.match(day, /Вивезено о 05:55, баків: 11/);
});
