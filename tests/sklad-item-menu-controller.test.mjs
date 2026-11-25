import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladItemMenuController, shellBottomNavTop } from '../src/sklad-item-menu-controller.js';

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

test('shellBottomNavTop converts the shell bottom nav into iframe coordinates', () => {
  const nav = { getBoundingClientRect: () => ({ top: 835, height: 68 }) };
  const parent = { document: { getElementById: id => id === 'shell-bottom-nav' ? nav : null }, getComputedStyle: () => ({ display: 'grid' }) };
  const win = { parent, frameElement: { getBoundingClientRect: () => ({ top: 0 }) } };
  assert.equal(shellBottomNavTop(win), 835);
  assert.equal(shellBottomNavTop({ ...win, parent: { ...parent, getComputedStyle: () => ({ display: 'none' }) } }), null);
  const standalone = {}; standalone.parent = standalone; standalone.frameElement = null;
  assert.equal(shellBottomNavTop(standalone), null);
});


test('scrolling inside an open menu does not reposition it', () => {
  let frames = 0;
  const document = { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] };
  const window = { addEventListener() {}, requestAnimationFrame: () => { frames++; return 1; }, visualViewport: null };
  const controller = createSkladItemMenuController({ document, window, actions: {} });
  controller.reposition({ target: { closest: selector => (selector === '.item-more-menu' ? {} : null) } });
  assert.equal(frames, 0);
  controller.reposition({ target: { closest: () => null } });
  assert.equal(frames, 1);
});
