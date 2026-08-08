import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbStaffAuthController } from '../src/osbb-staff-auth-controller.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) { force ? this.values.add(value) : this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}
class FakeElement {
  constructor(id) { this.id = id; this.textContent = ''; this.innerHTML = ''; this.style = {}; this.classList = new FakeClassList(); }
}
class FakeDocument {
  constructor() { this.elements = new Map(); }
  add(id) { const element = new FakeElement(id); this.elements.set(id, element); return element; }
  getElementById(id) { return this.elements.get(id) ?? null; }
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function makeController(overrides = {}) {
  const document = new FakeDocument();
  for (const id of ['staff-login-modal', 'staff-login-list', 'staff-login-pin-step', 'staff-login-pin-sub', 'staff-login-err', 'staff-settings-modal', 'staff-settings-list']) document.add(id);
  for (let i = 0; i < 4; i++) document.add(`staff-pin-d${i}`);
  const authenticated = [];
  const timers = [];
  const accessUpdates = [];
  const errors = [];
  const controller = createOsbbStaffAuthController({
    document,
    isPreview: false,
    loadStaff: async () => [{ id: 7, full_name: 'Диспетчер', role: 'dispatcher' }],
    verifyPin: async () => [{ ok: true, full_name: 'Диспетчер', role: 'dispatcher' }],
    renderStaffList: rows => rows.map(row => `<button data-staff-select="${row.id}">${row.full_name}</button>`).join(''),
    renderStaffSettings: (rows, currentId) => rows.map(row => `${row.id}:${row.active}:${row.id === currentId}`).join(','),
    getSession: () => ({ id: 7, name: 'Адмін', role: 'admin' }),
    getPin: () => '1234',
    loadStaffSettings: async () => [{ id: 7, full_name: 'Адмін', role: 'admin', active: true }],
    setStaffActive: async () => true,
    onAuthenticated: (session, pin) => authenticated.push({ session, pin }),
    onAccessUpdated: () => accessUpdates.push(true),
    onError: (message, error) => errors.push({ message, error }),
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    ...overrides,
  });
  return { controller, document, authenticated, timers, accessUpdates, errors };
}

async function enterPin(controller, pin = '1234') {
  for (const digit of pin) await controller.press(digit);
}

test('staff auth loads, selects and verifies a normalized session', async () => {
  const attempts = [];
  const { controller, document, authenticated } = makeController({
    verifyPin: async (staffId, pin) => { attempts.push({ staffId, pin }); return [{ ok: true, full_name: ' Диспетчер ', role: 'dispatcher' }]; },
  });
  await controller.open();
  assert.match(document.getElementById('staff-login-list').innerHTML, /data-staff-select="7"/u);
  controller.select('7');
  assert.equal(document.getElementById('staff-login-pin-sub').textContent, 'PIN для «Диспетчер»');
  await enterPin(controller);
  assert.deepEqual(attempts, [{ staffId: 7, pin: '1234' }]);
  assert.deepEqual(authenticated, [{ session: { id: 7, name: 'Диспетчер', role: 'dispatcher' }, pin: '1234' }]);
  assert.equal(document.getElementById('staff-login-modal').style.display, 'none');
});

test('failed verification locks input and permits retry after timer', async () => {
  let calls = 0;
  const { controller, document, timers } = makeController({ verifyPin: async () => { calls++; return [{ ok: false }]; } });
  await controller.open();
  controller.select(7);
  await enterPin(controller);
  await enterPin(controller, '9999');
  assert.equal(calls, 1);
  assert.equal(document.getElementById('staff-login-err').textContent, 'Невірний PIN, спробуйте ще');
  assert.equal(timers[0].delay, 500);
  timers[0].callback();
  await enterPin(controller, '9999');
  assert.equal(calls, 2);
});

test('reauth confirms the same session and can be cancelled', async () => {
  const { controller, authenticated } = makeController();
  const session = { id: 9, name: 'Правління', role: 'board' };
  const confirmed = controller.requestReauth(session);
  await enterPin(controller, '5678');
  assert.equal(await confirmed, true);
  assert.deepEqual(authenticated[0], { session: { id: 9, name: 'Диспетчер', role: 'dispatcher' }, pin: '5678' });

  const cancelled = controller.requestReauth(session);
  controller.back();
  assert.equal(await cancelled, false);
});

test('pending stale verification cannot authenticate a replacement selection', async () => {
  const pending = deferred();
  const { controller, authenticated } = makeController({
    loadStaff: async () => [
      { id: 7, full_name: 'Перший', role: 'dispatcher' },
      { id: 8, full_name: 'Другий', role: 'admin' },
    ],
    verifyPin: async () => pending.promise,
  });
  await controller.open();
  controller.select(7);
  const first = enterPin(controller);
  controller.select(8);
  pending.resolve([{ ok: true, full_name: 'Перший', role: 'dispatcher' }]);
  await first;
  assert.deepEqual(authenticated, []);
});

test('staff settings load only for privileged sessions through parser boundary', async () => {
  const calls = [];
  const { controller, document } = makeController({
    loadStaffSettings: async (session, pin) => {
      calls.push({ session, pin });
      return [
        { id: 7, full_name: 'Адмін', role: 'admin', active: true },
        { id: null, full_name: '<bad>', role: 'root', active: true },
      ];
    },
  });
  await controller.openSettings();
  assert.equal(document.getElementById('staff-settings-modal').style.display, 'flex');
  assert.equal(document.getElementById('staff-settings-list').innerHTML, '7:true:true');
  assert.equal(calls.length, 1);
});

test('staff access toggle is single-flight and refreshes settings on success', async () => {
  const pending = deferred();
  const changes = [];
  const { controller, accessUpdates } = makeController({
    setStaffActive: async (...args) => { changes.push(args); return pending.promise; },
  });
  const firstButton = { dataset: { staffActive: '8', nextActive: 'false' }, disabled: false };
  const secondButton = { dataset: { staffActive: '9', nextActive: 'true' }, disabled: false };
  const first = controller.toggleAccess(firstButton);
  await controller.toggleAccess(secondButton);
  assert.equal(changes.length, 1);
  assert.equal(firstButton.disabled, true);
  pending.resolve(true);
  await first;
  assert.deepEqual(changes[0].slice(1), ['1234', '8', false]);
  assert.deepEqual(accessUpdates, [true]);
});

test('closing settings ignores a stale load response', async () => {
  const pending = deferred();
  const { controller, document } = makeController({ loadStaffSettings: async () => pending.promise });
  const loading = controller.openSettings();
  controller.closeSettings();
  pending.resolve([{ id: 8, full_name: 'Працівник', role: 'plumber', active: true }]);
  await loading;
  assert.equal(document.getElementById('staff-settings-modal').style.display, 'none');
  assert.match(document.getElementById('staff-settings-list').innerHTML, /Завантаження/u);
});
