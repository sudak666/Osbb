import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladSupplierController } from '../src/sklad-supplier-controller.js';

function makeController() {
  const input = { value: '', events: [], dispatchEvent(event) { this.events.push(event.type); } };
  const chip = { dataset: { supplierPreset: 'Епіцентр' }, active: false, attributes: {}, classList: { toggle(_name, value) { chip.active = value; } }, setAttribute(name, value) { this.attributes[name] = value; } };
  const document = {
    getElementById: id => id === 'refillSupplierI' ? input : null,
    querySelectorAll: selector => selector.includes('data-supplier-target') ? [chip] : [],
  };
  const controller = createSkladSupplierController({
    db: {}, document, window: { Event }, storage: { getItem: () => null, setItem() {} },
    toast() {}, openModal() {}, closeModal() {},
  });
  return { chip, controller, input };
}

test('supplier controller selects a preset and synchronizes pressed state', () => {
  const { chip, controller, input } = makeController();
  controller.select({ dataset: { supplierTarget: 'refillSupplierI', supplierPreset: 'Епіцентр' } });
  assert.equal(input.value, 'Епіцентр');
  assert.deepEqual(input.events, ['input']);
  assert.equal(chip.active, true);
  assert.equal(chip.attributes['aria-pressed'], 'true');
});

test('supplier controller ignores incomplete preset controls', () => {
  const { controller, input } = makeController();
  controller.select({ dataset: {} });
  assert.equal(input.value, '');
});
