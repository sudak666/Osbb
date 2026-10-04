import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearStoredStaffSession,
  isDispatcherSession,
  isTabAllowedForSession,
  isWorkerSession,
  loadStoredStaffSession,
  parseStaffList,
  parseStaffSession,
  saveStoredStaffSession,
} from '../src/osbb-staff.js';

const session = (role) => ({ id: role, name: role, role });

const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
};

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

test('staff session storage round-trips validated sessions', () => {
  const storage = memoryStorage();
  const value = { id: ' worker-1 ', name: '  Іван  ', role: 'plumber' };
  assert.equal(saveStoredStaffSession(storage, value), true);
  assert.deepEqual(loadStoredStaffSession(storage), { id: 'worker-1', name: 'Іван', role: 'plumber' });
  clearStoredStaffSession(storage);
  assert.equal(loadStoredStaffSession(storage), null);
});

test('staff session storage removes malformed persisted data and tolerates storage failures', () => {
  const malformed = memoryStorage({ osbb_staff_session: '{broken' });
  assert.equal(loadStoredStaffSession(malformed), null);
  assert.equal(malformed.values.has('osbb_staff_session'), false);

  const unavailable = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.equal(loadStoredStaffSession(unavailable), null);
  assert.equal(saveStoredStaffSession(unavailable, session('admin')), false);
  assert.doesNotThrow(() => clearStoredStaffSession(unavailable));
});

test('staff list parser removes malformed server rows', () => {
  assert.deepEqual(parseStaffList([
    { id: ' worker-1 ', full_name: '  Іван  ', role: 'electrician' },
    { id: 'worker-2', full_name: '', role: 'plumber' },
    { id: 'worker-3', full_name: 'Олег', role: 'owner' },
  ]), [{ id: 'worker-1', full_name: 'Іван', role: 'electrician' }]);
  assert.deepEqual(parseStaffList(null), []);
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

test('tab gating keeps workers inside attendance and own tickets', () => {
  const worker = session('plumber');
  assert.equal(isTabAllowedForSession('tabel', worker), true);
  assert.equal(isTabAllowedForSession('my-tickets', worker), true);
  assert.equal(isTabAllowedForSession('shifts', worker), false);
  assert.equal(isTabAllowedForSession('garbage', worker), true);
});

test('all tabs except shifts are available to every session', () => {
  assert.equal(isTabAllowedForSession('dispatcher', null), true);
  assert.equal(isTabAllowedForSession('my-tickets', null), true);
  assert.equal(isTabAllowedForSession('my-tickets', session('board')), true);
  assert.equal(isTabAllowedForSession('garbage', session('dispatcher')), true);
  assert.equal(isTabAllowedForSession('completed-work', session('board')), true);
  assert.equal(isTabAllowedForSession('completed-work', session('plumber')), true);
  assert.equal(isTabAllowedForSession('completed-work', null), true);
  assert.equal(isTabAllowedForSession('shifts', session('dispatcher')), true);
});
