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

test('shift calendar editor saves selected day through PIN and reloads', async () => {
  const classes = new Set(); const children = [];
  const makeNode = () => ({ dataset: {}, classList: { add: value => classes.add(value), remove: value => classes.delete(value), toggle() {} }, setAttribute() {}, appendChild: child => children.push(child) });
  const chips = { sergiy: { replaceChildren() {}, appendChild: child => children.push(child) }, oleksandr: { replaceChildren() {}, appendChild: child => children.push(child) } };
  const editor = { ...makeNode(), querySelector: () => ({ focus() {} }) };
  const title = { textContent: '' }; const saveButton = { disabled: false }; let pinAction = null; let saved = null; let loads = 0;
  const document = {
    activeElement: null, contains: () => false, createElement: makeNode,
    getElementById: id => id === 'shift-editor' ? editor : id === 'shift-editor-title' ? title : id === 'shift-chips-sergiy' ? chips.sergiy : id === 'shift-chips-oleksandr' ? chips.oleksandr : id === 'shift-sync-status' ? { textContent: '', classList: { toggle() {} } } : null,
    querySelector: () => saveButton,
  };
  const controller = createOsbbShiftCalendarController({
    document, now: () => new Date(2026, 7, 8), getNames: () => ({ sergiy: 'С', oleksandr: 'О' }), requestFrame: callback => callback(), showToast() {},
    requestPin: (_title, _subtitle, action) => { pinAction = action; }, saveDay: async (...args) => { saved = args; return true; }, resetMonth: async () => true,
    loadRows: async () => { loads++; return { data: [], error: null }; },
  });
  controller.openEditor('2026-08-08'); controller.toggleChip('sergiy', 'rest'); controller.submitDay(); await pinAction('4321');
  assert.deepEqual(saved, ['2026-08-08', ['rest'], ['night'], '4321']);
  assert.equal(loads, 1); assert.equal(saveButton.disabled, false); assert.ok(!classes.has('is-open'));
});
