import test from 'node:test';
import assert from 'node:assert/strict';

import { clearAuthSession, isAuthSessionValid, setAuthSession } from '../src/auth-session.ts';
import { AUTH_TTL_MS } from '../src/shell-state.ts';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    dump() {
      return Object.fromEntries(data);
    },
  };
}

test('setAuthSession writes auth flag and timestamp', () => {
  const storage = memoryStorage();

  setAuthSession(storage, 12345);

  assert.deepEqual(storage.dump(), { auth: 'ok', auth_at: '12345' });
});

test('isAuthSessionValid accepts a fresh session', () => {
  const storage = memoryStorage({ auth: 'ok', auth_at: '1000' });

  assert.equal(isAuthSessionValid(storage, 1000 + AUTH_TTL_MS - 1), true);
  assert.deepEqual(storage.dump(), { auth: 'ok', auth_at: '1000' });
});

test('isAuthSessionValid clears expired sessions', () => {
  const storage = memoryStorage({ auth: 'ok', auth_at: '1000' });

  assert.equal(isAuthSessionValid(storage, 1000 + AUTH_TTL_MS), false);
  assert.deepEqual(storage.dump(), {});
});

test('clearAuthSession removes both session keys', () => {
  const storage = memoryStorage({ auth: 'ok', auth_at: '1000', other: 'keep' });

  clearAuthSession(storage);

  assert.deepEqual(storage.dump(), { other: 'keep' });
});
