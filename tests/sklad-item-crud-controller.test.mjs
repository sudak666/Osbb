import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladItemCrudController } from '../src/sklad-item-crud-controller.js';

function setup(items) {
  const elements = new Map(['editItemName','editItemCategory','editItemUnit','delItemName'].map(id => [id, { value: '', textContent: '' }]));
  const messages = []; let opened = null;
  const controller = createSkladItemCrudController({
    db: {}, document: { getElementById: id => elements.get(id) }, categories: { Ремонт: 'br', Інше: 'bo' }, getItems: () => items,
    findItem: id => items.find(item => Number(item.id) === Number(id)), refreshSelect() {}, openModal: id => { opened = id; }, closeModal() {},
    setButtonLoading: () => null, loadItems: async () => {}, populateSelects() {}, renderLowStock() {}, requestDeletePin() {}, runDeleteRpc: async () => ({}),
    toast: (...args) => messages.push(args),
  });
  return { controller, elements, messages, opened: () => opened };
}

test('item CRUD controller fills the metadata editor from a current item', () => {
  const { controller, elements, opened } = setup([{ id: 2, name: 'Кабель', category: 'Ремонт', unit: 'м' }]);
  controller.openEdit(2);
  assert.equal(elements.get('editItemName').value, 'Кабель');
  assert.equal(elements.get('editItemCategory').value, 'Ремонт');
  assert.equal(elements.get('editItemUnit').value, 'м');
  assert.equal(opened(), 'editItemModal');
});

test('item CRUD controller rejects duplicate normalized names before transport', async () => {
  const { controller, elements, messages } = setup([{ id: 1, name: 'Кабель', category: 'Ремонт', unit: 'м' }, { id: 2, name: 'Лампа', category: 'Ремонт', unit: 'шт' }]);
  controller.openEdit(2);
  elements.get('editItemName').value = '  КАБЕЛЬ  ';
  await controller.saveEdit({});
  assert.deepEqual(messages.at(-1), ['Товар з такою назвою вже існує', 'error']);
});
