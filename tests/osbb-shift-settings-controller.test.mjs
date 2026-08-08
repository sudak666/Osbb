import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbShiftSettingsController } from '../src/osbb-shift-settings-controller.js';

function fixture() {
  const elements = Object.fromEntries(['shift-legend-sergiy','shift-stat-name-sergiy','shift-editor-name-sergiy','shift-legend-oleksandr','shift-stat-name-oleksandr','shift-editor-name-oleksandr','shift-heading','shift-name-sergiy','shift-name-oleksandr'].map(id => [id, { textContent: '', value: '', focus() {} }]));
  const classes = new Set();
  elements['shift-name-editor'] = { classList: { add: value => classes.add(value), remove: value => classes.delete(value) }, setAttribute(name, value) { this[name] = value; } };
  return { classes, document: { activeElement: null, getElementById: id => elements[id] }, elements };
}

test('shift settings controller loads normalized names and applies every label', async () => {
  const { document, elements } = fixture(); let changed = null;
  const controller = createOsbbShiftSettingsController({ document, loadSettings: async () => ({ data: { employee_one_name: '  Іван  ', employee_two_name: 'Петро' }, error: null }), saveNames: async () => true, requestPin() {}, showToast() {}, requestFrame: callback => callback(), onNamesChanged: names => { changed = names; } });
  await controller.load();
  assert.deepEqual(controller.getNames(), { sergiy: 'Іван', oleksandr: 'Петро' });
  assert.deepEqual(changed, { sergiy: 'Іван', oleksandr: 'Петро' });
  assert.equal(elements['shift-heading'].textContent, 'Іван та Петро');
});

test('shift settings controller saves names through guarded PIN flow', async () => {
  const { classes, document, elements } = fixture(); let pinAction = null; let saved = null; const toasts = [];
  const controller = createOsbbShiftSettingsController({ document, loadSettings: async () => ({ data: null, error: null }), requestFrame: callback => callback(), onNamesChanged() {}, requestPin: (_title, _subtitle, action) => { pinAction = action; }, saveNames: async (...args) => { saved = args; return true; }, showToast: (...args) => toasts.push(args) });
  controller.open(); elements['shift-name-sergiy'].value = 'Марко'; elements['shift-name-oleksandr'].value = 'Андрій'; controller.save(); await pinAction('1234');
  assert.deepEqual(saved, ['Марко', 'Андрій', '1234']);
  assert.deepEqual(controller.getNames(), { sergiy: 'Марко', oleksandr: 'Андрій' });
  assert.ok(!classes.has('is-open'));
  assert.deepEqual(toasts.at(-1), ['Імена працівників оновлено', 'check']);
});
