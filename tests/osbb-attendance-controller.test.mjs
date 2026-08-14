import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbAttendanceController } from '../src/osbb-attendance-controller.js';

function fixture(overrides = {}) {
  const values = new Map(); const status = { className:'', innerHTML:'' }; const stats = { innerHTML:'' }; let renders = 0;
  const options = {
    document: { getElementById: id => id === 'att-sync-status' ? status : id === 'att-stats-grid' ? stats : null, querySelectorAll: () => [] },
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, isPreview:false,
    getMonth: () => ({ year:2026, month:7, days:31 }), getSession: () => ({ id:'staff-1', role:'dispatcher' }), getPin: () => '1234', clearPin() {},
    isDispatcher: () => true, isWorker: () => false, roles:['plumber','janitor','electrician'], roleNames:{ plumber:'Сантехнік', janitor:'Двірник', electrician:'Електрик' },
    readOffline: (storage, key) => { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; }, writeOffline: (storage, key, value) => storage.setItem(key, JSON.stringify(value)),
    loadCloud: async () => ({ data:{ data:{} }, error:null }), saveCloud: async () => true, requestReauth:async () => true, showToast() {}, render:() => { renders++; },
    ...overrides,
  };
  return { controller:createOsbbAttendanceController(options), renders:() => renders, stats, status, values };
}

test('attendance controller loads cloud month and persists the established offline key', async () => {
  const source = { 8:{ plumber:{ checkIn:'08:00', checkOut:'17:00' } } };
  const { controller, values, status } = fixture({ loadCloud: async key => { assert.equal(key, '2026-08'); return { data:{ data:source }, error:null }; } });
  await controller.init();
  assert.deepEqual(controller.getCell(8, 'plumber'), { checkIn:'08:00', breakStart:undefined, breakEnd:undefined, checkOut:'17:00' });
  assert.ok(values.has('att_2026_7'));
  assert.match(status.innerHTML, /Синхронізовано/);
});

test('attendance controller reauthenticates and saves through guarded RPC boundary', async () => {
  let pin = null; let reauths = 0; let payload = null;
  const { controller } = fixture({ getPin: () => pin, requestReauth: async () => { reauths++; pin = '9876'; return true; }, saveCloud: async args => { payload = args; return true; } });
  await controller.saveDay(5, 'janitor', { checkIn:'07:30', breakStart:'12:00', breakEnd:'12:30', checkOut:'16:00' });
  assert.equal(reauths, 1);
  assert.deepEqual(payload, { p_month_key:'2026-08', p_day:5, p_role:'janitor', p_check_in:'07:30', p_break_start:'12:00', p_break_end:'12:30', p_check_out:'16:00', p_staff_id:'staff-1', attempt:'9876' });
});

test('attendance controller rejects absence outside the shift before persistence', async () => {
  let saves = 0;
  const { controller, values } = fixture({ saveCloud: async () => { saves++; return true; } });
  const saved = await controller.saveDay(5, 'janitor', { checkIn:'07:30', breakStart:'17:00', breakEnd:'17:30', checkOut:'16:00' });
  assert.equal(saved, false);
  assert.equal(saves, 0);
  assert.equal(values.has('att_2026_7'), false);
});
