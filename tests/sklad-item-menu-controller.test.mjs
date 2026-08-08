import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladItemMenuController } from '../src/sklad-item-menu-controller.js';

test('item menu controller routes delegated item actions and closes their menu', () => {
  let called = null;
  const summary = { setAttribute() {} };
  const menu = { removeAttribute(name) { this.removed = name; }, querySelector: () => summary, closest: () => null };
  const scope = {};
  const trigger = { dataset: { itemId: '7', itemAction: 'edit' }, closest: selector => selector === '#itemsTable,#mobileCards' ? scope : selector === 'details.item-more' ? menu : null };
  const listeners = {};
  const table = { addEventListener: (name, handler) => { listeners[name] = handler; } };
  const document = { getElementById: id => id === 'itemsTable' ? table : null, addEventListener() {}, querySelectorAll: () => [] };
  const window = { addEventListener() {}, requestAnimationFrame() {}, visualViewport: null };
  createSkladItemMenuController({ document, window, actions: { edit: id => { called = id; } } }).bind();
  listeners.click({ target: { closest: () => trigger }, preventDefault() {} });
  assert.equal(called, 7);
  assert.equal(menu.removed, 'open');
});

test('item menu keyboard activation supports Enter and Space', () => {
  let clicks = 0;
  const trigger = { click: () => { clicks++; }, closest: selector => selector === '#itemsTable,#mobileCards' ? {} : null };
  const listeners = {};
  const table = { addEventListener: (name, handler) => { listeners[name] = handler; } };
  const document = { getElementById: id => id === 'itemsTable' ? table : null, addEventListener() {}, querySelectorAll: () => [] };
  const window = { addEventListener() {}, requestAnimationFrame() {}, visualViewport: null };
  createSkladItemMenuController({ document, window, actions: {} }).bind();
  listeners.keydown({ key: 'Enter', target: { closest: () => trigger }, preventDefault() {} });
  assert.equal(clicks, 1);
});
