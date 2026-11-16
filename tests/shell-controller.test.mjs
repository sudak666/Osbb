import test from 'node:test';
import assert from 'node:assert/strict';

import { createShellController } from '../src/shell-controller.js';

class FakeClassList {
  constructor(initial = []) { this.values = new Set(initial); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) { const on = force ?? !this.values.has(value); if (on) this.values.add(value); else this.values.delete(value); return on; }
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
    if (selector === '[data-shell-section]') return elements.filter((el) => el.dataset.shellSection !== undefined);
    if (selector === '[data-shell-more]') return elements.filter((el) => el.dataset.shellMore !== undefined);
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
  doc.add(new FakeElement('shell-home'));
  for (const section of ['home', 'garbage', 'tabel', 'items', 'log']) {
    doc.add(new FakeElement(`nav-${section}`)).dataset.shellSection = section;
  }
  doc.add(new FakeElement('nav-more')).dataset.shellMore = '';
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

test('ShellController opens module sections with lazy iframe loading and nav state', () => {
  globalThis.sessionStorage = memoryStorage();
  const { controller, doc } = makeController();

  controller.showSection('log');

  assert.equal(doc.getElementById('frame-sklad').src, 'sklad/index.html?embed=1&section=log');
  assert.equal(doc.getElementById('frame-sklad').classList.contains('active'), true);
  assert.equal(doc.getElementById('shell-home').hidden, true);
  assert.equal(doc.getElementById('nav-log').classList.contains('active'), true);
  assert.equal(doc.getElementById('nav-log').getAttribute('aria-current'), 'page');
  assert.equal(doc.getElementById('nav-items').getAttribute('aria-current'), null);
  // «Рух» живе в листі «Ще» на телефоні — кнопка «Ще» підсвічується.
  assert.equal(doc.getElementById('nav-more').classList.contains('active'), true);
  assert.equal(controller.getSection(), 'log');
});

test('ShellController sends later sections of a loaded module through postMessage', () => {
  globalThis.sessionStorage = memoryStorage();
  const { controller, doc } = makeController();
  const frame = doc.getElementById('frame-journal');
  const messages = [];
  frame.contentWindow = { postMessage(message, origin) { messages.push({ message, origin }); } };
  controller.bind();

  controller.showSection('garbage');
  assert.equal(frame.src, 'osbb/index.html?embed=1');
  frame.listeners.get('load')();
  controller.showSection('tabel');

  assert.deepEqual(messages.at(-1), { message: { type: 'osbb:navigate', section: 'tabel' }, origin: 'https://example.test' });
  assert.equal(doc.getElementById('nav-tabel').getAttribute('aria-current'), 'page');
});

test('ShellController passes an allowed focus target to the module and drops unknown ones', () => {
  globalThis.sessionStorage = memoryStorage();
  const { controller, doc } = makeController();
  const frame = doc.getElementById('frame-journal');
  const messages = [];
  frame.contentWindow = { postMessage(message) { messages.push(message); } };
  controller.bind();

  controller.showSection('completed-work', 'elevator');
  assert.equal(frame.src, 'osbb/index.html?embed=1&section=completed-work&focus=elevator');
  frame.listeners.get('load')();
  controller.showSection('completed-work', 'elevator');
  assert.deepEqual(messages.at(-1), { type: 'osbb:navigate', section: 'completed-work', focus: 'elevator' });
  controller.showSection('completed-work', '<script>');
  assert.deepEqual(messages.at(-1), { type: 'osbb:navigate', section: 'completed-work' });
});

test('ShellController switchTab reopens the last section of a module and home hides frames', () => {
  globalThis.sessionStorage = memoryStorage();
  const { controller, doc } = makeController();

  controller.showSection('log');
  controller.showSection('home');
  assert.equal(doc.getElementById('shell-home').hidden, false);
  assert.equal(doc.getElementById('frame-sklad').classList.contains('active'), false);

  controller.switchTab('sklad');
  assert.equal(controller.getSection(), 'log');
});

test('ShellController ignores unknown tab and section payloads', () => {
  globalThis.sessionStorage = memoryStorage();
  const { controller, doc } = makeController();
  controller.switchTab('__proto__');
  controller.switchTab('<img onerror=alert(1)>');
  controller.showSection('constructor');
  controller.showSection('<img onerror=alert(1)>');
  assert.equal(doc.getElementById('frame-journal').src, '');
  assert.equal(doc.getElementById('frame-sklad').src, '');
});

test('ShellController verifies a complete PIN through Supabase RPC and unlocks shell on success', async () => {
  globalThis.sessionStorage = memoryStorage();
  const { controller, doc, calls } = makeController({ rpcResult: true });

  for (const digit of ['1', '2', '3', '4']) await controller.lockPress(digit);

  assert.deepEqual(calls.rpc, [{ fn: 'verify_lock_pin', params: { attempt: '1234' } }]);
  assert.equal(globalThis.sessionStorage.getItem('auth'), 'ok');
  assert.equal(doc.getElementById('app-lock-screen').style.display, 'none');
  assert.equal(doc.getElementById('shell-main').style.display, 'flex');
  // Після входу відкривається «Головна»; модулі вантажаться лише на вимогу.
  assert.equal(doc.getElementById('shell-home').hidden, false);
  assert.equal(doc.getElementById('frame-journal').src, '');
});

test('ShellController notifies embedded modules after unlock', () => {
  globalThis.sessionStorage = memoryStorage({ auth: 'ok', auth_at: String(Date.now()) });
  const { controller, doc } = makeController();
  const messages = [];
  const embeddedLocks = [];
  for (const id of ['frame-journal', 'frame-sklad']) {
    const frame = doc.getElementById(id);
    const embeddedLock = new FakeElement(id === 'frame-sklad' ? 'authScreen' : 'app-lock-screen');
    embeddedLocks.push(embeddedLock);
    frame.contentDocument = {
      getElementById(targetId) { return targetId === embeddedLock.id ? embeddedLock : null; },
    };
    frame.contentWindow = {
      postMessage(message, origin) { messages.push({ id, message, origin }); },
    };
  }

  controller.unlockShell('3535');

  assert.equal(messages.length, 2);
  assert.equal(embeddedLocks.every(lock => lock.style.display === 'none'), true);
  assert.deepEqual(messages[0], {
    id: 'frame-journal',
    message: { type: 'osbb:shell-unlocked', mainPin: '3535' },
    origin: 'https://example.test',
  });
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
