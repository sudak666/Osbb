import test from 'node:test';
import assert from 'node:assert/strict';

import { clearAuthSession, isAuthSessionValid, setAuthSession } from '../src/auth-session.js';
import { AUTH_TTL_MS, isShellTabName, ShellStore, TAB_SRC } from '../src/shell-state.js';
import { SUPABASE_KEY, SUPABASE_URL } from '../src/supabase-api.js';

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

test('JS auth-session fallback preserves TTL behavior used by the PIN shell', () => {
  const storage = memoryStorage();

  setAuthSession(storage, 5000);

  assert.equal(isAuthSessionValid(storage, 5000 + AUTH_TTL_MS - 1), true);
  assert.equal(isAuthSessionValid(storage, 5000 + AUTH_TTL_MS), false);
  assert.deepEqual(storage.dump(), {});
});

test('JS ShellStore fallback preserves PIN editing and loaded-tab state', () => {
  const store = new ShellStore();

  for (const digit of ['1', '2', '3', '4', '5']) store.pushDigit(digit);
  store.markTabLoaded('sklad');

  assert.equal(store.lockBuf, '1234');
  assert.equal(store.isTabLoaded('journal'), false);
  assert.equal(store.isTabLoaded('sklad'), true);
  assert.deepEqual(TAB_SRC, {
    journal: 'osbb/index.html?embed=1',
    sklad: 'sklad/index.html?embed=1',
  });
});

test('JS shell fallback exports the same tab guard and Supabase endpoint constants', () => {
  assert.equal(isShellTabName('journal'), true);
  assert.equal(isShellTabName('sklad'), true);
  assert.equal(isShellTabName('settings'), false);
  assert.equal(SUPABASE_URL, 'https://vkwkyhjjjmcpmiakxohw.supabase.co');
  assert.equal(SUPABASE_KEY.startsWith('sb_publishable_'), true);
});

test('JS clearAuthSession fallback removes only auth session keys', () => {
  const storage = memoryStorage({ auth: 'ok', auth_at: '1000', theme: 'dark' });

  clearAuthSession(storage);

  assert.deepEqual(storage.dump(), { theme: 'dark' });
});
