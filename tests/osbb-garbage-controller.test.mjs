import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbGarbageController } from '../src/osbb-garbage-controller.js';

function fixture(overrides = {}) {
  const values = new Map(); let renders = 0; let saved = null; const days = [];
  const storage = { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value), removeItem:key => values.delete(key) };
  const controller = createOsbbGarbageController({
    document:{ getElementById:() => ({ className:'', innerHTML:'' }) }, storage, isPreview:false,
    getMonth:() => ({ year:2026, month:7 }), getCurrentTab:() => 'dispatcher',
    readOffline:(target,key) => { const raw=target.getItem(key); return raw ? JSON.parse(raw) : null; },
    writeOffline:(target,key,value) => target.setItem(key,JSON.stringify(value)), removeOffline:(target,key) => target.removeItem(key),
    fetchMonth:async key => ({ data:key === '2026-7' ? { data:{ '08':{ time:'09:00', worker:'janitor', types:{ bins:2 } } } } : null, error:null }),
    upsertMonth:async row => { saved=row; return { error:null }; }, fetchYear:async () => ({ data:[], error:null }),
    saveDay:async (args, requestOptions) => { days.push({ ...args, keepalive:Boolean(requestOptions?.keepalive) }); return { error:null }; },
    resetMonth:async () => true, requestResetPin:callback => callback('1234'), render:() => { renders++; },
    setTimer:callback => { callback(); return 1; }, clearTimer() {}, now:() => new Date(2026,7,8,10,5), ...overrides,
  });
  return { controller, values, days, renders:() => renders, saved:() => saved };
}

test('garbage controller loads legacy month key and persists established offline key', async () => {
  const { controller, values, renders } = fixture(); await controller.init();
  assert.equal(controller.getData()['08'].types.bins, 2); assert.ok(values.has('garbage_2026_7')); assert.ok(renders() > 0);
});

test('garbage controller saves only the changed day instead of the whole month', async () => {
  const { controller, days, saved, values } = fixture(); await controller.init(); controller.updateType('09','bins','3');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(controller.getData()['09'], { time:'10:05', worker:'', types:{ bins:3 } });
  assert.deepEqual(days, [{ p_month_key:'2026-7', p_day:'09', p_row:{ time:'10:05', worker:'', types:{ bins:3 } }, keepalive:false }]);
  assert.equal(saved(), null, 'whole-month upsert is reserved for legacy migration');
  assert.equal(values.has('garbage_dirty_2026_7'), false, 'confirmed day leaves the pending queue');
});

test('garbage controller keeps offline edits queued and replays them over the cloud copy', async () => {
  let online = false;
  const attempts = [];
  const { controller, values } = fixture({
    saveDay:async args => { attempts.push(args.p_day); return online ? { error:null } : { error:{ code:'FETCH_ERROR', message:'offline' } }; },
    warn() {},
  });
  await controller.init();
  controller.updateRow('10', 'worker', 'maksym');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(JSON.parse(values.get('garbage_dirty_2026_7')), ['10']);

  online = true;
  await controller.init();
  assert.equal(controller.getData()['10'].worker, 'maksym', 'pending local day wins over the cloud copy');
  assert.equal(controller.getData()['08'].types.bins, 2, 'other cloud days are kept');
  assert.deepEqual(attempts, ['10', '10']);
  assert.equal(values.has('garbage_dirty_2026_7'), false);
});

test('garbage controller flush sends pending days with keepalive in parallel', async () => {
  const { controller, days } = fixture({ setTimer:() => 1 });
  await controller.init();
  controller.updateRow('3', 'time', '07:00'); controller.updateRow('4', 'time', '07:30');
  assert.equal(days.length, 0);
  await controller.flush();
  assert.deepEqual(days.map(day => [day.p_day, day.keepalive]), [['3', true], ['4', true]]);
});

test('garbage controller keeps local data when the server rejects a month reset', async () => {
  const { controller, values } = fixture({ resetMonth:async () => false });
  await controller.init();
  controller.clearMonth();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(controller.getData()['08'].types.bins, 2);
  assert.equal(JSON.parse(values.get('garbage_2026_7'))['08'].types.bins, 2);
});

test('garbage controller clears local month only after a confirmed reset', async () => {
  const { controller, values } = fixture();
  await controller.init();
  controller.clearMonth();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(controller.getData(), {});
  assert.equal(values.has('garbage_dirty_2026_7'), false);
});

test('garbage controller refreshes yearly offline cache and removes absent months', async () => {
  const row={ month_key:'2026-7', data:{ '01':{ time:'08:00', worker:'janitor', types:{ bins:4 } } } };
  const { controller, values } = fixture({ fetchYear:async () => ({ data:[row], error:null }) });
  values.set('garbage_2026_0','stale'); await controller.loadYear(2026);
  assert.equal(JSON.parse(values.get('garbage_2026_7'))['01'].types.bins,4); assert.equal(values.has('garbage_2026_0'),false);
});
