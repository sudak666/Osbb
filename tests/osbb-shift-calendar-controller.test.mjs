import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbShiftCalendarController } from '../src/osbb-shift-calendar-controller.js';

function documentFixture() {
  const statusClasses = new Set();
  const status = { textContent: '', classList: { toggle: (name, active) => active ? statusClasses.add(name) : statusClasses.delete(name) } };
  return { status, statusClasses, document: { getElementById: id => id === 'shift-sync-status' ? status : null } };
}

test('shift calendar controller loads bounded rows and exposes month state', async () => {
  const { document, status } = documentFixture();
  const calls = [];
  const controller = createOsbbShiftCalendarController({
    document, now: () => new Date(2026, 7, 8), getNames: () => ({ sergiy: 'Іван', oleksandr: 'Петро' }), showToast() {},
    loadRows: async monthKey => { calls.push(monthKey); return { data: [{ shift_date: '2026-08-08', sergiy: ['night_half2'], oleksandr: ['rest'] }], error: null }; },
  });
  await controller.load();
  assert.deepEqual(calls, ['2026-08']);
  assert.deepEqual(controller.dayData('2026-08-08'), { shift_date: '2026-08-08', sergiy: ['night_half2'], oleksandr: ['rest'] });
  assert.deepEqual(controller.dayData('2026-08-09'), { sergiy: [], oleksandr: [] });
  assert.equal(status.textContent, 'Синхронізовано');
});

test('shift calendar controller changes month and reloads exactly once', async () => {
  const { document } = documentFixture(); const calls = [];
  const controller = createOsbbShiftCalendarController({ document, now: () => new Date(2026, 7, 8), getNames: () => ({ sergiy: 'С', oleksandr: 'О' }), showToast() {}, loadRows: async key => { calls.push(key); return { data: [], error: null }; } });
  await controller.changeMonth(1);
  assert.equal(controller.monthKey(), '2026-09');
  assert.deepEqual(calls, ['2026-09']);
});
