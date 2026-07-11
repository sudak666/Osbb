#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const checks = [
  ['index.html', 'verify_lock_pin', 'shell PIN uses server RPC'],
  ['index.html', "journal: 'osbb/index.html?embed=1'", 'shell loads journal iframe'],
  ['index.html', "sklad: 'sklad/index.html?embed=1'", 'shell loads sklad iframe'],
  ['index.html', 'navigator.serviceWorker.register', 'shell registers service worker'],

  ['osbb/index.html', 'lockBusy', 'journal blocks concurrent PIN input'],
  ['osbb/index.html', "db.rpc('delete_photo'", 'journal deletes photos through RPC'],
  ['osbb/index.html', "db.rpc('delete_chat_message'", 'journal deletes chat through RPC'],
  ['osbb/index.html', "scopePath.startsWith('/Osbb/osbb/')", 'journal SW cleanup is scoped'],

  ['sklad/index.html', 'showDeletePinModal(\'PIN для видалення фото\'', 'sklad photo delete asks for PIN'],
  ['sklad/index.html', "db.rpc('verify_pin'", 'sklad verifies delete PIN via RPC'],
  ['sklad/index.html', 'deleteLightboxPhoto', 'sklad lightbox has delete handler'],
  ['sklad/index.html', "scopePath.startsWith('/Osbb/sklad/')", 'sklad SW cleanup is scoped'],
  ['sklad/index.html', 'function notifyTelegram', 'sklad has Telegram notify helper'],
  ['sklad/index.html', "notifyTelegram('🆕 Новий товар:", 'sklad notifies on new item'],
  ['sklad/index.html', "notifyTelegram('📦 Прихід:", 'sklad notifies on receipt'],
  ['sklad/index.html', "notifyTelegram('📤 Видача:", 'sklad notifies on issue'],
  ['sklad/index.html', 'function setRefreshStatus', 'sklad shows refresh status in the topbar'],
  ['sklad/index.html', 'id="refreshBtn"', 'sklad refresh button can be disabled while loading'],
  ['sklad/index.html', 'function setActionButtonLoading', 'sklad submit buttons show loading state'],
  ['sklad/index.html', 'return true;', 'sklad issueItem reports success to callers'],
  ['sklad/index.html', 'function valuesMatchSearch', 'sklad has normalized multi-field search helper'],
  ['sklad/index.html', 'items.filter(i=>itemMatchesSearch(i,s))', 'sklad item search uses normalized multi-field matching'],
  ['sklad/index.html', 'id="itemsResultSummary"', 'sklad shows item result summary'],
  ['sklad/index.html', 'function updateItemsResultSummary', 'sklad updates item result summary'],
  ['sklad/index.html', 'function resetItemFilters', 'sklad can reset item filters'],
  ['sklad/index.html', 'id="resetItemFiltersBtn"', 'sklad has reset filters button'],
  ['sklad/index.html', 'id="logResultSummary"', 'sklad shows log result summary'],
  ['sklad/index.html', 'id="recResultSummary"', 'sklad shows receipt result summary'],
  ['sklad/index.html', 'id="auditResultSummary"', 'sklad shows audit result summary'],
  ['sklad/index.html', 'id="auditProgress"', 'sklad shows audit progress bar'],
  ['sklad/index.html', 'id="auditProgressFill"', 'sklad updates audit progress fill'],
  ['sklad/index.html', 'function updateResultSummary', 'sklad has reusable result summary helper'],
  ['sklad/index.html', 'function focusActivePageSearch', 'sklad has keyboard search focus helper'],
  ['sklad/index.html', "e.key==='/'", 'sklad supports slash keyboard search shortcut'],
  ['sklad/index.html', 'function clearSearchInput', 'sklad can clear active search with keyboard'],
  ['sklad/index.html', "e.key==='Escape' && clearSearchInput", 'sklad Escape shortcut clears active search first'],
  ['sklad/index.html', 'function dateInputToTimestamp', 'sklad converts selected operation dates'],
  ['sklad/index.html', "document.getElementById('issueDateI').value", 'sklad issue flow reads selected issue date'],
  ['sklad/index.html', 'id="refillDateI"', 'sklad refill form has receipt date input'],
  ['sklad/index.html', "document.getElementById('refillDateI').value", 'sklad refill flow reads selected receipt date'],
  ['sklad/index.html', 'id="editReceiptDate"', 'sklad receipt edit modal has date input'],
  ['sklad/index.html', 'id="editLogDate"', 'sklad issue edit modal has date input'],
  ['sklad/index.html', 'function dateToInputValue', 'sklad can format dates for date inputs'],

  ['sklad/supabase/functions/notify-telegram/index.ts', 'TELEGRAM_BOT_TOKEN', 'notify-telegram function reads bot token from secrets'],
  ['sklad/supabase/functions/notify-telegram/index.ts', 'api.telegram.org', 'notify-telegram function calls Telegram Bot API'],

  ['supabase/setup_pin_auth.sql', 'app_pin_attempts', 'OSBB PIN attempts table exists'],
  ['supabase/setup_pin_auth.sql', 'locked_until', 'OSBB PIN lockout is present'],
  ['supabase/harden_chat_photos_delete.sql', 'delete_chat_message', 'chat delete RPC exists'],
  ['supabase/harden_chat_photos_delete.sql', 'delete_photo', 'photo delete RPC exists'],
  ['sklad/supabase/setup_pin_auth.sql', 'app_pin_attempts', 'sklad PIN attempts table exists'],
];

const ignoredDirs = new Set(['.git', 'node_modules', '.cache', 'dist', 'build']);
const conflictMarker = /^(<<<<<<<|=======|>>>>>>>) /m;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      yield* walk(path);
    } else if (stat.isFile()) {
      yield path;
    }
  }
}

const allFiles = [...walk('.')];

let failed = 0;
let passed = 0;

for (const file of allFiles) {
  const text = readFileSync(file, 'utf8');
  if (conflictMarker.test(text)) {
    failed += 1;
    console.error(`not ok - unresolved merge conflict marker found in ${file}`);
  }
}

for (const [file, needle, label] of checks) {
  const text = readFileSync(file, 'utf8');
  if (text.includes(needle)) {
    passed += 1;
    console.log(`ok - ${label}`);
  } else {
    failed += 1;
    console.error(`not ok - ${label} (${file} missing ${JSON.stringify(needle)})`);
  }
}



// Shell controls should be wired with event listeners rather than inline onclick
// attributes so markup stays separate from behavior and CSP hardening remains possible.
{
  const text = readFileSync('index.html', 'utf8');
  const label = 'shell controls avoid inline onclick handlers';
  if (/<(?:button|a)[^>]+onclick=/.test(text)) {
    failed += 1;
    console.error(`not ok - ${label}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Shell PIN sessions should not live forever in sessionStorage. The shell now
// records when auth was granted, validates the timestamp before unlock, and
// clears both keys when the session is stale or explicitly locked.
{
  const text = readFileSync('index.html', 'utf8');
  const label = 'shell auth session has TTL';
  const required = [
    'const AUTH_TTL_MS = 12 * 60 * 60 * 1000',
    "sessionStorage.setItem('auth_at', String(Date.now()))",
    'function isAuthSessionValid',
    'Date.now() - authAt >= AUTH_TTL_MS',
    'clearAuthSession();',
    'const EARLY_AUTH_TTL_MS = 12 * 60 * 60 * 1000',
    'const earlyAuthFresh = earlyAuthAt && Date.now() - earlyAuthAt < EARLY_AUTH_TTL_MS',
    'if (isAuthSessionValid()) {',
  ];
  const forbidden = [
    'function setAuthSession() {\n        setAuthSession();',
    'function clearAuthSession() {\n        clearAuthSession();',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  if (missing.length || hasForbidden) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}


// OSBB static controls should also avoid inline event attributes. Dynamic rows still
// have legacy inline handlers, but the PIN/key navigation controls are now bound centrally.
{
  const text = readFileSync('osbb/index.html', 'utf8');
  const label = 'journal static controls use centralized event bindings';
  const forbidden = [
    "lockPress('",
    "pinModalPress('",
    "onclick=\"setTab('",
    'onchange="changeTheme',
    'onchange="initCalendar',
  ];
  const required = [
    'function bindOsbbStaticControls',
    'data-lock-digit="0"',
    'data-pin-modal-digit="0"',
    'data-osbb-tab="journal"',
    'data-calendar-select',
  ];
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  const missing = required.filter(needle => !text.includes(needle));
  if (hasForbidden || missing.length) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// OSBB lightbox, chat, month reset and photo container actions should use
// central bindings so URLs/messages are not serialized into inline JS calls.
{
  const text = readFileSync('osbb/index.html', 'utf8');
  const label = 'journal shell actions use centralized event bindings';
  const forbidden = [
    'onclick="lightboxPrev',
    'onclick="lightboxNext',
    'onclick="closeLightbox',
    'onclick="gClearMonth',
    'onclick="dispClearMonth',
    'onclick="this.removeAttribute',
    'onkeydown="if(event.ctrlKey',
    'onclick="chatSend',
    'onclick="openLightbox',
    'onclick="deletePhoto',
    'onclick="chatDelete',
  ];
  const required = [
    'data-lightbox-backdrop',
    'data-lightbox-action="prev"',
    'data-action="garbage-clear-month"',
    'data-action="dispatcher-clear-month"',
    'data-action="chat-send"',
    'data-chat-author',
    'data-chat-input',
    'data-photo-action="open"',
    'data-photo-action="delete"',
    'data-chat-delete-id',
    'function bindOsbbPhotoActions',
    'function bindOsbbChatActions',
  ];
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  const missing = required.filter(needle => !text.includes(needle));
  if (hasForbidden || missing.length) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// OSBB PIN confirmation modal and lightbox should expose dialog semantics and
// move focus into the active overlay when opened.
{
  const text = readFileSync('osbb/index.html', 'utf8');
  const label = 'journal overlays expose accessible dialog semantics';
  const required = [
    'role="dialog" aria-modal="true" aria-labelledby="pin-modal-title" tabindex="-1"',
    'data-lightbox-backdrop role="dialog" aria-modal="true" aria-label="Перегляд фото" tabindex="-1"',
    "modal.querySelector('[role=\"dialog\"]')?.focus",
    'requestAnimationFrame(()=>lightbox.focus',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Journal day cards/table rows should use data hooks for role tasks, shifts,
// ticket counts, comments and photo uploads instead of inline event attributes.
{
  const text = readFileSync('osbb/index.html', 'utf8');
  const label = 'journal day entries use delegated data bindings';
  const forbidden = [
    'onclick="if(!${disabled}) toggleTask',
    'onchange="toggleShift',
    'oninput="updateTicketCount',
    'onchange="Array.from(this.files).forEach(f=>uploadPhoto',
    'oninput="updateComment',
    'oninput="updateOtherTask',
    'onclick="toggleOtherExpand',
  ];
  const required = [
    'function bindJournalEntryActions',
    'data-journal-action="task-toggle"',
    'data-journal-action="shift-toggle"',
    'data-journal-action="ticket-count"',
    'data-journal-action="photo-upload"',
    'data-journal-action="photo-upload-mobile"',
    'data-journal-action="day-comment"',
    'data-journal-action="other-task"',
    'data-journal-action="other-expand"',
  ];
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  const missing = required.filter(needle => !text.includes(needle));
  if (hasForbidden || missing.length) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// All app HTML should now avoid inline event attributes for CSP readiness.
{
  const label = 'app pages avoid inline HTML event attributes';
  const inlineEventAttr = /<[^>]+\s(?:onclick|oninput|onchange|onblur|onfocus|onkeydown)=/;
  const offenders = ['index.html', 'osbb/index.html', 'sklad/index.html'].filter(file => inlineEventAttr.test(readFileSync(file, 'utf8')));
  if (offenders.length) {
    failed += 1;
    console.error(`not ok - ${label} (${offenders.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Avoid direct event handler property assignment as well; use addEventListener
// so all pages follow the same centralized binding style.
{
  const label = 'app scripts avoid direct event handler property assignments';
  const directHandlerAssignment = /\.(?:onclick|oninput|onchange|onblur|onfocus|onkeydown)\s*=/;
  const offenders = ['index.html', 'osbb/index.html', 'sklad/index.html'].filter(file => directHandlerAssignment.test(readFileSync(file, 'utf8')));
  if (offenders.length) {
    failed += 1;
    console.error(`not ok - ${label} (${offenders.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// OSBB garbage/dispatcher dynamic lists should also rely on delegated data
// hooks now that journal day entries have been centralized.
{
  const text = readFileSync('osbb/index.html', 'utf8');
  const label = 'journal garbage and dispatcher lists use delegated data bindings';
  const forbidden = [
    'onclick="gToggleDay',
    'onchange="gUpdateRow',
    'onchange="gUpdateType',
    'onchange="dispToggleShift',
    'onclick="dispToggleTask',
    'oninput="dispUpdate',
    'header.onclick =',
  ];
  const required = [
    'function bindGarbageEntryActions',
    'function bindDispatcherEntryActions',
    'data-g-action="toggle-day"',
    'data-g-action="row-update"',
    'data-g-action="type-toggle"',
    'data-g-action="type-count"',
    'data-disp-action="toggle-day"',
    'data-disp-action="shift-toggle"',
    'data-disp-action="task-toggle"',
    'data-disp-action="field-update"',
  ];
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  const missing = required.filter(needle => !text.includes(needle));
  if (hasForbidden || missing.length) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// OSBB text escaping should use the shared escapeHtml helper rather than ad-hoc
// `<` replacement so ampersands/quotes are handled consistently in renderers.
{
  const text = readFileSync('osbb/index.html', 'utf8');
  const label = 'journal renderers use shared escapeHtml helper';
  const forbidden = [
    "replace(/</g,'&lt;')",
    "replace(/</g, '&lt;')",
  ];
  const required = [
    'function escapeHtml',
    "const escaped = escapeHtml(val);",
    "const authorEscaped = escapeHtml(msg.author || 'Анонім');",
    "escapeHtml(msg.text || '').replace(/\\n/g,'<br>')",
    "${escapeHtml(currentMonthData[d].comment||'')}",
    "${escapeHtml(row.comment||'')}",
  ];
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  const missing = required.filter(needle => !text.includes(needle));
  if (hasForbidden || missing.length) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Regression guard: the Sklad issue log must not reference variables that are
// only defined in other renderers (this previously broke the Journal page with
// `safeCat is not defined`).
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const start = text.indexOf('function renderLog()');
  const end = text.indexOf('// ===== EDIT / DELETE LOG =====');
  const body = start >= 0 && end > start ? text.slice(start, end) : '';
  const label = 'sklad renderLog defines safeCat before using it';
  if (!body || !body.includes('const safeCat=escapeHtml')) {
    failed += 1;
    console.error(`not ok - ${label}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}


// Regression guard: the Sklad receipts page must define safeUnit in its own
// renderer before using it in desktop/mobile receipt rows.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const start = text.indexOf('function renderReceipts()');
  const end = text.indexOf('let deleteReceiptId=');
  const body = start >= 0 && end > start ? text.slice(start, end) : '';
  const label = 'sklad renderReceipts defines safeUnit before using it';
  if (!body || !body.includes('const safeUnit=escapeHtml')) {
    failed += 1;
    console.error(`not ok - ${label}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}


// notify-telegram must accept raw/text payloads because the GitHub Pages client
// sends best-effort no-cors requests and Windows PowerShell tests often use raw
// text to avoid JSON quoting issues.
{
  const text = readFileSync('sklad/supabase/functions/notify-telegram/index.ts', 'utf8');
  const label = 'notify-telegram accepts raw text payload fallback';
  if (text.includes("raw.startsWith('text=')") && text.includes('text = raw;')) {
    passed += 1;
    console.log(`ok - ${label}`);
  } else {
    failed += 1;
    console.error(`not ok - ${label}`);
  }
}



// Sklad static controls should use centralized data-attribute bindings for auth,
// navigation, topbar actions, stock/category filters, and common search controls.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const label = 'sklad static controls use centralized event bindings';
  const forbidden = [
    "onclick=\"pinPress('",
    "onclick=\"nav('",
    'onkeydown="if(event.key',
    'onclick="openChartModal()',
    'onclick="openPriceRefreshModal()',
    'onclick="openQR()',
    'onclick="goReceipts()',
    'onclick="exportExcel()',
    'onclick="refreshAll()',
    'onclick="toggleTheme()',
    'onclick="filterByStock',
    'onclick="toggleInStock',
    'onclick="toggleHideInternal',
    'onclick="toggleOnlyInternal',
    'onclick="filterCat',
    'oninput="renderItems()',
    'onchange="onIssueSel()',
    'onchange="renderStats()',
  ];
  const required = [
    'function bindSkladStaticControls',
    'data-auth-pin-key="0"',
    'data-sklad-action="refresh"',
    'data-stock-filter="zero"',
    'data-category-filter="Прибирання"',
    'data-render-items-input',
    'data-stats-filter',
  ];
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  const missing = required.filter(needle => !text.includes(needle));
  if (hasForbidden || missing.length) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Sklad item rows/cards should use delegated data-item-action controls instead of
// embedding per-row inline handlers for every rendered item action.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const start = text.indexOf('function handleItemActionClick');
  const end = text.indexOf('function updateStats()');
  const body = start >= 0 && end > start ? text.slice(start, end) : '';
  const label = 'sklad item actions use delegated data attributes';
  const forbidden = [
    'onclick="openQuick',
    'onclick="openHistory',
    'onclick="openPhotoModal',
    'onclick="toggleInternal',
    'onclick="openItemPriceLookup',
    'onclick="openDelete(${id}',
  ];
  const required = [
    'function bindItemActionDelegation',
    'data-item-action="quick"',
    'data-item-action="history"',
    'data-item-action="price-lookup"',
    'data-item-action="delete"',
  ];
  const hasForbidden = forbidden.some(needle => body.includes(needle));
  const missing = required.filter(needle => !body.includes(needle));
  if (!body || hasForbidden || missing.length) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}



// Sklad operational forms (issue/refill/add/audit/log search) should be wired by
// the centralized static control binder rather than inline handlers.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const label = 'sklad operational forms use centralized event bindings';
  const forbidden = [
    'onclick="setPerson',
    'onclick="doIssue',
    'onclick="filterLogCat',
    'onclick="doRefill',
    'onclick="openBarcodeAddScanner',
    'onclick="doAddNew',
    'onclick="auditFillZeros',
    'onclick="auditFillCurrent',
    'onclick="openAuditConfirm',
    'oninput="renderLog()',
    'oninput="renderAuditList()',
    'oninput="renderReceipts()',
    'oninput="renderNewProductMatches()',
    'onchange="onRefillSel()',
  ];
  const required = [
    'data-person-preset="Електрик"',
    'data-sklad-action="issue-submit"',
    'data-log-category-filter="Ремонт"',
    'data-refill-select',
    'data-new-product-input',
    'data-render-audit-input',
    'data-render-receipts-input',
  ];
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  const missing = required.filter(needle => !text.includes(needle));
  if (hasForbidden || missing.length) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}


// Sklad modal controls should use data attributes and the central binder, including
// destructive confirmation PIN keys and lightbox controls.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const label = 'sklad modal controls use centralized event bindings';
  const forbidden = [
    'onclick="closeModal',
    'onclick="delPinModalCancel',
    'onclick="deletePinPress',
    'onclick="doQuickIssue',
    'onchange="uploadPhoto()',
    'onclick="deletePhoto()',
    'onclick="confirmDelete()',
    'onclick="confirmAudit()',
    'onclick="confirmDeleteLog()',
    'onclick="confirmEditLog()',
    'onclick="confirmDeleteReceipt()',
    'onclick="confirmEditReceipt()',
    'onclick="searchInGoogle()',
    'onclick="resetBarcodeScanner()',
    'onclick="searchManualBarcode()',
    'onclick="fetchItemPrice()',
    'onclick="saveManualPrice()',
    'onclick="deleteLightboxPhoto',
    'onclick="event.stopPropagation()',
  ];
  const required = [
    'data-modal-backdrop="qModal"',
    'data-modal-close="photoModal"',
    'data-delete-pin-key="DEL"',
    'data-photo-file',
    'data-sklad-action="quick-issue-submit"',
    'data-sklad-action="manual-price-save"',
    'data-lightbox-close',
  ];
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  const missing = required.filter(needle => !text.includes(needle));
  if (hasForbidden || missing.length) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Sklad modal dialogs should expose dialog semantics and be opened through the
// shared helper so keyboard focus lands inside the active modal.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const label = 'sklad modals expose accessible dialog semantics';
  const modalCount = (text.match(/<div class="modal"/g) || []).length;
  const dialogCount = (text.match(/role="dialog" aria-modal="true" tabindex="-1"/g) || []).length;
  const required = [
    'function openModal',
    "modalBg.querySelector('[role=\"dialog\"]')?.focus",
    "openModal('qModal')",
    "openModal('photoModal')",
    "openModal('delPinModal')",
    "openModal('priceModal')",
  ];
  const forbidden = [
    "document.getElementById('qModal').classList.add('open')",
    "document.getElementById('photoModal').classList.add('open')",
    "document.getElementById('delPinModal').classList.add('open')",
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  if (!modalCount || modalCount !== dialogCount || missing.length || hasForbidden) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}${modalCount !== dialogCount ? ` (dialogs: ${dialogCount}/${modalCount})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Price result actions can contain merchant/source/link text with apostrophes, so
// they must not be serialized into inline JS argument lists.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const label = 'sklad price result apply buttons avoid inline JS arguments';
  if (text.includes('onclick="applyFoundPrice') || !text.includes('function bindPriceResultActions') || !text.includes('data-price-result-action="apply"')) {
    failed += 1;
    console.error(`not ok - ${label}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Price search links come from an Edge Function response. Only http(s) URLs
// should be rendered into href/data-url values.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const label = 'sklad price result links are URL-sanitized';
  const required = [
    'function safeExternalUrl',
    'const safeLink=safeExternalUrl(r.link);',
    'href="${safeLink}"',
    'data-url="${safeLink}"',
    "url.protocol!=='http:'&&url.protocol!=='https:'",
  ];
  const forbidden = [
    'href="${escapeHtml(r.link)}"',
    'data-url="${escapeHtml(String(r.link||',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  if (missing.length || hasForbidden) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Photo URLs are stored in Supabase/user-controlled records. Renderers should
// pass them through the same http(s)-only URL sanitizer before writing src/data
// attributes or lightbox lists.
{
  const osbb = readFileSync('osbb/index.html', 'utf8');
  const sklad = readFileSync('sklad/index.html', 'utf8');
  const label = 'photo renderers sanitize image URLs';
  const required = [
    [osbb, 'const safeUrl = safeExternalUrl(p.url);'],
    [osbb, 'if (!safeUrl) return \'\';'],
    [osbb, 'data-photo-url="${safeUrl}"'],
    [osbb, 'if (safeUrl) lightboxPhotos.push(safeUrl);'],
    [sklad, 'const safePhoto=item.photo_url?safeExternalUrl(item.photo_url):\'\';'],
    [sklad, 'data-photo-url="${safePhoto}"'],
  ];
  const forbidden = [
    [osbb, 'src="${escapeAttr(p.url)}"'],
    [osbb, 'data-photo-url="${escapeAttr(p.url)}"'],
    [osbb, 'lightboxPhotos.push(p.url)'],
    [sklad, 'const safePhoto=item.photo_url?escapeHtml(item.photo_url):\'\';'],
    [sklad, 'const safePhoto=escapeHtml(item.photo_url);'],
  ];
  const missing = required.filter(([text, needle]) => !text.includes(needle)).map(([, needle]) => needle);
  const hasForbidden = forbidden.some(([text, needle]) => text.includes(needle));
  if (missing.length || hasForbidden) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Sklad dynamic renderers should not emit inline event attributes. Delegated
// data hooks keep generated markup safer when item names/URLs contain quotes and
// make refreshed lists keep the same behavior without rebinding every row.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const label = 'sklad dynamic renderers avoid inline event attributes';
  const forbidden = [
    'onclick="openManualPriceModal',
    'onclick="openEditLog',
    'onclick="openDeleteLog',
    'onclick="openEditReceipt',
    'onclick="openDeleteReceipt',
    'onclick="useExistingItemForRefill',
    'onclick="openLightbox',
    'oninput="onAuditInput',
    'onfocus="this.select()',
    'onblur="if(/',
  ];
  const required = [
    'function bindPriceBadgeActions',
    'function bindAuditListDelegation',
    'function bindLogActionDelegation',
    'function bindReceiptActionDelegation',
    'function bindNewProductMatchActions',
    'function bindPhotoCurrentActions',
    'data-price-badge-action="manual-price"',
    'data-audit-input',
    'data-log-action="edit"',
    'data-receipt-action="delete"',
    'data-new-match-action="refill"',
    'data-photo-current-lightbox',
    'data-unit-word-input',
  ];
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  const missing = required.filter(needle => !text.includes(needle));
  if (hasForbidden || missing.length) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// sklad refreshAll() must reload every top-level collection it shows (items,
// logs, receipts) — easy to silently regress when a new page/collection is
// added and this function isn't updated to match.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const m = text.match(/async function refreshAll\(\)\s*\{([^}]*)\}/);
  const label = 'sklad refreshAll() reloads items, logs and receipts';
  if (!m) {
    failed += 1;
    console.error(`not ok - ${label} (refreshAll() function not found)`);
  } else {
    const missing = ['loadItems()', 'loadLogs()', 'loadReceipts()'].filter(call => !m[1].includes(call));
    if (missing.length) {
      failed += 1;
      console.error(`not ok - ${label} (missing call(s): ${missing.join(', ')})`);
    } else {
      passed += 1;
      console.log(`ok - ${label}`);
    }
  }
}

// Action buttons can be clicked from stale DOM after refreshes/deletes. Guarding
// central item lookup prevents modal handlers from crashing on `item.name` /
// `item.unit` when a row no longer exists in the latest `allItems` collection.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const label = 'sklad item actions guard missing/stale item rows';
  const required = [
    'function findItemForAction',
    "findItemForAction(id,'видача')",
    "findItemForAction(id,'прихід')",
    "findItemForAction(id,'видалення')",
    "findItemForAction(id,'фото')",
    "findItemForAction(itemId,'історія')",
  ];
  const missing = required.filter(needle => !text.includes(needle));
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Every *.sql filename mentioned in the docs/UI must actually exist in the
// repo — catches stale references like a UI hint pointing at a script that
// was never committed.
{
  const sqlFilesOnDisk = new Set(allFiles.filter(f => f.endsWith('.sql')).map(f => f.split('/').pop()));
  const sqlMentionRe = /\b[\w-]+\.sql\b/g;
  for (const src of ['README.md', 'index.html', 'osbb/index.html', 'sklad/index.html']) {
    const text = readFileSync(src, 'utf8');
    const mentioned = new Set(text.match(sqlMentionRe) || []);
    for (const name of mentioned) {
      const label = `${src} references existing SQL file ${name}`;
      if (sqlFilesOnDisk.has(name)) {
        passed += 1;
        console.log(`ok - ${label}`);
      } else {
        failed += 1;
        console.error(`not ok - ${label} (no such file in the repo)`);
      }
    }
  }
}

if (failed) {
  console.error(`\n${failed} smoke check(s) failed.`);
  process.exit(1);
}
console.log(`\n${passed} smoke checks passed.`);
