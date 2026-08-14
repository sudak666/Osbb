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
  for (const id of ['staff-login-modal', 'staff-login-list', 'staff-login-pin-step', 'staff-login-pin-sub', 'staff-login-err']) document.add(id);
  for (let i = 0; i < 4; i++) document.add(`staff-pin-d${i}`);
  const authenticated = [];
  const timers = [];
  const controller = createOsbbStaffAuthController({
    document,
    isPreview: false,
    loadStaff: async () => [{ id: 7, full_name: 'Диспетчер', role: 'dispatcher' }],
    verifyPin: async () => [{ ok: true, full_name: 'Диспетчер', role: 'dispatcher' }],
    renderStaffList: rows => rows.map(row => `<button data-staff-select="${row.id}">${row.full_name}</button>`).join(''),
    onAuthenticated: (session, pin) => authenticated.push({ session, pin }),
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    ...overrides,
  });
  return { controller, document, authenticated, timers };
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

test('operator filter hides worker profiles and skips selection when only one remains', async () => {
  const { controller, document } = makeController({
    loadStaff: async () => [
      { id: 7, full_name: 'Керування', role: 'dispatcher' },
      { id: 8, full_name: 'Сантехнік', role: 'plumber' },
    ],
    filterStaff: person => ['dispatcher', 'admin', 'board'].includes(person.role),
  });
  await controller.open();
  assert.doesNotMatch(document.getElementById('staff-login-list').innerHTML, /Сантехнік/u);
  assert.equal(document.getElementById('staff-login-list').classList.contains('hidden'), true);
  assert.equal(document.getElementById('staff-login-pin-sub').textContent, 'PIN для «Керування»');
});

test('single operator reuses the PIN already verified by the shell', async () => {
  const attempts = [];
  const { controller, authenticated } = makeController({
    loadStaff: async () => [
      { id: 9, full_name: 'Правління', role: 'board' },
      { id: 8, full_name: 'Сантехнік', role: 'plumber' },
    ],
    filterStaff: person => ['dispatcher', 'admin', 'board'].includes(person.role),
    verifyPin: async (staffId, pin) => {
      attempts.push({ staffId, pin });
      return [{ ok: true, full_name: 'Правління', role: 'board' }];
    },
  });

  assert.equal(await controller.authenticateSingle('3535'), true);
  assert.deepEqual(attempts, [{ staffId: 9, pin: '3535' }]);
  assert.deepEqual(authenticated, [{ session: { id: 9, name: 'Правління', role: 'board' }, pin: '3535' }]);
});
