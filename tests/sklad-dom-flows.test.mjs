import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const skladHtml = readFileSync(new URL('../sklad/index.html', import.meta.url), 'utf8');
const skladApp = readFileSync(new URL('../src/sklad-app.js', import.meta.url), 'utf8');

function assertIncludes(source, snippet, message) {
  assert.notEqual(source.indexOf(snippet), -1, message);
}

test('Sklad issue flow uses a real guarded form submit path', () => {
  assert.match(skladHtml, /<form id="issueForm"[^>]*>/u);
  assert.match(skladHtml, /<button type="submit"[^>]*>[^<]*<span[^>]*>check_circle<\/span> Видати зі складу<\/button>/u);
  assertIncludes(skladApp, "document.getElementById('issueForm')?.addEventListener('submit',(event)=>{", 'issue form submit listener is missing');
  assertIncludes(skladApp, 'event.preventDefault();', 'issue submit must prevent page reload');
  assertIncludes(skladApp, 'void doIssue(event.submitter);', 'issue submit must call guarded issue handler');
});

test('Sklad refill and new-item submits remain centrally bound actions', () => {
  assert.match(skladHtml, /data-sklad-action="refill-submit"/u);
  assert.match(skladHtml, /data-sklad-action="add-new-submit"/u);
  assertIncludes(skladApp, "'refill-submit':(button)=>doRefill(button)", 'refill submit action is not registered');
  assertIncludes(skladApp, "'add-new-submit':(button)=>doAddNew(button)", 'new item submit action is not registered');
  assertIncludes(skladApp, "document.querySelectorAll('[data-sklad-action]').forEach(button=>{", 'central action binder is missing');
});

test('Sklad audit flow keeps dynamic controls delegated from the list container', () => {
  assertIncludes(skladApp, 'data-audit-input data-item-id="${item.id}"', 'audit quantity inputs need delegated hooks');
  assertIncludes(skladApp, 'data-audit-clear data-item-id="${item.id}"', 'audit clear buttons need delegated hooks');
  assertIncludes(skladApp, "list.addEventListener('input',(event)=>{", 'audit input delegation is missing');
  assertIncludes(skladApp, "list.addEventListener('click',(event)=>{", 'audit clear delegation is missing');
  assertIncludes(skladApp, 'onAuditInput(Number(input.dataset.itemId),input.value);', 'audit input must route through parser boundary');
});

test('Sklad PIN flow keeps server verification and guarded keypad binding', () => {
  assertIncludes(skladHtml, "db.rpc('verify_pin',{attempt})", 'embedded Sklad PIN check must use server RPC');
  assertIncludes(skladHtml, 'const AUTH_TTL_MS = 12 * 60 * 60 * 1000;', 'embedded Sklad auth must keep TTL');
  assertIncludes(skladApp, "document.querySelectorAll('[data-auth-pin-key]').forEach(button=>{", 'runtime PIN keypad binding is missing');
  assertIncludes(skladHtml, 'if(pinBusy) return;', 'PIN keypad must guard concurrent input');
});

test('Sklad movement edit modals keep centralized save actions', () => {
  assert.match(skladHtml, /data-sklad-action="edit-log-confirm"/u);
  assert.match(skladHtml, /data-sklad-action="edit-receipt-confirm"/u);
  assertIncludes(skladApp, "'edit-log-confirm':confirmEditLog", 'issue edit save action is not registered');
  assertIncludes(skladApp, "'edit-receipt-confirm':confirmEditReceipt", 'receipt edit save action is not registered');
  assertIncludes(skladApp, 'async function confirmEditLog(){', 'issue edit handler is missing');
  assertIncludes(skladApp, 'async function confirmEditReceipt(){', 'receipt edit handler is missing');
});

test('OSBB dispatcher ticket flow stays delegated and routes add/edit actions', () => {
  const osbbHtml = readFileSync(new URL('../osbb/index.html', import.meta.url), 'utf8');
  const osbbApp = readFileSync(new URL('../src/osbb-app.js', import.meta.url), 'utf8');
  assert.match(osbbHtml, /data-disp-search/u);
  assertIncludes(osbbApp, 'function bindDispatcherEntryActions() {', 'dispatcher delegated binder is missing');
  assertIncludes(osbbApp, "event.target.closest('[data-disp-action]')", 'dispatcher actions must use delegated hooks');
  assertIncludes(osbbApp, "action.dataset.dispAction === 'ticket-add'", 'dispatcher add action is not routed');
  assertIncludes(osbbApp, "action.dataset.dispAction === 'ticket-edit-save'", 'dispatcher edit save action is not routed');
  assertIncludes(osbbApp, 'dispSaveTicketEdit(Number(action.dataset.dispDay), ticketId', 'dispatcher edit must use save boundary');
});
