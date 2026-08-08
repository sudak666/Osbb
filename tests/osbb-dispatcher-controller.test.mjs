import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbDispatcherController } from '../src/osbb-dispatcher-controller.js';

function fixture(overrides = {}) {
  const values = new Map(); let saved = null; let renders = 0;
  const storage = { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value) };
  const controller = createOsbbDispatcherController({
    document:{ getElementById:() => ({ className:'', innerHTML:'', textContent:'' }) }, storage, isPreview:false,
    getMonth:() => ({ year:2026, month:7 }), getStaffSession:() => ({ id:'staff-1', name:'Олена', role:'dispatcher' }),
    getStaffPin:() => '1234', isDispatcher:() => true, normalizeWorkerRole:value => ['plumber','janitor','electrician'].includes(value) ? value : 'plumber',
    readOffline:(target,key) => { const raw=target.getItem(key); return raw ? JSON.parse(raw) : null; },
    writeOffline:(target,key,value) => target.setItem(key,JSON.stringify(value)),
    fetchMonth:async () => ({ data:{ data:{} }, error:null }), upsertMonth:async row => { saved=row; return { error:null }; },
    resetMonth:async () => true, requestResetPin:callback => callback('1234'), requestStaffReauth:async () => true,
    requestJira:async () => ({ issues:[{ key:'MS-1', summary:'Кран', status:'Open', priority:'High', assignedRole:'plumber' }] }),
    renderDispatcher:() => { renders++; }, renderMyTickets:() => {}, showToast:() => {}, onDataChanged:() => {},
    now:() => new Date('2026-08-08T10:00:00.000Z'), random:() => 0.25,
    setTimer:callback => { callback(); return 1; }, clearTimer() {}, ...overrides,
  });
  return { controller, saved:() => saved, renders:() => renders };
}

test('dispatcher controller loads, adds and persists normalized ticket data', async () => {
  const { controller, saved, renders } = fixture();
  await controller.init();
  const ticket = await controller.addTicket(8, '  Полагодити кран  ', 'plumber', 'HIGH');
  await Promise.resolve();
  assert.equal(ticket.text, 'Полагодити кран');
  assert.equal(ticket.createdBy, 'Олена');
  assert.equal(saved().data['8'].ticketsList[0].priority, 'HIGH');
  assert.ok(renders() > 0);
});

test('dispatcher controller edits, closes and reopens a ticket', async () => {
  const { controller } = fixture(); await controller.init();
  const ticket = await controller.addTicket(3, 'Стара назва', 'janitor', 'LOW');
  assert.equal(controller.saveTicketEdit(3,ticket.id,'Нова назва','electrician','MEDIUM'),true);
  assert.equal(controller.closeTicket(3,ticket.id,'Готово'),true);
  assert.equal(controller.getDay(3).ticketsList[0].status,'done');
  assert.equal(controller.reopenTicket(3,ticket.id),true);
  assert.equal(controller.getDay(3).ticketsList[0].status,'open');
});

test('dispatcher controller validates Jira ingress before publishing issues', async () => {
  const { controller } = fixture(); await controller.loadJira();
  assert.deepEqual(controller.getJiraIssues().map(issue => issue.key), ['MS-1']);
});
