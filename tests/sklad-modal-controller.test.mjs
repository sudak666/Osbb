import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladModalController } from '../src/sklad-modal-controller.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}
class FakeElement {
  constructor(id, document) {
    this.id = id;
    this.ownerDocument = document;
    this.classList = new FakeClassList();
    this.offsetParent = {};
    this.childrenBySelector = new Map();
    this.focusCalls = 0;
    this.isDialog = false;
  }
  querySelector(selector) { return this.childrenBySelector.get(selector)?.[0] ?? null; }
  querySelectorAll(selector) { return this.childrenBySelector.get(selector) ?? []; }
  matches(selector) { return selector === '[role="dialog"]' && this.isDialog; }
  focus() { this.focusCalls++; this.ownerDocument.activeElement = this; }
}
class FakeDocument {
  constructor() { this.elements = new Map(); this.activeElement = null; }
  add(id) { const element = new FakeElement(id, this); this.elements.set(id, element); return element; }
  getElementById(id) { return this.elements.get(id) ?? null; }
  querySelectorAll(selector) {
    if (selector !== '.modal-bg.open') return [];
    return [...this.elements.values()].filter(element => element.classList.contains('modal-bg') && element.classList.contains('open'));
  }
  contains(element) { return this.elements.has(element.id); }
}

function makeController() {
  const document = new FakeDocument();
  const frames = [];
  let selectionClears = 0;
  const window = {
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    getSelection: () => ({ isCollapsed: false, removeAllRanges: () => { selectionClears++; } }),
  };
  const controller = createSkladModalController({ document, window });
  return { controller, document, frames, selectionClears: () => selectionClears };
}

function addModal(document, id, focusables = []) {
  const modal = document.add(id);
  modal.classList.add('modal-bg');
  const dialog = document.add(`${id}-dialog`);
  dialog.isDialog = true;
  dialog.childrenBySelector.set('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', focusables);
  modal.childrenBySelector.set('[role="dialog"]', [dialog]);
  return { modal, dialog };
}

test('modal controller focuses the dialog and restores the opener', () => {
  const { controller, document, frames, selectionClears } = makeController();
  const opener = document.add('opener');
  const initial = document.add('initial');
  const { modal, dialog } = addModal(document, 'editor', [initial]);
  dialog.childrenBySelector.set('[data-modal-initial-focus]', [initial]);
  document.activeElement = opener;

  controller.open('editor');
  assert.equal(modal.classList.contains('open'), true);
  frames.shift()();
  assert.equal(document.activeElement, initial);
  assert.equal(selectionClears(), 1);

  controller.close('editor');
  assert.equal(modal.classList.contains('open'), false);
  assert.equal(document.activeElement, opener);
});

test('modal controller ignores inner backdrop clicks and closes all open modals', () => {
  const { controller, document } = makeController();
  const first = addModal(document, 'first').modal;
  const second = addModal(document, 'second').modal;
  first.classList.add('open');
  second.classList.add('open');
  controller.close('first', { target: document.add('inner') });
  assert.equal(first.classList.contains('open'), true);
  controller.closeAll();
  assert.equal(first.classList.contains('open'), false);
  assert.equal(second.classList.contains('open'), false);
});

test('modal controller traps focus inside the topmost dialog', () => {
  const { controller, document } = makeController();
  const first = document.add('first-focus');
  const last = document.add('last-focus');
  const { modal } = addModal(document, 'editor', [first, last]);
  modal.classList.add('open');
  document.activeElement = last;
  let prevented = 0;
  controller.trapFocus({ key: 'Tab', shiftKey: false, preventDefault: () => { prevented++; } });
  assert.equal(document.activeElement, first);
  assert.equal(prevented, 1);
});
