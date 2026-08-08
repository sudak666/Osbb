import test from 'node:test';
import assert from 'node:assert/strict';

import { createOsbbMonthState } from '../src/osbb-state.js';

test('createOsbbMonthState returns isolated empty month collections', () => {
  const first = createOsbbMonthState();
  const second = createOsbbMonthState();

  assert.deepEqual(first, { garbage: {}, attendance: {}, dispatcher: {} });
  assert.notEqual(first.garbage, second.garbage);
  assert.notEqual(first.attendance, second.attendance);
  assert.notEqual(first.dispatcher, second.dispatcher);
});
