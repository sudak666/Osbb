import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const skladHtml = readFileSync(new URL('../sklad/index.html', import.meta.url), 'utf8');
const skladApp = readFileSync(new URL('../src/sklad-app.js', import.meta.url), 'utf8');
const osbbHtml = readFileSync(new URL('../osbb/index.html', import.meta.url), 'utf8');
const osbbApp = readFileSync(new URL('../src/osbb-app.js', import.meta.url), 'utf8');

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

test('Sklad date fields use the rounded custom date picker instead of the native popup', () => {
  assertIncludes(skladHtml, '/Osbb/shared/enhance-date.js', 'custom date enhancer script is missing');
  assertIncludes(skladHtml, 'id="issueDateI"', 'issue date field is missing');
  assertIncludes(skladHtml, 'inputmode="none" autocomplete="off" pattern="\\d{4}-\\d{2}-\\d{2}" class="inp" id="issueDateI"', 'issue date field must not use native date popup');
  assertIncludes(skladApp, "['issueDateI','refillDateI','editLogDate','editReceiptDate'].forEach(id=>window.enhanceDateInput?.(document.getElementById(id)));", 'date fields must be enhanced at startup');
});


test('Sklad receipt flow remembers legacy receive_item fallback when migration 009 is missing', () => {
  assertIncludes(skladApp, "const PURCHASE_PRICE_RPC_UNAVAILABLE_KEY='sklad_purchase_price_rpc_unavailable_v1'", 'receipt RPC fallback flag key is missing');
  assertIncludes(skladApp, 'let purchasePriceRpcAvailable=loadPurchasePriceRpcAvailable();', 'receipt RPC fallback flag must be loaded at startup');
  assertIncludes(skladApp, 'function disablePurchasePriceRpc(){', 'receipt RPC fallback disabler is missing');
  assertIncludes(skladApp, 'disablePurchasePriceRpc();', 'schema fallback must be remembered after the first failed price RPC');
  assertIncludes(skladApp, 'purchasePrice!==null&&purchasePriceRpcAvailable', 'price RPC should be skipped after fallback is remembered');
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
  assert.match(osbbHtml, /data-disp-search/u);
  assertIncludes(osbbApp, 'function bindDispatcherEntryActions() {', 'dispatcher delegated binder is missing');
  assertIncludes(osbbApp, "event.target.closest('[data-disp-action]')", 'dispatcher actions must use delegated hooks');
  assertIncludes(osbbApp, "action.dataset.dispAction === 'ticket-add'", 'dispatcher add action is not routed');
  assertIncludes(osbbApp, "action.dataset.dispAction === 'ticket-edit-save'", 'dispatcher edit save action is not routed');
  assertIncludes(osbbApp, 'dispSaveTicketEdit(Number(action.dataset.dispDay), ticketId', 'dispatcher edit must use save boundary');
});

test('OSBB staff login flow validates staff list and PIN RPC responses', () => {
  assert.match(osbbHtml, /id="staff-login-modal"/u);
  assert.match(osbbHtml, /data-staff-pin-digit="1"/u);
  assert.match(osbbHtml, /data-staff-pin-delete/u);
  assertIncludes(osbbApp, "db.rpc('list_osbb_staff', {})", 'staff list must load through RPC');
  assertIncludes(osbbApp, 'staffLoginList = parseStaffList(list);', 'staff list must pass parser boundary');
  assertIncludes(osbbApp, "db.rpc('verify_staff_pin', { p_staff_id: staffLoginSelected.id, attempt })", 'staff PIN must verify on server');
  assertIncludes(osbbApp, 'parseStaffSession({', 'verified staff session must pass parser boundary');
});

test('OSBB privileged action PIN modal keeps delegated keypad and server verification', () => {
  assert.match(osbbHtml, /data-pin-modal-digit="1"/u);
  assert.match(osbbHtml, /data-pin-modal-delete/u);
  assert.match(osbbHtml, /data-pin-modal-cancel/u);
  assertIncludes(osbbApp, "document.querySelectorAll('[data-pin-modal-digit]').forEach((button) => {", 'PIN modal keypad binding is missing');
  assertIncludes(osbbApp, 'pinModalVerifyRpc', 'PIN modal must keep configurable verify RPC');
  assertIncludes(osbbApp, 'await db.rpc(pinModalVerifyRpc, { attempt });', 'PIN modal must verify on server');
  assertIncludes(osbbApp, "document.getElementById('pin-modal')?.addEventListener('keydown', trapPinModalFocus);", 'PIN modal focus trap binding is missing');
});
