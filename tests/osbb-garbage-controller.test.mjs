import test from 'node:test';
import assert from 'node:assert/strict';
import { readOsbbOfflineValue } from '../src/osbb-offline.js';
import { createOsbbGarbageController } from '../src/osbb-garbage-controller.js';

function fixture(overrides = {}) {
  const values = new Map(); let renders = 0; let saved = null; const days = [];
  const storage = { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value), removeItem:key => values.delete(key) };
  const controller = createOsbbGarbageController({
    document:{ getElementById:() => ({ className:'', innerHTML:'' }) }, storage, isPreview:false,
    getMonth:() => ({ year:2026, month:7 }), getCurrentTab:() => 'dispatcher',
    readOffline:readOsbbOfflineValue,
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

test('an older save cannot acknowledge a newer edit of the same day', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const sent = [];
  const { controller, values } = fixture({ setTimer:() => 1, saveDay:async args => {
    sent.push(structuredClone(args)); if (sent.length === 1) await gate; return { error:null };
  } });
  await controller.init(); controller.updateRow('10','worker','first');
  const saving = controller.saveCloud(); controller.updateRow('10','worker','second');
  release(); await saving;
  assert.deepEqual(JSON.parse(values.get('garbage_dirty_2026_7')), ['10']);
  await controller.flush();
  assert.deepEqual(sent.map(row => row.p_row.worker), ['first','second']);
  assert.equal(values.has('garbage_dirty_2026_7'), false);
});

test('save acknowledgement clears only its original month queue', async () => {
  let month = 7; let release;
  const gate = new Promise(resolve => { release=resolve; });
  const {controller,values} = fixture({setTimer:()=>1,getMonth:()=>({year:2026,month}),saveDay:async()=>{await gate;return {error:null}}});
  await controller.init(); controller.updateRow('10','worker','august'); const save=controller.saveCloud();
  month=8; values.set('garbage_dirty_2026_8',JSON.stringify(['10']));
  release();await save;
  assert.equal(values.has('garbage_dirty_2026_7'),false);
  assert.deepEqual(JSON.parse(values.get('garbage_dirty_2026_8')),['10']);
});

test('year chart refresh cannot overwrite a pending day before autosave', async () => {
  for (const cloudRows of [[], [{ month_key:'2026-7', data:{ '08':{ types:{ bins:2 } } } }]]) {
    const { controller, days, values } = fixture({ setTimer:() => 1, fetchYear:async () => ({ data:cloudRows, error:null }) });
    await controller.init();
    controller.updateType('08','bins','7');
    controller.updateType('10','bins','3');
    await controller.loadYear(2026);
    await controller.flush();
    assert.deepEqual(days.map(day => [day.p_day, day.p_row?.types.bins]), [['08',7],['10',3]]);
    assert.equal(values.has('garbage_dirty_2026_7'), false);
  }
});

test('year chart preserves pending edits and deletions in another month', async () => {
  const { controller, values } = fixture({ fetchYear:async () => ({ data:[
    { month_key:'2026-6', data:{ '01':{ types:{ bins:9 } } } },
  ], error:null }) });
  values.set('garbage_2026_6', JSON.stringify({ '02':{ types:{ bins:4 } } }));
  values.set('garbage_dirty_2026_6', JSON.stringify(['01','02']));
  await controller.loadYear(2026);
  assert.deepEqual(JSON.parse(values.get('garbage_2026_6')), { '02':{ types:{ bins:4 } } });
});

test('late year response cannot replace edits saved while the request was in flight', async () => {
  let release;
  const response = new Promise(resolve => { release=resolve; });
  let month=7;
  const { controller, values } = fixture({ setTimer:() => 1, getMonth:() => ({ year:2026, month }), fetchYear:() => response });
  await controller.init();
  const chart = controller.loadYear(2026);
  controller.updateType('08','bins','7');
  await controller.flush();
  month=8;
  controller.resetLoaded();
  release({ data:[], error:null });
  await chart;
  assert.equal(JSON.parse(values.get('garbage_2026_7'))['08'].types.bins,7);
});
