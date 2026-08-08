import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbLockController } from '../src/osbb-lock-controller.js';

class FakeElement {
  constructor(id) { this.id = id; this.textContent = ''; this.style = {}; }
  querySelector() { return this.box ?? null; }
}
class FakeDocument {
  constructor() { this.elements = new Map(); }
  add(id) { const element = new FakeElement(id); this.elements.set(id, element); return element; }
  getElementById(id) { return this.elements.get(id) ?? null; }
}

function makeController(overrides = {}) {
  const document = new FakeDocument();
  const screen = document.add('app-lock-screen');
  screen.box = new FakeElement('box');
  document.add('lock-err');
  for (let i = 0; i < 4; i++) document.add(`lock-d${i}`);
  const attempts = [];
  const timers = [];
  let unlocked = 0;
  const controller = createOsbbLockController({
    document,
    verifyPin: async pin => { attempts.push(pin); return true; },
    onUnlocked: () => { unlocked++; },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    ...overrides,
  });
  return { controller, document, screen, attempts, timers, unlocked: () => unlocked };
}

async function enterPin(controller, pin = '1234') {
  for (const digit of pin) await controller.press(digit);
}

test('OSBB lock verifies PIN once and unlocks with fade', async () => {
  const { controller, screen, attempts, timers, unlocked } = makeController();
  await enterPin(controller);
  assert.deepEqual(attempts, ['1234']);
  assert.equal(unlocked(), 1);
  assert.equal(screen.style.opacity, '0');
  assert.equal(timers.find(timer => timer.delay === 350) !== undefined, true);
});

test('OSBB lock blocks retry until incremental lockout ends', async () => {
  let calls = 0;
  const { controller, document, timers } = makeController({ verifyPin: async () => { calls++; return false; } });
  await enterPin(controller);
  await enterPin(controller, '9999');
  assert.equal(calls, 1);
  assert.equal(document.getElementById('lock-err').textContent, 'Невірний PIN, спробуйте ще');
  const lockout = timers.find(timer => timer.delay === 500);
  assert.ok(lockout);
  lockout.callback();
  await enterPin(controller, '9999');
  assert.equal(calls, 2);
});

test('show resets lock state and hide bypasses the screen', () => {
  const { controller, screen, document } = makeController();
  document.getElementById('lock-err').textContent = 'old';
  controller.show();
  assert.equal(screen.style.display, 'flex');
  assert.equal(document.getElementById('lock-err').textContent, '');
  controller.hide();
  assert.equal(screen.style.display, 'none');
});
