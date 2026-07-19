import test from 'node:test';
import assert from 'node:assert/strict';

import { isShellTabName, ShellStore, TAB_SRC } from '../src/shell-state.ts';

test('ShellStore keeps PIN input bounded to four digits', () => {
  const store = new ShellStore();

  for (const digit of ['1', '2', '3', '4', '5']) store.pushDigit(digit);

  assert.equal(store.lockBuf, '1234');
});

test('ShellStore blocks PIN edits while busy', () => {
  const store = new ShellStore();
  store.pushDigit('1');
  store.setBusy(true);

  store.pushDigit('2');
  store.deleteDigit();

  assert.equal(store.lockBuf, '1');
});

test('ShellStore tracks failures and reset state separately', () => {
  const store = new ShellStore();

  assert.equal(store.recordFailure(), 1);
  assert.equal(store.recordFailure(), 2);
  store.resetFailures();

  assert.equal(store.lockFails, 0);
});

test('ShellStore tracks lazy-loaded tabs', () => {
  const store = new ShellStore();

  assert.equal(store.isTabLoaded('journal'), false);
  store.markTabLoaded('journal');

  assert.equal(store.isTabLoaded('journal'), true);
  assert.deepEqual(TAB_SRC, {
    journal: 'osbb/index.html?embed=1',
    sklad: 'sklad/index.html?embed=1',
  });
});

test('isShellTabName narrows only known shell tabs', () => {
  assert.equal(isShellTabName('journal'), true);
  assert.equal(isShellTabName('sklad'), true);
  assert.equal(isShellTabName('deye'), false);
  assert.equal(isShellTabName(undefined), false);
});
