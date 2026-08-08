import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbGarbageController } from '../src/osbb-garbage-controller.js';

function fixture(overrides = {}) {
  const values = new Map(); let renders = 0; let saved = null;
  const storage = { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value), removeItem:key => values.delete(key) };
  const controller = createOsbbGarbageController({
    document:{ getElementById:() => ({ className:'', innerHTML:'' }) }, storage, isPreview:false,
    getMonth:() => ({ year:2026, month:7 }), getCurrentTab:() => 'dispatcher',
    readOffline:(target,key) => { const raw=target.getItem(key); return raw ? JSON.parse(raw) : null; },
    writeOffline:(target,key,value) => target.setItem(key,JSON.stringify(value)), removeOffline:(target,key) => target.removeItem(key),
    fetchMonth:async key => ({ data:key === '2026-7' ? { data:{ '08':{ time:'09:00', worker:'janitor', types:{ bins:2 } } } } : null, error:null }),
    upsertMonth:async row => { saved=row; return { error:null }; }, fetchYear:async () => ({ data:[], error:null }),
    resetMonth:async () => true, requestResetPin:callback => callback('1234'), render:() => { renders++; },
    setTimer:callback => { callback(); return 1; }, clearTimer() {}, now:() => new Date(2026,7,8,10,5), ...overrides,
  });
  return { controller, values, renders:() => renders, saved:() => saved };
}

test('garbage controller loads legacy month key and persists established offline key', async () => {
  const { controller, values, renders } = fixture(); await controller.init();
  assert.equal(controller.getData()['08'].types.bins, 2); assert.ok(values.has('garbage_2026_7')); assert.ok(renders() > 0);
});

test('garbage controller updates type with automatic time and saves normalized month', async () => {
  const { controller, saved } = fixture(); await controller.init(); controller.updateType('09','bins','3'); await Promise.resolve();
  assert.deepEqual(controller.getData()['09'], { time:'10:05', worker:'', types:{ bins:3 } });
  assert.equal(saved().month_key, '2026-7'); assert.equal(saved().data['09'].types.bins, 3);
});

test('garbage controller refreshes yearly offline cache and removes absent months', async () => {
  const row={ month_key:'2026-7', data:{ '01':{ time:'08:00', worker:'janitor', types:{ bins:4 } } } };
  const { controller, values } = fixture({ fetchYear:async () => ({ data:[row], error:null }) });
  values.set('garbage_2026_0','stale'); await controller.loadYear(2026);
  assert.equal(JSON.parse(values.get('garbage_2026_7'))['01'].types.bins,4); assert.equal(values.has('garbage_2026_0'),false);
});
