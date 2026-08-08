import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PIN_LOCKOUT_MS,
  appendPinDigit,
  deletePinDigit,
  isPinComplete,
  pinLockoutDelay,
} from '../src/osbb-pin.js';

test('PIN input accepts one decimal digit and remains four digits long', () => {
  let value = '';
  for (const digit of ['1', '2', '3', '4', '5']) value = appendPinDigit(value, digit);
  assert.equal(value, '1234');
  assert.equal(isPinComplete(value), true);
  assert.equal(isPinComplete('12a4'), false);
});

test('PIN input rejects malformed delegated-control payloads', () => {
  for (const digit of ['', '10', '-1', 'x', null, undefined]) {
    assert.equal(appendPinDigit('12', digit), '12');
  }
  assert.equal(deletePinDigit('123'), '12');
  assert.equal(deletePinDigit(''), '');
});

test('PIN lockout delay grows gradually and stays bounded', () => {
  assert.equal(pinLockoutDelay(0), 0);
  assert.equal(pinLockoutDelay(1), 500);
  assert.equal(pinLockoutDelay(3.9), 1_500);
  assert.equal(pinLockoutDelay(100), MAX_PIN_LOCKOUT_MS);
  assert.equal(pinLockoutDelay(Number.NaN), 0);
});
