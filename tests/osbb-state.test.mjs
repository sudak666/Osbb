import test from 'node:test';
import assert from 'node:assert/strict';

import { createOsbbRuntimeState } from '../src/osbb-state.js';

test('createOsbbRuntimeState returns isolated typed runtime collections', () => {
  const first = createOsbbRuntimeState();
  const second = createOsbbRuntimeState();

  assert.deepEqual(first, {
    staffLoginList: [], garbage: {}, attendance: {}, shiftRows: {},
    photosCache: null, lightboxPhotos: [], elevatorData: [],
  });
  assert.notEqual(first.staffLoginList, second.staffLoginList);
  assert.notEqual(first.garbage, second.garbage);
  assert.notEqual(first.attendance, second.attendance);
  assert.notEqual(first.shiftRows, second.shiftRows);
  assert.notEqual(first.lightboxPhotos, second.lightboxPhotos);
  assert.notEqual(first.elevatorData, second.elevatorData);
});

