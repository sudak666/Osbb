import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladDeletePinController } from '../src/sklad-delete-pin-controller.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(value, force) { force ? this.values.add(value) : this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}
class FakeElement {
  constructor(id) { this.id = id; this.textContent = ''; this.classList = new FakeClassList(); }
}
class FakeDocument {
  constructor() { this.elements = new Map(); }
  add(id) { const element = new FakeElement(id); this.elements.set(id, element); return element; }
  getElementById(id) { return this.elements.get(id) ?? null; }
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function makeController() {
  const document = new FakeDocument();
  document.add('delPinModal');
  document.add('delPinTitle');
  document.add('delPinErr');
  for (let i = 0; i < 4; i++) document.add(`dp${i}`);
  const opened = [];
  const closed = [];
  const timers = [];
  const warnings = [];
  const controller = createSkladDeletePinController({
    document,
    openModal: id => opened.push(id),
    closeModal: id => closed.push(id),
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    warn: (...args) => warnings.push(args),
  });
  return { controller, document, opened, closed, timers, warnings };
}

async function enterPin(controller, pin = '1234') {
  for (const digit of pin) await controller.press(digit);
}

test('delete PIN controller runs one complete action and closes on success', async () => {
  const attempts = [];
  const { controller, document, opened, closed } = makeController();
  controller.show('Видалити товар', async pin => { attempts.push(pin); return { ok: true }; });
  await enterPin(controller);
  assert.deepEqual(attempts, ['1234']);
  assert.deepEqual(opened, ['delPinModal']);
  assert.deepEqual(closed, ['delPinModal']);
  assert.equal(document.getElementById('delPinTitle').textContent, 'Видалити товар');
});

test('delete PIN controller blocks concurrent attempts and maps transport failures', async () => {
  const pending = deferred();
  let calls = 0;
  const { controller, document, warnings } = makeController();
  controller.show('Видалити', async () => { calls++; await pending.promise; throw new Error('offline'); });
  const firstAttempt = enterPin(controller);
  while (calls === 0) await Promise.resolve();
  await enterPin(controller, '9999');
  assert.equal(calls, 1);
  pending.resolve();
  await firstAttempt;
  assert.equal(document.getElementById('delPinErr').textContent, 'Помилка мережі, спробуйте ще');
  assert.equal(warnings.length, 1);
});

test('stale delayed failure cannot close a replacement delete action', async () => {
  const { controller, closed, timers } = makeController();
  controller.show('Старе', async () => ({ ok: false, reason: 'not_found' }));
  await enterPin(controller);
  assert.equal(timers[0].delay, 1_600);
  controller.show('Нове', async () => ({ ok: true }));
  timers[0].callback();
  assert.deepEqual(closed, []);
  await enterPin(controller, '5678');
  assert.deepEqual(closed, ['delPinModal']);
});
