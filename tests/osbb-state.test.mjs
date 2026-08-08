import test from 'node:test';
import assert from 'node:assert/strict';

import { createOsbbRuntimeState, jiraIssuesFromResponse } from '../src/osbb-state.js';

test('createOsbbRuntimeState returns isolated typed runtime collections', () => {
  const first = createOsbbRuntimeState();
  const second = createOsbbRuntimeState();

  assert.deepEqual(first, {
    staffLoginList: [], garbage: {}, attendance: {}, dispatcher: {}, shiftRows: {},
    photosCache: null, lightboxPhotos: [], jiraIssues: [], elevatorData: [],
  });
  assert.notEqual(first.staffLoginList, second.staffLoginList);
  assert.notEqual(first.garbage, second.garbage);
  assert.notEqual(first.attendance, second.attendance);
  assert.notEqual(first.dispatcher, second.dispatcher);
  assert.notEqual(first.shiftRows, second.shiftRows);
  assert.notEqual(first.lightboxPhotos, second.lightboxPhotos);
  assert.notEqual(first.jiraIssues, second.jiraIssues);
  assert.notEqual(first.elevatorData, second.elevatorData);
});

test('jiraIssuesFromResponse rejects malformed issues and normalizes text', () => {
  assert.deepEqual(jiraIssuesFromResponse([
    { key: ' MS-1 ', summary: ' Заміна лампи ', status: ' Open ', assignedRole: 'electrician' },
    { key: '', summary: 'Missing key' },
    { key: 'MS-2' },
    null,
  ]), [{
    key: 'MS-1', summary: 'Заміна лампи', priority: undefined, status: 'Open',
    category: undefined, assignedRole: 'electrician', url: undefined,
  }]);
  assert.deepEqual(jiraIssuesFromResponse({ issues: [] }), []);
});
