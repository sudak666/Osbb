import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladAuditController } from '../src/sklad-audit-controller.js';

function makeElement(value = '') {
  return {
    value, textContent: '', innerHTML: '', style: {}, attributes: {},
    setAttribute(name, next) { this.attributes[name] = next; },
    focus() {},
  };
}

function makeController(inventory, overrides = {}) {
  const elements = new Map([
    ['auditDate', makeElement()], ['auditSearch', makeElement()], ['auditStats', makeElement()],
    ['auditProgressFill', makeElement()], ['auditProgress', makeElement()], ['auditList', makeElement()],
    ['auditSummary', makeElement()], ['auditNote', makeElement()],
  ]);
  const messages = [];
  const controller = createSkladAuditController({
    db: {}, document: { getElementById: id => elements.get(id) ?? null }, getItems: () => inventory,
    itemMatchesSearch: (item, search) => item.name.includes(search), updateResultSummary() {},
    categoryBadges: {}, categoryIcons: {}, defaultCategoryIcon: '<i>box</i>',
    toast: (...args) => messages.push(args), openModal() {}, closeModal() {}, loadItems: async () => {}, ...overrides,
  });
  return { controller, elements, messages };
}

test('audit controller initializes progress and renders escaped inventory rows', () => {
  const { controller, elements } = makeController([{ id: 1, name: '<Кабель>', category: 'Ремонт', quantity: 2, unit: 'м' }]);
  controller.init();
  assert.match(elements.get('auditDate').textContent, /^Розпочато:/);
  assert.match(elements.get('auditStats').textContent, /0\/1/);
  assert.match(elements.get('auditList').innerHTML, /&lt;Кабель&gt;/);
  assert.equal(elements.get('auditProgress').attributes['aria-valuenow'], '0');
});

test('audit controller fills current quantities and exposes a confirmation summary', () => {
  const { controller, elements, messages } = makeController([{ id: 1, name: 'Кабель', category: null, quantity: 2, unit: 'м' }]);
  controller.init();
  controller.fillCurrent();
  controller.openConfirm();
  assert.match(elements.get('auditList').innerHTML, /value="2"/);
  assert.match(elements.get('auditSummary').innerHTML, /audit-summary-value counted">1/);
  assert.deepEqual(messages[0], ['Підставлено поточні залишки', 'success']);
});


test('audit draft survives navigation and a new controller after reload', () => {
  const values = new Map(); const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const items=[{id:1,name:'Cable',quantity:10}];
  const first=makeController(items,{storage}); first.controller.init();first.controller.input(1,'8');first.controller.init();
  assert.match(first.elements.get('auditList').innerHTML,/value="8"/);
  const second=makeController(items,{storage});second.controller.init();
  assert.match(second.elements.get('auditList').innerHTML,/value="8"/);
});

test('failed atomic audit keeps draft and retries the same request exactly once', async () => {
  let succeed=false;const calls=[];
  const db={rpc:async(name,args)=>{calls.push({name,args});return succeed?{data:5,error:null}:{data:null,error:{message:'offline'}}}};
  const f=makeController([{id:1,name:'Cable',quantity:10}],{db,createRequestId:()=> '11111111-1111-4111-8111-111111111111'});
  f.controller.init();f.controller.input(1,'8');await f.controller.confirm();
  f.controller.render();assert.match(f.elements.get('auditList').innerHTML,/value="8"/);
  assert.equal(f.messages.at(-1)[1],'error');
  succeed=true;await f.controller.confirm();
  assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].name,'complete_inventory_audit');
  assert.match(f.elements.get('auditStats').textContent,/0\/1/);
});

test('double confirmation shares a single in-flight audit request',async()=>{
  let finish;let calls=0;const gate=new Promise(resolve=>{finish=resolve});
  const f=makeController([{id:1,name:'Cable',quantity:10}],{db:{rpc:async()=>{calls++;await gate;return {data:1,error:null}}}});
  f.controller.init();f.controller.input(1,'8');const first=f.controller.confirm();await f.controller.confirm();
  assert.equal(calls,1);finish();await first;
});
