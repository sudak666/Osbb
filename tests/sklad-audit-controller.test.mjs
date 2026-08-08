import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladAuditController } from '../src/sklad-audit-controller.js';

function makeElement(value = '') {
  return {
    value, textContent: '', innerHTML: '', style: {}, attributes: {},
    setAttribute(name, next) { this.attributes[name] = next; },
    focus() {},
  };
}

function makeController(inventory) {
  const elements = new Map([
    ['auditDate', makeElement()], ['auditSearch', makeElement()], ['auditStats', makeElement()],
    ['auditProgressFill', makeElement()], ['auditProgress', makeElement()], ['auditList', makeElement()],
    ['auditSummary', makeElement()], ['auditNote', makeElement()],
  ]);
  const messages = [];
  const controller = createSkladAuditController({
    db: {}, document: { getElementById: id => elements.get(id) ?? null }, getItems: () => inventory,
    itemMatchesSearch: (item, search) => item.name.includes(search), updateResultSummary() {},
    categoryBadges: {}, categoryIcons: {}, defaultCategoryIcon: '<i>box</i>',
    toast: (...args) => messages.push(args), openModal() {}, closeModal() {}, loadItems: async () => {},
  });
  return { controller, elements, messages };
}

test('audit controller initializes progress and renders escaped inventory rows', () => {
  const { controller, elements } = makeController([{ id: 1, name: '<Кабель>', category: 'Ремонт', quantity: 2, unit: 'м' }]);
  controller.init();
  assert.match(elements.get('auditDate').textContent, /^Розпочато:/);
  assert.match(elements.get('auditStats').textContent, /0\/1/);
  assert.match(elements.get('auditList').innerHTML, /&lt;Кабель&gt;/);
  assert.equal(elements.get('auditProgress').attributes['aria-valuenow'], '0');
});

test('audit controller fills current quantities and exposes a confirmation summary', () => {
  const { controller, elements, messages } = makeController([{ id: 1, name: 'Кабель', category: null, quantity: 2, unit: 'м' }]);
  controller.init();
  controller.fillCurrent();
  controller.openConfirm();
  assert.match(elements.get('auditList').innerHTML, /value="2"/);
  assert.match(elements.get('auditSummary').innerHTML, /audit-summary-value counted">1/);
  assert.deepEqual(messages[0], ['Підставлено поточні залишки', 'success']);
});
