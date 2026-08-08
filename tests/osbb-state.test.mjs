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

test('jira issue boundary bounds malicious payloads and whitelists roles', () => {
  assert.deepEqual(jiraIssuesFromResponse([
    { key: 'MS-9', summary: '<img src=x onerror=alert(1)>', assignedRole: '<svg onload=alert(1)>', status: 'x'.repeat(101), url: 'javascript:alert(1)', malicious: '<script>alert(1)</script>' },
    { key: 'MS-10', summary: 'x'.repeat(1001), assignedRole: 'plumber' },
  ]), [{
    key: 'MS-9', summary: '<img src=x onerror=alert(1)>', priority: undefined, status: undefined,
    category: undefined, assignedRole: undefined, url: 'javascript:alert(1)',
  }]);
});
