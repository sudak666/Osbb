import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canManageStaffAccess,
  isDispatcherSession,
  isTabAllowedForSession,
  isWorkerSession,
} from '../src/osbb-staff.js';

const session = (role) => ({ id: role, name: role, role });

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
