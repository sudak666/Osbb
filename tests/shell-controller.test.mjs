import test from 'node:test';
import assert from 'node:assert/strict';

import { createShellController } from '../src/shell-controller.js';

class FakeClassList {
  constructor(initial = []) { this.values = new Set(initial); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(id, { classes = [], role = false } = {}) {
    this.id = id;
    this.style = {};
    this.classList = new FakeClassList(classes);
    this.attributes = new Map(role ? [['role', 'tab']] : []);
    this.dataset = {};
    this.textContent = '';
    this.src = '';
    this.offsetWidth = 1;
    this.listeners = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
}

class FakeDocument {
  constructor() {
    this.visibilityState = 'visible';
    this.listeners = new Map();
    this.elements = new Map();
  }
  add(element) { this.elements.set(element.id, element); return element; }
  getElementById(id) { return this.elements.get(id) ?? null; }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  querySelectorAll(selector) {
    const elements = [...this.elements.values()];
    if (selector === '.shell-tab-btn') return elements.filter((el) => el.classList.contains('shell-tab-btn'));
    if (selector === '#shell-frames iframe') return elements.filter((el) => el.id.startsWith('frame-'));
    if (selector === '[data-lock-digit]') return elements.filter((el) => el.dataset.lockDigit !== undefined);
    if (selector === '[data-shell-tab]') return elements.filter((el) => el.dataset.shellTab !== undefined);
    return [];
  }
  querySelector(selector) {
    if (selector === '[data-lock-delete]') return [...this.elements.values()].find((el) => el.dataset.lockDelete !== undefined) ?? null;
    if (selector === '[data-shell-lock]') return [...this.elements.values()].find((el) => el.dataset.shellLock !== undefined) ?? null;
    return null;
  }
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
    dump() { return Object.fromEntries(data); },
  };
}

function makeShellDom() {
  const doc = new FakeDocument();
  doc.add(new FakeElement('shell-main'));
  doc.add(new FakeElement('app-lock-screen'));
  doc.add(new FakeElement('lock-err'));
  doc.add(new FakeElement('lock-dots-container'));
  for (let i = 0; i < 4; i++) doc.add(new FakeElement(`lock-d${i}`));
  doc.add(new FakeElement('shell-tab-journal', { classes: ['shell-tab-btn'], role: true }));
  doc.add(new FakeElement('shell-tab-sklad', { classes: ['shell-tab-btn'], role: true }));
  doc.add(new FakeElement('frame-journal'));
  doc.add(new FakeElement('frame-sklad'));
  return doc;
}

function makeController({ rpcResult = true } = {}) {
  const calls = { rpc: [], timers: [], cleared: [] };
  const doc = makeShellDom();
  const win = {
    location: { origin: 'https://example.test' },
    addEventListener() {},
    setTimeout(handler, timeout) { calls.timers.push({ handler, timeout }); return calls.timers.length; },
    clearTimeout(id) { calls.cleared.push(id); },
  };
  const controller = createShellController({
    document: doc,
    window: win,
    navigator: {},
    rpc: async (fn, params) => { calls.rpc.push({ fn, params }); return rpcResult; },
    setTimeout: win.setTimeout.bind(win),
    clearTimeout: win.clearTimeout.bind(win),
  });
  return { controller, doc, calls };
}

test('ShellController switches tabs with lazy iframe loading and ARIA state', () => {
  globalThis.sessionStorage = memoryStorage();
  const { controller, doc } = makeController();

  controller.switchTab('sklad');

  assert.equal(doc.getElementById('frame-sklad').src, 'sklad/index.html?embed=1');
  assert.equal(doc.getElementById('frame-sklad').classList.contains('active'), true);
  assert.equal(doc.getElementById('shell-tab-sklad').classList.contains('active'), true);
  assert.equal(doc.getElementById('shell-tab-sklad').getAttribute('aria-current'), 'page');
  assert.equal(doc.getElementById('shell-tab-sklad').getAttribute('aria-selected'), 'true');
  assert.equal(doc.getElementById('shell-tab-journal').getAttribute('aria-selected'), 'false');
});

test('ShellController verifies a complete PIN through Supabase RPC and unlocks shell on success', async () => {
  globalThis.sessionStorage = memoryStorage();
  const { controller, doc, calls } = makeController({ rpcResult: true });

  for (const digit of ['1', '2', '3', '4']) await controller.lockPress(digit);

  assert.deepEqual(calls.rpc, [{ fn: 'verify_lock_pin', params: { attempt: '1234' } }]);
  assert.equal(globalThis.sessionStorage.getItem('auth'), 'ok');
  assert.equal(doc.getElementById('app-lock-screen').style.display, 'none');
  assert.equal(doc.getElementById('shell-main').style.display, 'flex');
  assert.equal(doc.getElementById('frame-journal').src, 'osbb/index.html?embed=1');
});

test('ShellController records failed PIN attempts, shakes dots, and clears visible error after lockout', async () => {
  globalThis.sessionStorage = memoryStorage();
  const { controller, doc, calls } = makeController({ rpcResult: false });

  for (const digit of ['9', '9', '9', '9']) await controller.lockPress(digit);

  assert.equal(doc.getElementById('lock-err').textContent, 'Невірний PIN, спробуйте ще');
  assert.equal(doc.getElementById('lock-dots-container').classList.contains('shake'), true);
  assert.equal(calls.timers.some((timer) => timer.timeout === 350), true);
  assert.equal(calls.timers.some((timer) => timer.timeout === 500), true);

  calls.timers.find((timer) => timer.timeout === 500).handler();
  assert.equal(doc.getElementById('lock-err').textContent, '');
});

test('ShellController lockShellNow clears auth and restores lock screen state', () => {
  globalThis.sessionStorage = memoryStorage({ auth: 'ok', auth_at: '12345' });
  const { controller, doc } = makeController();

  controller.lockShellNow();

  assert.deepEqual(globalThis.sessionStorage.dump(), {});
  assert.equal(doc.getElementById('shell-main').style.display, 'none');
  assert.equal(doc.getElementById('app-lock-screen').style.display, 'flex');
});
