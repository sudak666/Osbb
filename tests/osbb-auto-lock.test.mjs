import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_AUTO_LOCK_MS,
  createAutoLockController,
  createAutoLockTimerApi,
} from '../src/osbb-auto-lock.js';

function fakeTimers() {
  let nextId = 0;
  const callbacks = new Map();
  return {
    api: {
      setTimeout(callback, delay) {
        const id = ++nextId;
        callbacks.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id) {
        callbacks.delete(id);
      },
    },
    callbacks,
  };
}

test('auto-lock reset keeps only the latest timer', () => {
  const timers = fakeTimers();
  let locks = 0;
  const controller = createAutoLockController(() => { locks++; }, 1_000, timers.api);

  controller.reset();
  controller.reset();

  assert.equal(timers.callbacks.size, 1);
  const [{ callback, delay }] = timers.callbacks.values();
  assert.equal(delay, 1_000);
  callback();
  assert.equal(locks, 1);
  assert.equal(timers.callbacks.size, 0);
});

test('auto-lock supports immediate lock and explicit stop', () => {
  const timers = fakeTimers();
  let locks = 0;
  const controller = createAutoLockController(() => { locks++; }, DEFAULT_AUTO_LOCK_MS, timers.api);

  controller.reset();
  controller.stop();
  assert.equal(timers.callbacks.size, 0);

  controller.reset();
  controller.lockNow();
  assert.equal(locks, 1);
  assert.equal(timers.callbacks.size, 0);
});

test('browser timer adapter preserves the host receiver', () => {
  const callbacks = new Map();
  const host = {
    setTimeout(callback, delay) {
      assert.equal(this, host);
      callbacks.set(1, { callback, delay });
      return 1;
    },
    clearTimeout(handle) {
      assert.equal(this, host);
      callbacks.delete(handle);
    },
  };
  const controller = createAutoLockController(
    () => {},
    1_000,
    createAutoLockTimerApi(host),
  );

  controller.reset();
  controller.reset();

  assert.equal(callbacks.size, 1);
});

test('auto-lock rejects invalid setup', () => {
  assert.throws(() => createAutoLockController(null), /callback/i);
  assert.throws(() => createAutoLockController(() => {}, 0), /delay/i);
  assert.throws(() => createAutoLockController(() => {}, 1.5), /delay/i);
});
