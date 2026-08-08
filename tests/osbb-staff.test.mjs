import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canManageStaffAccess,
  isDispatcherSession,
  isTabAllowedForSession,
  isWorkerSession,
  normalizeWorkerRole,
  parseStaffList,
  parseStaffSettingsList,
  parseStaffSession,
} from '../src/osbb-staff.js';

const session = (role) => ({ id: role, name: role, role });

test('staff session parser accepts only complete known-role sessions', () => {
  assert.deepEqual(parseStaffSession({ id: ' worker-1 ', name: '  Іван  ', role: 'plumber' }), {
    id: 'worker-1',
    name: 'Іван',
    role: 'plumber',
  });
  assert.equal(parseStaffSession({ id: 'worker-1', name: 'Іван', role: 'unknown' }), null);
  assert.equal(parseStaffSession({ id: Number.NaN, name: 'Іван', role: 'plumber' }), null);
  assert.equal(parseStaffSession(null), null);
});

test('staff list parser removes malformed server rows', () => {
  assert.deepEqual(parseStaffList([
    { id: ' worker-1 ', full_name: '  Іван  ', role: 'electrician' },
    { id: 'worker-2', full_name: '', role: 'plumber' },
    { id: 'worker-3', full_name: 'Олег', role: 'owner' },
  ]), [{ id: 'worker-1', full_name: 'Іван', role: 'electrician' }]);
  assert.deepEqual(parseStaffList(null), []);
});

test('staff boundaries reject oversized attributes and coerce no active flags', () => {
  assert.equal(parseStaffSession({ id: '\" onclick=alert(1)', name: 'x'.repeat(101), role: 'admin' }), null);
  assert.deepEqual(parseStaffSettingsList([
    { id: 'admin-1', full_name: '<img onerror=alert(1)>', role: 'admin', active: true, malicious: '<script>alert(1)</script>' },
    { id: 'admin-2', full_name: 'Другий', role: 'admin', active: 'false' },
    { id: '__proto__', full_name: 'Третій', role: 'unknown', active: false },
  ]), [{ id: 'admin-1', full_name: '<img onerror=alert(1)>', role: 'admin', active: true }]);
});

test('staff role helpers preserve full-access and worker role groups', () => {
  for (const role of ['dispatcher', 'admin', 'board']) {
    assert.equal(isDispatcherSession(session(role)), true);
    assert.equal(isWorkerSession(session(role)), false);
  }
  for (const role of ['plumber', 'janitor', 'electrician']) {
    assert.equal(isDispatcherSession(session(role)), false);
    assert.equal(isWorkerSession(session(role)), true);
  }
  assert.equal(isDispatcherSession(null), false);
  assert.equal(isWorkerSession(session('unknown')), false);
});

test('worker role normalization rejects full-access and unknown roles', () => {
  assert.equal(normalizeWorkerRole('electrician'), 'electrician');
  assert.equal(normalizeWorkerRole('admin'), 'plumber');
  assert.equal(normalizeWorkerRole('unknown', 'janitor'), 'janitor');
});

test('only board and admin can manage staff access', () => {
  assert.equal(canManageStaffAccess(session('board')), true);
  assert.equal(canManageStaffAccess(session('admin')), true);
  assert.equal(canManageStaffAccess(session('dispatcher')), false);
  assert.equal(canManageStaffAccess(null), false);
});

test('tab gating keeps workers inside attendance and own tickets', () => {
  const worker = session('plumber');
  assert.equal(isTabAllowedForSession('tabel', worker), true);
  assert.equal(isTabAllowedForSession('my-tickets', worker), true);
  assert.equal(isTabAllowedForSession('dispatcher', worker), false);
  assert.equal(isTabAllowedForSession('garbage', worker), false);
});

test('dispatcher tab remains available before staff login but own tickets require full access', () => {
  assert.equal(isTabAllowedForSession('dispatcher', null), true);
  assert.equal(isTabAllowedForSession('my-tickets', null), false);
  assert.equal(isTabAllowedForSession('my-tickets', session('board')), true);
  assert.equal(isTabAllowedForSession('garbage', session('dispatcher')), true);
});
