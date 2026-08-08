import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbPinModalController } from '../src/osbb-pin-modal-controller.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(value, force) { force ? this.values.add(value) : this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}
class FakeElement {
  constructor(id) { this.id = id; this.textContent = ''; this.innerHTML = ''; this.style = {}; this.classList = new FakeClassList(); this.focused = false; this.offsetParent = {}; }
  focus() { this.focused = true; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
class FakeDocument {
  constructor() { this.elements = new Map(); this.activeElement = null; }
  add(id) { const element = new FakeElement(id); this.elements.set(id, element); return element; }
  getElementById(id) { return this.elements.get(id) ?? null; }
  contains(element) { return [...this.elements.values()].includes(element); }
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function makeController(overrides = {}) {
  const document = new FakeDocument();
  const overlay = document.add('pin-modal');
  const dialog = new FakeElement('dialog');
  const box = new FakeElement('box');
  overlay.querySelector = selector => selector === '[role="dialog"]' ? dialog : selector === ':scope > div' ? box : null;
  for (const id of ['pin-modal-title', 'pin-modal-sub', 'pin-modal-icon', 'pin-err']) document.add(id);
  for (let i = 0; i < 4; i++) document.add(`pin-d${i}`);
  const attempts = [];
  const timers = [];
  const controller = createOsbbPinModalController({
    document,
    verifyPin: async (rpc, pin) => { attempts.push({ rpc, pin }); return true; },
    requestAnimationFrame: callback => { callback(0); return 1; },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    ...overrides,
  });
  return { controller, document, overlay, dialog, box, attempts, timers };
}

async function enterPin(controller, pin = '1234') {
  for (const digit of pin) await controller.press(digit);
}

test('PIN modal verifies configured RPC, passes PIN and restores focus', async () => {
  const { controller, document, overlay, attempts } = makeController();
  const opener = document.add('opener');
  document.activeElement = opener;
  const accepted = [];
  controller.show(pin => accepted.push(pin), { title: 'Видалення', subtitle: 'Підтвердіть', danger: true, verifyRpc: 'verify_delete_pin' });
  assert.equal(overlay.style.display, 'flex');
  assert.equal(document.getElementById('pin-modal-title').textContent, 'Видалення');
  assert.match(document.getElementById('pin-modal-icon').innerHTML, /delete/u);
  await enterPin(controller);
  assert.deepEqual(attempts, [{ rpc: 'verify_delete_pin', pin: '1234' }]);
  assert.deepEqual(accepted, ['1234']);
  assert.equal(overlay.style.display, 'none');
  assert.equal(opener.focused, true);
});

test('PIN modal blocks concurrent verification and supports retry', async () => {
  const pending = deferred();
  let calls = 0;
  const { controller, document } = makeController({ verifyPin: async () => { calls++; return pending.promise; } });
  controller.show(() => {});
  const first = enterPin(controller);
  while (calls === 0) await Promise.resolve();
  await controller.deleteDigit();
  await enterPin(controller, '9999');
  assert.equal(calls, 1);
  pending.resolve(false);
  await first;
  assert.equal(document.getElementById('pin-err').textContent, 'Невірний PIN, спробуйте ще');
});

test('stale verification cannot run a replacement callback', async () => {
  const pending = deferred();
  const accepted = [];
  const { controller } = makeController({ verifyPin: async () => pending.promise });
  controller.show(pin => accepted.push(`old:${pin}`));
  const first = enterPin(controller);
  controller.show(pin => accepted.push(`new:${pin}`));
  pending.resolve(true);
  await first;
  assert.deepEqual(accepted, []);
});

test('Escape cancels PIN modal without invoking callback', () => {
  const accepted = [];
  const { controller, overlay } = makeController();
  controller.show(pin => accepted.push(pin));
  let prevented = false;
  controller.handleKeydown({ key: 'Escape', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(overlay.style.display, 'none');
  assert.deepEqual(accepted, []);
});
