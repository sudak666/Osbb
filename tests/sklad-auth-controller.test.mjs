import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladAuthController } from '../src/sklad-auth-controller.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(value, force) { force ? this.values.add(value) : this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}
class FakeElement {
  constructor(id) { this.id = id; this.style = {}; this.textContent = ''; this.classList = new FakeClassList(); this.dataset = {}; this.listeners = new Map(); }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
}
class FakeDocument {
  constructor() { this.elements = new Map(); this.authBox = new FakeElement('auth-box'); }
  add(element) { this.elements.set(element.id, element); return element; }
  getElementById(id) { return this.elements.get(id) ?? null; }
  querySelector(selector) { return selector === '.auth-box' ? this.authBox : null; }
  querySelectorAll(selector) { return selector === '[data-auth-pin-key]' ? [...this.elements.values()].filter((item) => item.dataset.authPinKey !== undefined) : []; }
}

function makeController(rpc) {
  const doc = new FakeDocument();
  doc.add(new FakeElement('authScreen'));
  doc.add(new FakeElement('authErr'));
  for (let i = 0; i < 4; i++) doc.add(new FakeElement(`d${i}`));
  const storageValues = new Map();
  const storage = { getItem: (key) => storageValues.get(key) ?? null, setItem: (key, value) => storageValues.set(key, value), removeItem: (key) => storageValues.delete(key) };
  const timers = [];
  const controller = createSkladAuthController({ document: doc, storage, rpc, setTimeout: (handler, delay) => { timers.push({ handler, delay }); return timers.length; } });
  return { controller, doc, storageValues, timers };
}

test('Sklad auth controller verifies a complete PIN and stores the session', async () => {
  const attempts = [];
  const { controller, doc, storageValues, timers } = makeController(async (attempt) => { attempts.push(attempt); return true; });
  for (const digit of ['1', '2', '3', '4']) await controller.press(digit);
  assert.deepEqual(attempts, ['1234']);
  assert.equal(storageValues.get('auth'), 'ok');
  assert.equal(doc.getElementById('authScreen').style.opacity, '0');
  assert.equal(timers.at(-1).delay, 320);
});

test('Sklad auth controller rejects malformed keys and applies bounded retry delay', async () => {
  const attempts = [];
  const { controller, doc, timers } = makeController(async (attempt) => { attempts.push(attempt); return false; });
  await controller.press('<script>');
  for (const digit of ['9', '8', '7', '6']) await controller.press(digit);
  assert.deepEqual(attempts, ['9876']);
  assert.equal(doc.getElementById('authErr').textContent, 'Невірний PIN-код');
  assert.equal(timers.at(-1).delay, 900);
  timers.at(-1).handler();
  assert.equal(doc.getElementById('authErr').textContent, '');
});

test('Sklad auth controller binds keypad buttons without globals', () => {
  const { controller, doc } = makeController(async () => true);
  const button = doc.add(new FakeElement('key-1'));
  button.dataset.authPinKey = '1';
  controller.bind();
  assert.equal(typeof button.listeners.get('click'), 'function');
});
