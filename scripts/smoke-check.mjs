#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// sklad/index.html's <style> block was extracted to sklad/styles.css (see
// "Component extraction" pass). Most of the sklad-specific checks below
// assert both HTML markup (still in index.html) and CSS rule text (now in
// styles.css) in the same block, so we search the concatenation of both
// files instead of re-classifying every check individually.
const SHARED_JS_CSS = '\n' + readFileSync('shared/ui.css', 'utf8') + '\n' + readFileSync('shared/enhance-select.js', 'utf8');

function readSkladCombined() {
  return readFileSync('sklad/index.html', 'utf8') + '\n' + readFileSync('sklad/styles.css', 'utf8') + SHARED_JS_CSS;
}

// Same story for osbb/index.html's extracted <style> block -> osbb/styles.css.
function readOsbbCombined() {
  return readFileSync('osbb/index.html', 'utf8') + '\n' + readFileSync('osbb/styles.css', 'utf8') + SHARED_JS_CSS;
}

function readShellCombined() {
  return [
    'index.html',
    'src/shell.ts',
    'src/shell-controller.ts',
    'src/shell-state.ts',
    'src/auth-session.ts',
    'src/supabase-api.ts',
    'styles.css'
  ].map(file => readFileSync(file, 'utf8')).join('\n') + SHARED_JS_CSS;
}

const checks = [
  ['shell', 'verify_lock_pin', 'shell PIN uses server RPC'],
  ['shell', "journal: 'osbb/index.html?embed=1'", 'shell loads journal iframe'],
  ['shell', "sklad: 'sklad/index.html?embed=1'", 'shell loads sklad iframe'],
  ['shell', 'navigator.serviceWorker.register', 'shell registers service worker'],

  ['osbb/index.html', 'lockBusy', 'journal blocks concurrent PIN input'],
  ['osbb/index.html', "db.rpc('delete_photo'", 'journal deletes photos through RPC'],
  ['osbb/index.html', "db.rpc('delete_chat_message'", 'journal deletes chat through RPC'],
  ['osbb/index.html', "scopePath.startsWith('/Osbb/osbb/')", 'journal SW cleanup is scoped'],
  ['osbb/index.html', '${escapeHtml(msg)}', 'journal toast messages escape dynamic text'],
  ['osbb/index.html', 'id="ios-toast" role="status" aria-live="polite"', 'journal toast exposes live status semantics'],
  ['sklad/index.html', 'id="toast" role="status" aria-live="polite"', 'sklad toast exposes live status semantics'],
  ['index.html', 'id="lock-err" class="lock-error-text" role="alert" aria-live="assertive"', 'shell lock errors expose alert semantics'],
  ['index.html', 'role="tablist" aria-label="Розділи застосунку"', 'shell tabs expose tablist semantics'],
  ['index.html', 'data-shell-tab="journal" role="tab" aria-selected="true" aria-controls="frame-journal" aria-current="page"', 'shell active tab exposes tab semantics'],
  ['index.html', 'role="tabpanel" aria-labelledby="shell-tab-journal"', 'shell frame exposes tabpanel semantics'],
  ['shell', "targetTab.setAttribute('aria-current', 'page')", 'shell tab switch updates aria-current'],
  ['shell', "targetTab.setAttribute('aria-selected', 'true')", 'shell tab switch updates aria-selected'],
  ['osbb/index.html', 'id="desktop-tabs" class="flex gap-1.5" role="tablist" aria-label="Розділи журналу"', 'journal desktop tabs expose tablist semantics'],
  ['osbb/index.html', 'id="tab-journal" role="tab" aria-selected="true" aria-controls="section-journal" aria-current="page"', 'journal desktop active tab exposes tab semantics'],
  ['osbb/index.html', 'id="bottom-nav" role="tablist" aria-label="Мобільні розділи журналу"', 'journal mobile tabs expose tablist semantics'],
  ['osbb/index.html', 'id="tab-journal-m" role="tab" aria-selected="true" aria-controls="section-journal" aria-current="page"', 'journal mobile active tab exposes tab semantics'],
  ['osbb/index.html', "el.toggleAttribute('aria-current', t === tab)", 'journal tab switch updates aria-current'],
  ['osbb/index.html', "el.setAttribute('aria-selected', String(t === tab))", 'journal tab switch updates aria-selected'],
  ['sklad/index.html', '<nav aria-label="Розділи складу">', 'sklad sidebar exposes navigation label'],
  ['sklad/index.html', 'id="bottomNav" aria-label="Мобільні розділи складу"', 'sklad bottom nav exposes navigation label'],
  ['sklad/index.html', 'data-page="items" role="button" tabindex="0" aria-current="page"', 'sklad sidebar active page exposes aria-current'],
  ['sklad/index.html', 'class="bn-item active" data-page="items" aria-current="page"', 'sklad bottom nav active page exposes aria-current'],
  ['sklad/index.html', "n.setAttribute('aria-current','page')", 'sklad navigation updates aria-current'],
  ['osbb/index.html', 'id="pin-err" role="alert" aria-live="assertive"', 'journal PIN errors expose alert semantics'],
  ['osbb/index.html', 'data-pin-modal-cancel aria-label="Скасувати введення PIN"', 'journal PIN cancel has accessible label'],
  ['sklad/index.html', 'id="authErr" role="alert" aria-live="assertive"', 'sklad auth errors expose alert semantics'],
  ['sklad/index.html', 'id="delPinErr" role="alert" aria-live="assertive"', 'sklad delete PIN errors expose alert semantics'],
  ['sklad/index.html', 'data-auth-pin-key="DEL" aria-label="Видалити цифру PIN"', 'sklad auth PIN delete has accessible label'],
  ['sklad/index.html', 'data-delete-pin-key="DEL" aria-label="Видалити цифру PIN"', 'sklad delete PIN delete has accessible label'],

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

  ['supabase/001_setup_pin_auth.sql', 'app_pin_attempts', 'OSBB PIN attempts table exists (historical archive)'],
  ['supabase/001_setup_pin_auth.sql', 'locked_until', 'OSBB PIN lockout is present (historical archive)'],
  ['supabase/003_harden_chat_photos_delete.sql', 'delete_chat_message', 'chat delete RPC exists (historical archive)'],
  ['supabase/003_harden_chat_photos_delete.sql', 'delete_photo', 'photo delete RPC exists (historical archive)'],
  ['sklad/supabase/001_setup_pin_auth.sql', 'app_pin_attempts', 'sklad PIN attempts table exists'],
  ['sklad/supabase/005_merge_osbb_journal.sql', 'delete_chat_message', 'merged project has chat delete RPC'],
  ['sklad/supabase/005_merge_osbb_journal.sql', 'delete_photo', 'merged project has photo delete RPC'],
  ['sklad/supabase/005_merge_osbb_journal.sql', 'osbb_telegram_config', 'merged project has osbb telegram config table'],
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
  const text = file === 'shell' ? readShellCombined() : readFileSync(file, 'utf8');
  if (text.includes(needle)) {
    passed += 1;
    console.log(`ok - ${label}`);
  } else {
    failed += 1;
    console.error(`not ok - ${label} (${file} missing ${JSON.stringify(needle)})`);
  }
}



// The shell's <style> block was extracted the same way, but unlike
// osbb/sw.js and sklad/sw.js, the root sw.js IS the one actively registered
// service worker (from index.html) and it precaches the shell for offline
// use — so it must precache and cache-first serve the new styles.css, or
// an offline user gets an unstyled shell.
{
  const text = readFileSync('sw.js', 'utf8');
  const label = 'shell service worker precaches and cache-first serves styles.css';
  const required = [
    "'/Osbb/styles.css',",
    "url.pathname === '/Osbb/styles.css' ||",
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


// Shared Material Design 3 tokens must stay wired into every entrypoint and
// consumed by the three UI surfaces. This prevents future polish passes from
// drifting back to isolated hardcoded theme islands.
{
  const label = 'shared Material tokens are linked from all app entrypoints';
  const files = ['index.html', 'osbb/index.html', 'sklad/index.html'];
  const missing = files.filter(file => !readFileSync(file, 'utf8').includes('/Osbb/shared/material-tokens.css'));
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

{
  const label = 'shared Material token layer exposes color shape elevation and motion roles';
  const text = readFileSync('shared/material-tokens.css', 'utf8');
  const required = [
    '--md-sys-color-primary',
    '--md-sys-color-surface',
    '--md-sys-color-scrim',
    '--md-sys-shape-corner-medium',
    '--md-sys-elevation-level2',
    '--md-sys-motion-duration-short4',
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

{
  const label = 'shell journal and sklad consume Material token aliases';
  const surfaces = [
    ['shell', readShellCombined(), ['--md-sys-color-scrim', '--md-sys-color-surface-container-high', '--md-sys-motion-duration-short2']],
    ['journal', readOsbbCombined(), ['--md-sys-color-background', '--md-sys-color-surface', '--md-sys-elevation-level2']],
    ['sklad', readSkladCombined(), ['--md-sys-color-primary', '--md-sys-shape-corner-extra-large', '--md-sys-motion-duration-short4']],
  ];
  const missing = surfaces.flatMap(([name, text, needles]) => needles.filter(needle => !text.includes(needle)).map(needle => `${name}:${needle}`));
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}


{
  const label = 'shell and journal primary controls use Material state layers';
  const required = [
    ['index.html', 'class="shell-tab-btn md-state-layer active"'],
    ['index.html', 'class="pin-btn md-state-layer"'],
    ['osbb/index.html', 'class="journal-theme-toggle md-state-layer"'],
    ['osbb/index.html', 'class="journal-action-btn journal-action-btn-ghost md-state-layer"'],
    ['osbb/index.html', 'class="tab-btn md-state-layer active'],
    ['osbb/index.html', 'class="mob-tab md-state-layer'],
    ['shared/material-tokens.css', '.md-state-layer:hover::before'],
  ];
  const missing = required.filter(([file, needle]) => !readFileSync(file, 'utf8').includes(needle)).map(([file, needle]) => `${file}:${needle}`);
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}


{
  const label = 'Sklad controls use token-driven Material state layers';
  const text = readSkladCombined();
  const required = [
    '.btn,.pill,.ni,.bn-item,.item-more summary{position:relative;overflow:hidden;isolation:isolate;}',
    '.btn::before,.pill::before,.ni::before,.bn-item::before,.item-more summary::before',
    '--md-sys-state-hover-opacity',
    '--md-sys-state-focus-opacity',
    '--md-sys-state-pressed-opacity',
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


{
  const label = 'journal calendar controls use Material state layers';
  const text = readFileSync('osbb/index.html', 'utf8');
  const required = [
    'data-month-step="-1" data-tip="Попередній місяць" aria-label="Попередній місяць" class="md-state-layer',
    'data-month-step="1" data-tip="Наступний місяць" aria-label="Наступний місяць" class="md-state-layer',
    'data-action="go-today" id="btn-today" class="md-state-layer',
    'data-action="refresh-data" data-tip="Оновити дані" aria-label="Оновити дані" class="md-state-layer',
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
  const text = readShellCombined();
  const label = 'shell auth session has TTL';
  const required = [
    'const AUTH_TTL_MS = 12 * 60 * 60 * 1000',
    "storage.setItem(AUTH_AT_KEY, String(now))",
    'function isAuthSessionValid',
    'now - authAt >= AUTH_TTL_MS',
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

// Embedded modules share the same sessionStorage auth flag as the shell, so they
// must also respect the timestamp when opened directly or parsed before the shell
// has a chance to clear stale credentials.
for (const file of ['osbb/index.html', 'sklad/index.html']) {
  const text = readFileSync(file, 'utf8');
  const label = `${file} auth session respects TTL`;
  const required = [
    'const AUTH_TTL_MS = 12 * 60 * 60 * 1000',
    'function setAuthSession',
    'function clearAuthSession',
    'function isAuthSessionValid',
    'auth_at',
    'Date.now()',
    'const EARLY_AUTH_TTL_MS = 12 * 60 * 60 * 1000',
    'const earlyAuthFresh = earlyAuthAt && Date.now() - earlyAuthAt < EARLY_AUTH_TTL_MS',
  ];
  const hasAuthValidityGate = text.includes('if (isAuthSessionValid())') || text.includes('if(isAuthSessionValid())');
  const forbidden = [
    'function setAuthSession() {\n        setAuthSession();',
    'function setAuthSession(){\n  setAuthSession();',
    "if (sessionStorage.getItem('auth') === 'ok') {\n        const lockScreen",
    "if(sessionStorage.getItem('auth')==='ok')",
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  if (missing.length || hasForbidden || !hasAuthValidityGate) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}${!hasAuthValidityGate ? ' (missing auth validity gate)' : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}


// OSBB static controls should also avoid inline event attributes. Dynamic rows still
// have legacy inline handlers, but the PIN/key navigation controls are now bound centrally.
{
  const text = readOsbbCombined();
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
    'data-theme-toggle',
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
  const text = readOsbbCombined();
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
    'aria-label="Надіслати повідомлення"',
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
  const text = readOsbbCombined();
  const label = 'journal overlays expose accessible dialog semantics';
  const required = [
    'role="dialog" aria-modal="true" aria-labelledby="pin-modal-title" tabindex="-1"',
    'data-lightbox-backdrop role="dialog" aria-modal="true" aria-label="Перегляд фото" tabindex="-1"',
    'function focusPinModal',
    'function trapPinModalFocus',
    'pinModalFocusReturn',
    'lightboxFocusReturn',
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
  const text = readOsbbCombined();
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
  const text = readOsbbCombined();
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
    'function gOpenDayDetail',
    'function dispOpenDayDetail',
    'function refreshOpenDayDetail',
    'data-g-action="row-update"',
    'data-g-action="type-toggle"',
    'data-g-action="type-count"',
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
  const text = readOsbbCombined();
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




// Dynamic values inside HTML attributes should use escapeAttr, not raw stored
// values from offline/database state.
{
  const text = readOsbbCombined();
  const label = 'journal dynamic input attributes are escaped';
  const required = [
    'value="${escapeAttr(String(state.ticketCount||\'\'))}"',
    'value="${escapeAttr(row.time||\'\')}" data-g-action="row-update"',
    'value="${escapeAttr(String(val))}"',
    'value="${escapeAttr(String(row.calls||\'\'))}" placeholder="0"',
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



// Item overflow menus (mobile cards AND the desktop table's kebab menu, which
// reuses the same details.item-more pattern) should behave like transient
// menus: only one open at a time, close on outside click, and return focus to
// the summary on Escape.
{
  const text = readSkladCombined();
  const label = 'sklad item overflow menus close predictably';
  const required = [
    'function setItemMenuExpanded',
    'function closeOpenItemMenus',
    "document.querySelectorAll('details.item-more[open]')",
    'function handleItemMenuToggle',
    'function handleItemMenuOutsideClick',
    'aria-haspopup="menu" aria-expanded="false"',
    'class="item-more-menu" role="menu"',
    'role="menuitem" data-item-action="photo"',
    'z-index:60;min-width:190px;max-height:min(62dvh,360px);overflow-y:auto;',
    "document.addEventListener('toggle',handleItemMenuToggle,true)",
    "openItemMenu?.querySelector('summary')?.focus({preventScroll:true})",
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

// Sklad mobile topbar should reserve flexible title space while keeping the
// remaining icon actions compact enough to avoid overflow on narrow screens.
{
  const text = readSkladCombined();
  const label = 'sklad mobile topbar keeps compact actions and flexible title';
  const required = [
    '.topbar{padding:0 12px;height:56px;border-radius:0 0 18px 18px;gap:8px;}',
    '.topbar h2{font-size:15px;flex:1;min-width:0;max-width:none!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.topbar .btn:not(.topbar-right-excel){width:48px;min-width:48px;height:48px;padding:0!important;justify-content:center;font-size:0!important;overflow:hidden;}',
    '.topbar .btn:not(.topbar-right-excel) .ms{font-size:22px!important;vertical-align:middle!important;margin:0!important;}',
    // Секондарні дії (графік/оцінка цін/прихід/тема) згорнуті в overflow-меню замість
    // окремих кнопок в ряд — це саме те, що фіксить попередній баг "тема недоступна на мобілці".
    '<details class="item-more topbar-more">',
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










// Sklad visual redesign foundation should keep semantic design tokens for future
// component passes.
{
  const text = readSkladCombined();
  const label = 'sklad exposes foundational UI design tokens';
  const required = [
    '--surface-0:',
    '--surface-1:',
    '--border-subtle:',
    '--radius-xl:',
    '--shadow-lg:',
    '--text-display:',
    '--motion-base:',
    '--ease-spring:',
    '@media (prefers-reduced-motion: reduce)',
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

// The first visual redesign pass should make the Sklad items page feel like a
// deliberate workflow rather than a loose stack of controls.
{
  const text = readSkladCombined();
  const label = 'sklad items screen exposes redesigned hero and filter layout';
  const required = [
    'class="items-hero"',
    'class="items-hero-kicker"',
    'class="items-hero-actions"',
    'class="items-quick-note"',
    'class="g4 items-metrics insight-grid"',
    'class="items-filter-bar"',
    'class="items-filter-row items-search-row"',
    'class="pill items-filter-pill is-success"',
    'class="pill items-filter-pill is-warning"',
    'class="sw items-search-field"',
    'class="btn btn-ghost btn-sm items-reset-btn"',
    'class="card desktop-table table-modern"',
    'class="stat-icon" aria-hidden="true"',
    '.items-filter-bar{position:sticky;',
    '@media(max-width:1180px)',
    '.items-filter-pill{display:inline-flex;',
    '.items-search-field{width:250px;',
    '.insight-grid .stat-card',
    '.table-modern tbody tr:hover',
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

// Sklad issue flow should share the redesigned workflow form primitives instead
// of reverting to inline-heavy card markup.
{
  const text = readSkladCombined();
  const label = 'sklad issue screen uses workflow form primitives';
  const required = [
    'class="card workflow-card"',
    'class="workflow-heading"',
    'class="workflow-heading-icon"',
    'class="workflow-kicker"',
    'class="workflow-title"',
    'class="form-stack"',
    'class="field-grid two-col"',
    'class="info-callout"',
    'class="preset-row"',
    'class="btn btn-primary full-width-action"',
    'class="card side-panel"',
    '.workflow-card{',
    '.side-panel-title{',
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

// Sklad log screen should share the calm list toolbar/table/mobile-list
// primitives introduced during the visual redesign.
{
  const text = readSkladCombined();
  const label = 'sklad log screen uses redesigned list primitives';
  const required = [
    'class="list-toolbar"',
    'class="list-toolbar-row pills-wrap"',
    'class="list-toolbar-row list-search-row"',
    'class="list-summary"',
    'class="card table-modern"',
    'class="log-mobile-item"',
    'class="log-mobile-icon"',
    'class="log-mobile-actions"',
    'class="icon-action danger"',
    '.list-toolbar{',
    '.log-mobile-item{',
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
















// Dynamic item price badges should use class-based rows instead of inline
// sizing/color style strings.
{
  const text = readSkladCombined();
  const label = 'sklad price badges use class-based renderer';
  const required = [
    'class="btn btn-ghost btn-sm price-badge-btn"',
    'class="btn btn-ghost btn-sm price-badge-btn has-price"',
    'class="price-badge-value"',
    'class="price-badge-source"',
    '.price-badge-btn{padding:6px 9px;',
    '.price-badge-btn.has-price{display:flex;',
    '.price-badge-value{font-weight:900;',
    '.price-badge-source{font-size:10px;',
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

// Dynamic item table rows/cards should use class-based cells instead of
// inline color/layout style strings.
{
  const text = readSkladCombined();
  const label = 'sklad item table rows use class-based cells';
  const required = [
    'class="table-idx-cell"',
    'class="table-name-cell"',
    'class="table-unit-cell"',
    'class="table-qty-unit"',
    'class="table-row-actions"',
    'class="badge badge-internal"',
    '.table-idx-cell{color:',
    '.table-name-cell{font-weight:600;',
    '.table-row-actions{display:flex;',
    '.badge-internal{background:',
  ];
  const forbidden = [
    'style="color:#a5b4fc;font-size:12px;">${idx+1}',
    'style="font-weight:600;color:var(--ios-label);max-width:280px;"',
    'style="background:#FEF3C7;color:#92400E;"',
    'style="display:flex;gap:6px;">\n        <button type="button" class="btn btn-primary btn-sm" data-item-action="quick"',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Sklad log/receipts table rows should use class-based cells instead of
// inline color/layout style strings.
{
  const text = readSkladCombined();
  const label = 'sklad log/receipts rows use class-based cells';
  const required = [
    'class="log-date-cell"',
    'class="log-name-cell"',
    'class="log-qty-out"',
    'class="log-qty-in"',
    'class="log-unit-suffix"',
    'class="log-person-cell"',
    'class="log-note-cell"',
    '.log-date-cell{font-size:12px;',
    '.log-qty-out{font-weight:800;color:#6366f1;}',
    '.log-qty-in{font-weight:800;color:var(--ios-green);}',
  ];
  const forbidden = [
    'style="font-weight:800;color:#6366f1;"',
    'style="font-weight:800;color:var(--ios-green);"',
    'style="font-weight:400;color:#a5b4fc;font-size:11px;"',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// The audit finish-confirmation summary grid should use class-based tiles
// instead of inline grid/color style strings.
{
  const text = readSkladCombined();
  const label = 'sklad audit summary uses class-based tiles';
  const required = [
    'class="audit-summary-grid"',
    'class="audit-summary-tile"',
    'class="audit-summary-value counted"',
    'class="audit-summary-value uncounted"',
    'class="audit-summary-value surplus"',
    'class="audit-summary-value shortage"',
    'class="audit-summary-warning"',
    '.audit-summary-grid{display:grid;',
  ];
  const forbidden = [
    'style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"',
    'style="background:var(--ios-card);border-radius:10px;padding:10px;text-align:center;"',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Journal task-toggle dots should use a class-based checked state instead of
// inline border/background color strings driven by isChecked.
{
  const text = readOsbbCombined();
  const label = 'osbb task-toggle dots use class-based checked state';
  const required = [
    '.task-check-dot { width:20px; height:20px; border-radius:50%;',
    '.task-check-dot.is-checked { border-color:var(--md-sys-color-primary, #22c55e); background:var(--md-sys-color-primary, #22c55e); }',
    "class=\"task-check-dot${isChecked?' is-checked':''}\"",
  ];
  const forbidden = [
    "style=\"width:20px;height:20px;border-radius:50%;border:2px solid ${isChecked?",
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Garbage yearly chart bars should use a class-based gradient with only the
// per-bar height left inline, instead of a full inline gradient ternary.
{
  const text = readOsbbCombined();
  const label = 'osbb garbage chart bars use class-based gradient';
  const required = [
    '.g-chart-bar { width:100%; border-radius:6px 6px 0 0; background:linear-gradient(#22c55e,#28a745); }',
    '.g-chart-bar.is-current { background:linear-gradient(#fbbf24,#f59e0b); }',
    "class=\"g-chart-bar${isCur ? ' is-current' : ''}\" style=\"height:${h}px\"",
  ];
  const forbidden = [
    "style=\"height:${h}px;width:100%;border-radius:6px 6px 0 0;background:${isCur ?",
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Recent-issues side panel and new-product similar-item matches should use
// class-based rows instead of inline color/layout style strings.
{
  const text = readSkladCombined();
  const label = 'sklad recent-issues/new-product-match rows use class-based markup';
  const required = [
    'class="log-row-main"',
    'class="log-row-title"',
    'class="log-row-meta"',
    'class="log-row-qty log-qty-out"',
    'class="match-empty"',
    'class="match-heading"',
    'class="match-row"',
    'class="match-row-main"',
    'class="match-row-title"',
    'class="match-row-meta"',
    'class="match-row-actions"',
    'class="btn btn-ghost btn-sm match-row-btn"',
  ];
  const forbidden = [
    'style="font-size:13px;font-weight:800;color:#6366f1;"',
    'style="font-size:11px;font-weight:800;color:var(--brand);margin-bottom:6px;"',
    'style="padding:6px 8px;font-size:12px;"',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Add-page low-stock list and stats-page category/low-stock lists should use
// class-based rows instead of inline color/layout style strings.
{
  const text = readSkladCombined();
  const label = 'sklad add-low and stats low/category lists use class-based rows';
  const required = [
    'class="add-low-empty"',
    'class="add-low-row"',
    'class="add-low-name"',
    'class="stat-cat-row-head"',
    'class="stat-cat-name"',
    'class="stat-cat-count"',
    'class="stat-low-row"',
    'class="stat-low-name"',
    'class="stat-low-empty"',
    'class="stat-unpriced-row"',
    'class="stat-unpriced-main"',
    'class="stat-unpriced-title"',
    'class="btn btn-ghost btn-sm stat-unpriced-btn"',
  ];
  const forbidden = [
    "el.innerHTML='<div style=\"font-size:13px;color:#10b981;font-weight:600;\">",
    'style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"',
    "'<div style=\"color:#10b981;font-weight:600;font-size:13px;\">",
    'style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--ios-sep);font-size:13px;"',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Sklad Material Symbol icons should use shared size utility classes
// instead of repeated inline font-size/vertical-align style strings, and
// the stats-page recent-activity log rows should use class-based cells.
{
  const text = readSkladCombined();
  const label = 'sklad icons use ic-* size utilities; stats log uses class-based rows';
  const required = [
    '.ic-16-3{font-size:16px;vertical-align:-3px;}',
    '.ic-15-3{font-size:15px;vertical-align:-3px;}',
    '.ic-14-2{font-size:14px;vertical-align:-2px;}',
    '.ic-13-2{font-size:13px;vertical-align:-2px;}',
    '.ic-12-2{font-size:12px;vertical-align:-2px;}',
    '.ic-16{font-size:16px;}',
    '.ic-18{font-size:18px;}',
    '.ic-15{font-size:15px;}',
    '.ic-48{font-size:48px;}',
    '.ic-40{font-size:40px;}',
    '.ic-20{font-size:20px;}',
    'class="stat-log-row"',
    'class="stat-log-name"',
    'class="stat-log-person"',
    'class="stat-log-date"',
  ];
  const forbidden = [
    'style="font-size:16px;vertical-align:-3px;"',
    'style="font-size:15px;vertical-align:-3px;"',
    'style="font-size:14px;vertical-align:-2px;"',
    'style="font-size:13px;vertical-align:-2px;"',
    'style="font-size:12px;vertical-align:-2px;"',
    "<div style=\"display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--ios-sep);font-size:13px;\">",
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// The dispatcher card's task-toggle dot and the PIN-modal icon circles
// should use class-based markup instead of repeated inline style strings.
{
  const text = readOsbbCombined();
  const label = 'osbb dispatcher task dot and PIN-modal icons use class-based markup';
  const required = [
    "class=\"task-check-dot${row.tasks?.[t.id]?' is-checked':''}\"",
    '.pin-modal-icon-wrap { display:inline-flex; width:40px; height:40px; border-radius:50%; align-items:center; justify-content:center; }',
    '.pin-modal-icon-wrap.is-indigo { background:rgba(129,140,248,0.2); }',
    '.pin-modal-icon-wrap.is-red { background:color-mix(in srgb,var(--md-sys-color-error,#ef4444) 20%,transparent); }',
    '.pin-modal-icon-wrap.is-green { background:rgba(52,199,89,0.2); }',
    '.pin-modal-icon-wrap.is-green-soft { background:rgba(52,199,89,0.15); }',
    'class="pin-modal-icon-wrap is-indigo"',
    'class="pin-modal-icon-wrap is-red"',
    'class="pin-modal-icon-wrap is-green"',
    'class="pin-modal-icon-wrap is-green-soft"',
  ];
  const forbidden = [
    "style=\"width:20px;height:20px;border-radius:50%;border:2px solid ${row.tasks?.[t.id]?",
    'style="display:inline-flex;width:40px;height:40px;border-radius:50%;background:rgba(129,140,248,0.2);',
    'style="display:inline-flex;width:40px;height:40px;border-radius:50%;background:rgba(239,68,68,0.2);',
    'style="display:inline-flex;width:40px;height:40px;border-radius:50%;background:rgba(52,199,89,0.2);',
    'style="display:inline-flex;width:40px;height:40px;border-radius:50%;background:rgba(52,199,89,0.15);',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Journal "other tasks" print summary and dispatcher call-count field must
// escape their Supabase-sourced free-text/JSONB values before injecting
// them into innerHTML templates.
{
  const text = readOsbbCombined();
  const label = 'osbb print-summary and dispatcher call count escape dynamic text';
  const required = [
    'printSummary.push(escapeHtml(state.other))',
    'value="${escapeAttr(String(row.calls||\'\'))}" placeholder="0"',
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

// Icon-only Sklad log/receipt/category-filter/delete buttons must expose an
// aria-label since their only visible content is a Material Symbols icon.
// (The desktop item-row delete action moved into the item-more menu — see
// the "table-modern"/kebab-menu pass — where it's a text+icon menuitem, not
// icon-only, so it no longer needs its own aria-label; not guarded here.)
{
  const text = readSkladCombined();
  const label = 'sklad icon-only log/receipt/filter/delete buttons expose aria-label';
  const required = [
    'data-log-category-filter="Прибирання" aria-label="Фільтр за категорією: Прибирання"',
    'data-log-category-filter="Ремонт" aria-label="Фільтр за категорією: Ремонт"',
    'data-log-category-filter="Електрика" aria-label="Фільтр за категорією: Електрика"',
    'data-log-category-filter="Сантехніка" aria-label="Фільтр за категорією: Сантехніка"',
    'data-log-action="edit" data-log-id="${l.id}" aria-label="Редагувати запис видачі"',
    'data-log-action="delete" data-log-id="${l.id}" aria-label="Видалити запис видачі"',
    'data-receipt-action="edit" data-receipt-id="${r.id}" aria-label="Редагувати прихід"',
    'data-receipt-action="delete" data-receipt-id="${r.id}" aria-label="Видалити прихід"',
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

// Journal/dispatcher task-toggle checkboxes are custom <span> controls, not
// native inputs — they must expose checkbox semantics and be keyboard
// operable (tabindex/role/aria-checked plus an Enter/Space handler).
{
  const text = readOsbbCombined();
  const label = 'osbb task-toggle dots expose checkbox semantics and keyboard support';
  const required = [
    'role="checkbox" aria-checked="${isChecked?\'true\':\'false\'}" aria-label="${escapeAttr(task.label)}" tabindex="${disabled?\'-1\':\'0\'}"',
    'role="checkbox" aria-checked="${row.tasks?.[t.id]?\'true\':\'false\'}" aria-label="${escapeAttr(t.label)}" tabindex="${row.working?\'0\':\'-1\'}"',
    "container.addEventListener('keydown', (event) => {\n                if (event.key !== 'Enter' && event.key !== ' ') return;\n                const trigger = event.target.closest('[data-journal-action=\"task-toggle\"]');",
    "container.addEventListener('keydown', (event) => {\n                if (event.key !== 'Enter' && event.key !== ' ') return;\n                const trigger = event.target.closest('[data-disp-action=\"task-toggle\"]');",
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

// Dispatcher and garbage also switched from a day-card accordion list to a
// calendar grid (same pattern as journal): each day is a native <button>
// that opens the shared day-detail-modal, and edits made inside that modal
// refresh the still-open modal via refreshOpenDayDetail() so toggled
// checkboxes/selects don't look stale until the modal is closed and reopened.
{
  const text = readOsbbCombined();
  const label = 'osbb dispatcher/garbage calendar grids open an accessible day-detail dialog';
  const required = [
    "cell.className = 'month-grid-cell' + (isWeekend ? ' is-weekend' : '') + (isToday2 ? ' is-today' : '') + (hasAny ? ' has-shifts' : '');",
    "cell.className = 'month-grid-cell' + (isWeekend ? ' is-weekend' : '') + (isToday ? ' is-today' : '') + (row.working ? ' has-shifts' : '');",
    "cell.setAttribute('aria-haspopup', 'dialog');",
    'function gOpenDayDetail(day) {',
    'function dispOpenDayDetail(d) {',
    "function refreshOpenDayDetail(context, day) {",
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

// Journal switched from a day-card accordion list to a calendar grid: each
// day is a native <button> (keyboard-operable for free, no manual
// role/tabindex plumbing needed) that opens a day-detail-modal dialog.
{
  const text = readOsbbCombined();
  const label = 'osbb journal calendar grid opens an accessible day-detail dialog';
  const required = [
    "cell.type = 'button';",
    "cell.setAttribute('aria-haspopup', 'dialog');",
    'id="day-detail-modal" class="day-detail-overlay no-print" data-day-detail-backdrop role="dialog" aria-modal="true"',
    'function openDayDetail(d) {',
    'function closeDayDetail() {',
    "if (event.key === 'Escape' && document.getElementById('day-detail-modal')?.classList.contains('open')) closeDayDetail();",
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

// delPinModal must close through the shared closeModal() helper (which
// restores focus to the opener) on every path, not via a direct
// classList.remove('open') that bypasses focus restoration; and the
// sklad lightbox (which has its own bespoke open/close, not the shared
// modal-bg pattern) must still be covered by the Tab focus trap.
{
  const text = readSkladCombined();
  const label = 'sklad delPinModal always closes via closeModal(); lightbox is Tab-trapped';
  const required = [
    "closeModal('delPinModal');",
    "if(lightbox && lightbox.classList.contains('open')) openModals.push(lightbox);",
    'modalBg.matches(\'[role="dialog"]\') ? modalBg : modalBg.querySelector(\'[role="dialog"]\')',
  ];
  const forbidden = [
    "document.getElementById('delPinModal').classList.remove('open');",
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// The OSBB lightbox has its own bespoke open/close (no shared modal
// helper in this file) — it must have a Tab focus trap alongside its
// existing Escape/arrow-key handling.
{
  const text = readOsbbCombined();
  const label = 'osbb lightbox has a Tab focus trap';
  const required = [
    "if (e.key === 'Tab') {",
    'const focusables = [...lb.querySelectorAll(\'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])\')].filter(el => el.offsetParent !== null);',
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

// Journal sync-status/joke-icon spans should use class-based helpers instead
// of the repeated inline-flex/vertical-align style strings.
{
  const text = readOsbbCombined();
  const label = 'osbb journal status/icon spans use class-based helpers';
  const required = [
    '.journal-status-icon-row { display:inline-flex; align-items:center; gap:5px; }',
    '.journal-status-icon-row-tight { display:inline-flex; align-items:center; gap:4px; }',
    '.journal-joke-icon { display:inline-block; vertical-align:-2px; }',
    '.journal-daytype-icon { display:inline-block; vertical-align:middle; margin-right:3px; }',
  ];
  const forbidden = [
    'style="display:inline-flex;align-items:center;gap:5px;"',
    'style="display:inline-flex;align-items:center;gap:4px;"',
    'style="display:inline-block;vertical-align:-2px;"',
    'style="display:inline-block;vertical-align:middle;margin-right:3px;"',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Sklad topbar should use class-based title/action/icon helpers instead of
// dense inline styles on the header controls.
{
  const text = readSkladCombined();
  const label = 'sklad topbar uses class-based title and action controls';
  const required = [
    'id="pageTitle" class="topbar-title"',
    'class="ms topbar-title-icon"',
    'class="topbar-actions"',
    'class="btn btn-ghost btn-sm topbar-icon-btn" data-sklad-action="qr"',
    'class="ms topbar-excel-icon"',
    'class="btn btn-ghost btn-sm topbar-refresh"',
    '<details class="item-more topbar-more">',
    "icon.className='ms topbar-title-icon'",
    '.topbar-title{white-space:nowrap;',
    '.topbar-actions{display:flex;',
    '.topbar-icon-btn{padding:6px 10px;',
    '.topbar-refresh{white-space:nowrap;',
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

// Sklad lightbox and dynamic current-photo preview should use class-based image
// and empty-state shells rather than inline style strings.
{
  const text = readSkladCombined();
  const label = 'sklad lightbox and photo preview use class-based shells';
  const required = [
    'class="btn btn-danger btn-sm lightbox-delete-btn"',
    'id="lbImg" class="lightbox-img"',
    'class="photo-current-img"',
    'class="photo-empty-state"',
    '.lightbox-delete-btn{position:absolute;',
    '.lightbox-img{max-width:90vw;',
    '.photo-current-img{width:100%;',
    '.photo-empty-state{text-align:center;',
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

// Edit movement modals (issue log and receipt edits) should share the same
// class-based edit shell, and receipt delete should reuse confirm-modal.
{
  const text = readSkladCombined();
  const label = 'sklad edit movement modals use class-based shells';
  const required = [
    'class="modal edit-movement-modal"',
    'class="edit-movement-title"',
    'class="edit-movement-subtitle"',
    'class="edit-movement-form"',
    'class="edit-movement-note"',
    'class="edit-movement-actions"',
    'id="delReceiptItemName" class="confirm-target"',
    'data-sklad-action="delete-receipt-confirm"',
    'data-sklad-action="edit-log-confirm"',
    'data-sklad-action="edit-receipt-confirm"',
    '.edit-movement-modal{width:400px;',
    '.edit-movement-form{display:flex;',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const malformedReceiptDiv = text.includes('<div>\n      <div>\n        <label>Примітка</label>');
  if (missing.length || malformedReceiptDiv) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}${malformedReceiptDiv ? ' (malformed receipt note wrapper)' : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Delete, delete-log, delete-PIN and audit confirmation modals should use
// reusable class-based confirmation shells.
{
  const text = readSkladCombined();
  const label = 'sklad confirmation modals use class-based shells';
  const required = [
    'class="modal confirm-modal"',
    'class="confirm-title is-danger"',
    'class="confirm-target"',
    'class="confirm-copy"',
    'class="confirm-actions"',
    'class="modal delete-pin-modal"',
    'id="delPinTitle" class="delete-pin-title"',
    'class="delete-pin-subtitle"',
    'id="delPinErr" role="alert" aria-live="assertive" class="delete-pin-error"',
    'class="modal audit-confirm-modal"',
    'class="audit-confirm-title"',
    'id="auditSummary" class="audit-summary-box"',
    'class="audit-confirm-actions"',
    '.confirm-modal{width:380px;',
    '.delete-pin-modal{width:320px;',
    '.audit-confirm-modal{width:420px;',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const duplicatedSix = text.includes('data-delete-pin-key="6">6</button>\n      <button type="button" class="pin-key" data-delete-pin-key="6"');
  if (missing.length || duplicatedSix) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}${duplicatedSix ? ' (duplicate PIN key 6)' : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Quick issue and photo modals should use class-based shells instead of
// inline-heavy modal chrome.
{
  const text = readSkladCombined();
  const label = 'sklad quick issue and photo modals use class-based shells';
  const required = [
    'id="qmName" class="quick-issue-title"',
    'class="quick-issue-meta"',
    'class="quick-issue-form"',
    'class="quick-person-row"',
    'class="btn btn-ghost btn-sm quick-person-chip"',
    'class="quick-modal-actions"',
    'class="modal photo-modal"',
    'id="photoItemName" class="photo-modal-title"',
    'id="photoCurrent" class="photo-current"',
    'class="photo-upload-box"',
    'class="photo-upload-title"',
    'class="photo-file-input"',
    'id="photoStatus" class="photo-status"',
    'class="photo-modal-actions"',
    'class="btn btn-danger btn-sm photo-delete-btn"',
    '.quick-issue-title{font-size:15px;',
    '.photo-modal{width:420px;',
    '.photo-upload-box{border:2px dashed',
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

// Sklad stats page should use class-based panels/grids and keep a single
// low-stock stats target for renderStats().
{
  const text = readSkladCombined();
  const label = 'sklad stats page uses class-based panels';
  const required = [
    'class="card stats-panel"',
    'class="stats-balance-grid"',
    'class="stats-metric-value is-orange"',
    'class="stats-metric-value is-green"',
    'class="card stats-list-card"',
    'id="statCats" class="stats-list-stack"',
    'class="stats-filter-grid"',
    'id="valueFilterSummary" class="stats-filter-summary"',
    'class="card price-assessment-panel"',
    'id="priceSummary" class="price-assessment-summary"',
    'class="price-assessment-actions"',
    '.stats-panel{padding:18px 22px;',
    '.stats-filter-grid{display:grid;',
    '.price-assessment-panel{padding:18px 22px;',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const statLowCount = (text.match(/id="statLow"/g) || []).length;
  if (missing.length || statLowCount !== 1) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}${statLowCount !== 1 ? ` (statLow count: ${statLowCount})` : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Sklad add/refill page should use class-based form/card helpers instead of
// inline-heavy add-page chrome.
{
  const text = readSkladCombined();
  const label = 'sklad add and refill page uses class-based shell';
  const required = [
    'class="card add-card"',
    'class="add-section-title is-refill"',
    'class="add-form-stack"',
    'id="refillInfo" class="refill-info"',
    'class="form-note"',
    'class="btn btn-success full-action"',
    'class="add-new-section"',
    'class="add-new-stack"',
    'id="newNameMatches" class="new-name-matches"',
    'class="btn btn-ghost add-scanner-btn"',
    'class="internal-use-toggle"',
    'class="add-side-stack pc-only"',
    'class="card add-help-card"',
    'class="add-help-list"',
    'class="card add-low-card"',
    '.add-card{padding:28px;',
    '.two-col{display:grid;',
    '.internal-use-toggle{display:flex;',
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

// QR scanner and chart modal chrome should use small class-based shells
// instead of inline title/action styles.
{
  const text = readSkladCombined();
  const label = 'sklad qr and chart modals use class-based shells';
  const required = [
    'class="qr-modal-title"',
    'class="qr-modal-copy"',
    'class="qr-modal-actions"',
    '.qr-modal-title{display:flex;',
    '.qr-modal-copy{font-size:12px;',
    '.qr-modal-actions{display:flex;',
    'class="chart-modal-title"',
    'class="btn btn-ghost btn-sm chart-modal-close"',
    '.chart-modal-title{display:flex;',
    '.chart-modal-close{margin-top:16px;}',
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

// Barcode add modal should use class-based scanner/manual-entry controls
// instead of inline layout styles.
{
  const text = readSkladCombined();
  const label = 'sklad barcode modal uses class-based shell';
  const required = [
    'class="barcode-modal-title"',
    'id="barcodeAddScanning" class="barcode-scan-status"',
    'class="barcode-manual-entry"',
    'class="barcode-manual-title"',
    'class="barcode-manual-row"',
    'class="barcode-modal-close"',
    '.barcode-modal-title{display:flex;',
    '.barcode-manual-entry{margin-top:14px;',
    '.barcode-manual-row{display:flex;',
    '.barcode-modal-close .btn{width:100%;',
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

// Item history modal should use class-based title/subtitle/list/state rows
// instead of inline layout styles.
{
  const text = readSkladCombined();
  const label = 'sklad history modal uses class-based shell';
  const required = [
    'class="history-modal-title"',
    'class="history-modal-subtitle"',
    'id="histList" class="history-modal-list"',
    'class="btn btn-ghost btn-sm history-modal-close"',
    '.history-modal-state{text-align:center;',
    '.hist-main{flex:1;',
    '.hist-person{font-weight:700;',
    '.hist-meta{font-size:11px;',
    'class="history-modal-state"',
    'class="hist-main"',
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

// Internet price lookup results should render with reusable result-row classes,
// while keeping links sanitized and apply actions data-driven.
{
  const text = readSkladCombined();
  const label = 'sklad price lookup results use class-based rows';
  const required = [
    '.price-results-state{padding:18px;',
    '.price-result-card{padding:10px 0;',
    '.price-result-main{flex:1;',
    '.price-result-link{color:var(--brand);',
    '.price-result-apply{margin-top:6px;}',
    'class="price-results-state is-loading"',
    'class="price-result-card"',
    'class="price-result-link" href="${safeLink}" target="_blank" rel="noopener noreferrer"',
    'class="btn btn-primary btn-sm price-result-apply" data-price-result-action="apply"',
    'class="price-results-state is-error"',
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

// Price lookup modal should use the same class-based shell as manual price
// instead of embedding its grid/results/actions layout inline.
{
  const text = readSkladCombined();
  const label = 'sklad price lookup modal uses class-based shell';
  const required = [
    'class="modal price-lookup-modal"',
    'class="price-lookup-title"',
    'class="price-results-panel"',
    '.price-lookup-modal{max-width:560px;}',
    '.price-search-row{display:grid;',
    '.price-results-panel{min-height:80px;',
    '.price-modal-actions{display:flex;',
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

// Manual price modal should not open with accidental blue text selection; it
// clears stale selections and focuses the price input without selecting modal text.
{
  const text = readSkladCombined();
  const label = 'sklad manual price modal clears accidental text selection';
  const required = [
    'class="modal manual-price-modal"',
    '.manual-price-modal{max-width:460px;}',
    '.manual-price-form{display:flex;',
    '.manual-price-actions{display:flex;',
    '#manualPriceModal .modal{user-select:none;',
    '#manualPriceModal input{user-select:text;',
    'id="manualPriceValue" type="number" min="0" step="0.01" placeholder="0.00" data-modal-initial-focus',
    'function clearTextSelection()',
    'selection.removeAllRanges()',
    "const preferredFocus = dialog.querySelector('[data-modal-initial-focus]')",
    'requestAnimationFrame(clearTextSelection)',
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

// Sklad receipt and audit screens should follow the same calm workflow/list
// primitives as items, issue, and log instead of reverting to ad-hoc inline rows.
{
  const text = readSkladCombined();
  const label = 'sklad receipts and audit screens use redesigned workflow primitives';
  const required = [
    'class="receipts-toolbar"',
    'class="receipts-search-row"',
    'class="receipt-mobile-item"',
    'class="receipt-mobile-actions"',
    'class="audit-toolbar"',
    'class="audit-search-row"',
    'class="audit-legend"',
    'class="audit-list"',
    'class="audit-item ${stateClass}"',
    'class="audit-qty-input"',
    '.receipts-toolbar,.audit-toolbar{position:sticky;',
    '.audit-item{',
    '.receipt-mobile-item{',
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


// OSBB journal header should be split into clear title/status, calendar/action,
// and tab rows so the controls do not collapse into one dense visual band.
{
  const text = readOsbbCombined();
  const label = 'journal header uses separated title action and tab rows';
  const required = [
    'class="no-print journal-shell-header"',
    'class="journal-title-row"',
    'class="journal-title-actions"',
    'class="journal-action-row"',
    'class="journal-calendar-controls"',
    'class="journal-export-actions"',
    'class="journal-tabs-row"',
    '.journal-shell-header {',
    '.journal-shell-header::after',
    '.journal-title-heading {',
    'class="journal-title-heading"',
    'class="journal-title-copy"',
    '--surface-1:',
    '--shadow-md:',
    '.journal-theme-toggle {',
    'class="journal-theme-toggle md-state-layer" data-theme-toggle',
    'function toggleTheme()',
    '.journal-dashboard-panel {',
    '.journal-stats-grid {',
    '.journal-stat-card {',
    '.journal-mini-stats {',
    '.journal-mini-stat {',
    '.skel-w-date { width: 70px; }',
    'class="skel skel-bar skel-w-main"',
    '.lock-screen { position:fixed;',
    'class="lock-screen"',
    'class="pin-keypad"',
    'class="ios-toast"',
    'class="pin-modal-overlay"',
    'class="pin-key-action pin-key-cancel"',
    '.pin-modal-icon-wrap.is-red {',
    'class="pin-modal-icon-wrap is-indigo"',
    'class="pin-modal-icon-wrap is-green"',
    'class="pin-modal-icon-wrap is-green-soft"',
    'class="toast-icon-badge"',
    '.status-label { display:inline-flex;',
    'class="status-label"',
    'class="status-label is-tight"',
    '<link rel="stylesheet" href="/Osbb/shared/ui.css">',
    '<script src="/Osbb/shared/enhance-select.js"></script>',
    '// Кастомний select підключено зі shared/enhance-select.js.',
    '.journal-mini-stats.is-two {',
    'class="journal-mini-stats is-two"',
    'class="stat-card journal-stat-card journal-mini-stat role-garbage',
    'class="stat-card journal-stat-card journal-mini-stat role-dispatcher',
    '.journal-panel {',
    '.journal-table-shell {',
    '.garbage-chart-panel { padding:16px;',
    '.journal-list-shell { overflow:hidden; border-radius:var(--md-sys-shape-corner-extra-large, 32px)!important; padding:0!important; }',
    '.journal-list-head { padding:16px 22px;',
    '.garbage-chart { height:80px; }',
    'class="journal-panel garbage-chart-panel"',
    'class="journal-panel journal-list-shell"',
    'class="garbage-chart flex items-end justify-between gap-1"',
    'class="journal-panel"',
    'class="desktop-table print-card journal-table-shell overflow-hidden"',
    'class="journal-dashboard-panel"',
    'class="journal-stats-grid"',
    'class="stat-card journal-stat-card role-electrician',
    '.journal-title-row {',
    '.journal-action-row {',
    '.journal-tabs-row {',
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




// Journal theme toggle should avoid colored emoji glyphs and use the compact
// monochrome control style matching Sklad more closely.
{
  const text = readFileSync('osbb/index.html', 'utf8');
  const label = 'journal theme toggle uses monochrome icon';
  const required = [
    'id="journalThemeIcon" class="journal-theme-icon" aria-hidden="true"><svg',
    'fill="currentColor" stroke="none"/></svg></span><span id="journalThemeLabel"',
  ];
  const forbidden = ['☀️', '🌙'];
  const missing = required.filter(needle => !text.includes(needle));
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  if (missing.length || hasForbidden) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}${hasForbidden ? ' (colored emoji icon present)' : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}


// Garbage dashboard chart should load the full selected year from Supabase, not
// only whatever months happen to exist in localStorage.
{
  const text = readFileSync('osbb/index.html', 'utf8');
  const label = 'journal garbage chart fetches yearly cloud data';
  const required = [
    'function gMonthKeyCandidates(year = currentYear, month = currentMonth)',
    'async function gFetchGarbageMonthData(year = currentYear, month = currentMonth)',
    "String(month).padStart(2,'0')",
    'async function gLoadGarbageYearFromCloud(year)',
    "db.from('garbage').select('month_key,data')",
    'const candidates = gMonthKeyCandidates(year, month)',
    'candidates.map(key => rows.find(item => String(item.month_key) === key)).find(Boolean)',
    'localStorage.removeItem(`garbage_${year}_${month}`)',
    'await gLoadGarbageYearFromCloud(currentYear)',
    "String(d).padStart(2,'0')",
  ];
  const forbidden = ["String(d).padStart(2,'00')", 'oneBasedMonth', ".select('month_key,data').in(", "keys.map(monthKey =>", 'Promise.all(Array.from({ length: 12 }, async (_, month) =>'];
  const missing = required.filter(needle => !text.includes(needle));
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  if (missing.length || hasForbidden) {
    failed += 1;
    console.error(`not ok - ${label}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}${hasForbidden ? ' (forbidden stale padding)' : ''}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}


// OSBB static icon/action markup should keep moving repeated inline layout
// styles into reusable classes instead of duplicating SVG layout style strings.
{
  const text = readOsbbCombined();
  const label = 'journal static icons and header actions use reusable style classes';
  const required = [
    '.journal-inline-icon {',
    '.journal-action-label {',
    '.journal-action-btn {',
    'class="journal-action-btn journal-action-btn-ghost md-state-layer"',
    'class="journal-action-btn journal-action-btn-danger md-state-layer"',
    'class="journal-inline-icon"',
    '<span class="journal-action-label"><svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="journal-inline-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Коментар</span>',
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

// Dynamic journal/garbage/dispatcher form controls should not rely solely on
// visual context; generated controls need stable labels for assistive tech.
{
  const text = readOsbbCombined();
  const label = 'journal dynamic controls expose aria-labels';
  const required = [
    'aria-label="Зміна ${roleNames[role]} за день ${d}"',
    'aria-label="Кількість заявок ${roleNames[role]} за день ${d}"',
    'aria-label="Додати фото ${roleNames[role]} за день ${d}"',
    'aria-label="Коментар до дня ${d}"',
    'aria-label="Інші роботи ${roleNames[role]} за день ${d}"',
    'aria-label="Час вивозу сміття за день ${day}"',
    'aria-label="Працівник сміття за день ${day}"',
    'aria-label="Кількість баків за день ${day}"',
    'aria-label="Зміна диспетчера за день ${d}"',
    'aria-label="Кількість дзвінків диспетчера за день ${d}"',
    'aria-label="Коментар диспетчера за день ${d}"',
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

// Placeholder-only search/chat fields need stable accessible names.
{
  const osbb = readFileSync('osbb/index.html', 'utf8');
  const sklad = readFileSync('sklad/index.html', 'utf8');
  const label = 'search and chat fields expose aria-labels';
  const required = [
    [sklad, 'id="searchInp" aria-label="Пошук товарів"'],
    [sklad, 'id="logSearch" aria-label="Пошук у журналі видач"'],
    [sklad, 'id="auditSearch" aria-label="Пошук товару для інвентаризації"'],
    [sklad, 'id="recSearch" aria-label="Пошук у приходах"'],
    [sklad, 'id="manualBarcodeI" class="inp" aria-label="Ввести штрих-код вручну"'],
    [osbb, "id=\"chat-author\" type=\"text\" aria-label=\"Ваше ім'я в чаті\""],
    [osbb, 'id="chat-input" rows="2" aria-label="Повідомлення в чат"'],
  ];
  const missing = required.filter(([text, needle]) => !text.includes(needle)).map(([, needle]) => needle);
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Rendered images should carry alt text, including dynamic photo thumbnails and
// lightbox images.
for (const file of ['index.html', 'osbb/index.html', 'sklad/index.html']) {
  const text = readFileSync(file, 'utf8');
  const label = `${file} images expose alt text`;
  const missingAlt = text.match(/<img(?![^>]*\balt=)/g) || [];
  if (missingAlt.length) {
    failed += 1;
    console.error(`not ok - ${label} (${missingAlt.length} images missing alt)`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// External links opened in a new tab should avoid opener leaks.
for (const file of ['index.html', 'sklad/index.html']) {
  const text = readFileSync(file, 'utf8');
  const label = `${file} blank links use noopener noreferrer`;
  const blankLinks = text.match(/<a\b(?=[^>]*target="_blank")[^>]*>/gs) || [];
  const missing = blankLinks.filter(link => !link.includes('rel="noopener noreferrer"'));
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (${missing.length} blank links missing noreferrer)`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Inline SVG icons are decorative because adjacent text/aria-labels carry the
// accessible names. Keep them hidden from assistive tech and unfocusable, while
// ignoring SVG data URLs used for favicons.
for (const file of ['index.html', 'osbb/index.html', 'sklad/index.html']) {
  const text = readFileSync(file, 'utf8');
  const label = `${file} inline SVG icons are decorative`;
  const htmlSvgLines = text.split('\n').filter(line => line.includes('<svg') && !line.includes('data:image/svg+xml'));
  const missing = htmlSvgLines.filter(line => !line.includes('<svg aria-hidden="true" focusable="false"'));
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (${missing.length} inline SVGs missing aria-hidden/focusable)`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Shell and journal controls are action buttons rather than form submits; keep
// explicit button types to avoid accidental submit/reload regressions as markup
// shifts around modals and toolbar containers.
for (const file of ['index.html', 'osbb/index.html']) {
  const text = readFileSync(file, 'utf8');
  const label = `${file} buttons declare explicit button type`;
  const missingType = text.match(/<button(?![^>]*\btype=)/g) || [];
  if (missingType.length) {
    failed += 1;
    console.error(`not ok - ${label} (${missingType.length} missing type attributes)`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Sklad buttons live inside several modal/form-like containers and dynamic
// templates; keep them explicit non-submit controls unless a future form needs
// a real submit button.
{
  const text = readSkladCombined();
  const label = 'sklad buttons declare explicit button type';
  const missingType = text.match(/<button(?![^>]*\btype=)/g) || [];
  if (missingType.length) {
    failed += 1;
    console.error(`not ok - ${label} (${missingType.length} missing type attributes)`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Sklad page titles should be rendered with DOM text nodes instead of assigning
// HTML strings, and the mobile bottom nav should expose semantic navigation and
// stable labels for icon-heavy buttons.
{
  const text = readSkladCombined();
  const label = 'sklad navigation titles and mobile nav are semantic';
  const forbidden = [
    "document.getElementById('pageTitle').innerHTML=pageTitles[page]||''",
    "const pageTitles={items:'<span",
  ];
  const required = [
    'function setPageTitle(page)',
    "target.append(icon,document.createTextNode(title.label));",
    '<nav class="bottom-nav" id="bottomNav" aria-label="Мобільні розділи складу">',
    'data-page="items" aria-current="page" aria-label="Товари"',
    'data-page="add" aria-label="Додати або поповнити"',
    'class="ms" aria-hidden="true">fact_check</span>',
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

// Quantity values rendered in HTML contexts should be string-escaped too; these
// can be stale/offline/database values rather than guaranteed numbers.
{
  const text = readSkladCombined();
  const label = 'sklad HTML quantity renderers escape values';
  const required = [
    '${escapeHtml(String(item.quantity??0))} ${unit}',
    '<span class="${qc}">${escapeHtml(String(item.quantity??0))}</span>',
    '<span class="${qc} m-card-qty-value">${escapeHtml(String(item.quantity??0))}</span>',
    '−${escapeHtml(String(l.quantity??0))}</div>',
    '−${escapeHtml(String(l.quantity??0))}<span',
    '+${escapeHtml(String(r.quantity??0))}<span',
    "${escapeHtml(String(i.quantity??0))} ${escapeHtml(i.unit||'')}",
    "(${escapeHtml(String(i.quantity??0))} ${escapeHtml(i.unit||'')})",
    '−${escapeHtml(String(l.quantity??0))} ${unit}',
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

// Chart/stat renderers should escape labels that can come from stored data.
{
  const sklad = readFileSync('sklad/index.html', 'utf8');
  const label = 'dashboard stat labels escape stored text';
  const required = [
    [sklad, "const safeCat=escapeHtml(cat||'—');"],
    [sklad, '${safeCat}</span>'],
  ];
  const missing = required.filter(([text, needle]) => !text.includes(needle)).map(([, needle]) => needle);
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Regression guard: the Sklad issue log must not reference variables that are
// only defined in other renderers (this previously broke the Journal page with
// `safeCat is not defined`).
{
  const text = readSkladCombined();
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
  const text = readSkladCombined();
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
  const text = readSkladCombined();
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
  const text = readSkladCombined();
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
  const text = readSkladCombined();
  const sharedSelectText = existsSync('shared/enhance-select.js') ? readFileSync('shared/enhance-select.js', 'utf8') : '';
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
    'data-issue-select data-searchable="1"',
    'data-search-placeholder="Пошук товару для видачі..."',
    'data-log-category-filter="Ремонт"',
    'data-refill-select data-searchable="1"',
    'data-search-placeholder="Пошук товару для поповнення..."',
    'id="manualPriceItemSel" data-searchable="1"',
    'data-search-placeholder="Пошук товару для ручної ціни..."',
    "className = 'inp custom-select-search'",
    '.custom-select-search{margin:8px;',
    'data-new-product-input',
    'data-render-audit-input',
    'data-render-receipts-input',
  ];
  const hasForbidden = forbidden.some(needle => text.includes(needle));
  const haystack = `${text}
${sharedSelectText}`;
  const missing = required.filter(needle => !haystack.includes(needle));
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
  const text = readSkladCombined();
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
  const text = readSkladCombined();
  const label = 'sklad modals expose accessible dialog semantics';
  const modalCount = (text.match(/<div class="modal(?:\s[^"]*)?"/g) || []).length;
  const dialogCount = (text.match(/role="dialog" aria-modal="true" tabindex="-1"/g) || []).length;
  const required = [
    'function openModal',
    'function focusModalDialog',
    'focusModalDialog(modalBg)',
    'function trapModalFocus',
    'modalFocusReturn',
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


// Mobile item overflow menus must stay inside the usable viewport. This guards
// the positioning logic that accounts for the sticky filter toolbar, floating
// bottom nav, and viewport changes on mobile browsers.
{
  const text = readSkladCombined();
  const label = 'sklad item menus account for mobile viewport boundaries';
  const required = [
    "const bottomNav=document.querySelector('.bottom-nav')",
    "getComputedStyle(bottomNav).display!=='none'",
    'bottomNav.getBoundingClientRect().top',
    'const spaceAbove=Math.max(0,summaryRect.top-topBoundary-12)',
    'const spaceBelow=Math.max(0,bottomBoundary-summaryRect.bottom-12)',
    "panel.style.maxHeight=Math.max(160,Math.min(360,available))+'px'",
    'function repositionOpenItemMenus',
    'itemMenuRepositionFrame=requestAnimationFrame',
    "document.addEventListener('scroll',repositionOpenItemMenus,{passive:true,capture:true})",
    "window.visualViewport?.addEventListener('resize',repositionOpenItemMenus,{passive:true})",
    '.m-card.has-open-menu,.table-modern tr.has-open-menu{position:relative;z-index:90;}',
    '.item-more[open]{z-index:100;}',
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

// Price result actions can contain merchant/source/link text with apostrophes, so
// they must not be serialized into inline JS argument lists.
{
  const text = readSkladCombined();
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
  const text = readSkladCombined();
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

// On mobile, the price lookup modal can produce long result lists. Keep it
// scrollable and keep the close action sticky, while using solid light cards for
// cleaner contrast in the item list.
{
  const text = readSkladCombined();
  const label = 'sklad mobile price modal is scrollable and closeable';
  const required = [
    '#priceModal .modal{display:flex',
    '#priceResults{max-height:52dvh',
    '.price-modal-actions{position:sticky',
    'class="price-search-row"',
    'class="price-modal-actions"',
    '.theme-light .m-card{background:#fff',
    '.theme-light .m-card .btn-ghost',
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
  const text = readSkladCombined();
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
  const text = readSkladCombined();
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
  const text = readSkladCombined();
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






// Build tooling should not float on latest: a TypeScript/Vite major release can
// break CI without any repository change. Keep exact versions until dependency
// updates are handled deliberately.
{
  const label = 'frontend build tooling uses pinned devDependency versions';
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const deps = pkg.devDependencies || {};
  const offenders = Object.entries(deps)
    .filter(([name, version]) => ['typescript', 'vite'].includes(name) && (version === 'latest' || String(version).startsWith('^') || String(version).startsWith('~')))
    .map(([name, version]) => `${name}@${version}`);
  if (offenders.length) {
    failed += 1;
    console.error(`not ok - ${label} (floating: ${offenders.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// The production shell must have a plain-JavaScript runtime fallback because
// GitHub Pages may briefly serve repository-root files before/without the
// Actions-built dist artifact. If index.html points at raw .ts, PIN buttons do
// not get bound in browsers.
{
  const label = 'shell uses browser-runnable JavaScript runtime fallback';
  const index = readFileSync('index.html', 'utf8');
  const requiredFiles = ['src/shell.js', 'src/shell-controller.js', 'src/auth-session.js', 'src/shell-state.js', 'src/supabase-api.js'];
  const missing = [];
  if (!index.includes('src="src/shell.js"')) missing.push('index.html:src/shell.js');
  if (index.includes('src="/src/shell.ts"') || index.includes('src="src/shell.ts"')) missing.push('index.html:raw TypeScript module');
  for (const file of requiredFiles) {
    if (!existsSync(file)) missing.push(file);
  }
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Vite/GitHub Pages build invariants: GitHub Pages serves this project under
// /Osbb/, and the Vite build must include all three HTML entrypoints plus the
// PWA/service-worker files copied into dist/ after bundling.
{
  const label = 'Vite Pages build uses /Osbb/ base, MPA inputs, and postbuild static copy';
  const vite = readFileSync('vite.config.ts', 'utf8');
  const pkg = readFileSync('package.json', 'utf8');
  const pages = readFileSync('.github/workflows/pages.yml', 'utf8');
  const copy = readFileSync('scripts/copy-static-assets.mjs', 'utf8');
  const required = [
    [vite, "base: '/Osbb/'", 'vite.config.ts:base'],
    [vite, "main: 'index.html'", 'vite.config.ts:main input'],
    [vite, "osbb: 'osbb/index.html'", 'vite.config.ts:osbb input'],
    [vite, "sklad: 'sklad/index.html'", 'vite.config.ts:sklad input'],
    [pkg, 'vite build && node scripts/copy-static-assets.mjs', 'package.json:postbuild copy'],
    [pages, 'npm run test', '.github/workflows/pages.yml:test'],
    [pages, 'npm run build', '.github/workflows/pages.yml:build'],
    [pages, 'actions/upload-pages-artifact@v3', '.github/workflows/pages.yml:artifact'],
    [pages, 'actions/deploy-pages@v4', '.github/workflows/pages.yml:deploy'],
    [copy, "'sw.js'", 'copy-static-assets.mjs:root sw'],
    [copy, "'osbb/sw.js'", 'copy-static-assets.mjs:osbb sw'],
    [copy, "'sklad/sw.js'", 'copy-static-assets.mjs:sklad sw'],
  ];
  const missing = required.filter(([text, needle]) => !text.includes(needle)).map(([, , name]) => name);
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Shared enhance-select helper should be used by journal and sklad instead of duplicated inline copies.
{
  const missing = [];
  if (!existsSync('shared/enhance-select.js')) missing.push('shared/enhance-select.js');
  for (const file of ['osbb/index.html', 'sklad/index.html']) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('src="/Osbb/shared/enhance-select.js"')) missing.push(`${file}:script`);
    if (text.includes('function enhanceSelect(')) missing.push(`${file}:inline enhanceSelect`);
  }
  const helper = existsSync('shared/enhance-select.js') ? readFileSync('shared/enhance-select.js', 'utf8') : '';
  for (const marker of ['window.enhanceSelect = enhanceSelect;', 'window.refreshEnhancedSelect = refreshEnhancedSelect;', 'custom-select-arrow', 'custom-select-empty']) {
    if (!helper.includes(marker)) missing.push(`shared/enhance-select.js:${marker}`);
  }
  if (missing.length) {
    failed += 1;
    console.error(`not ok - shared/enhance-select.js exists, is linked, and not re-duplicated inline (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log('ok - shared/enhance-select.js exists, is linked, and not re-duplicated inline');
  }
}

// Shared stylesheets should be available to all entrypoints.
{
  const sharedStyles = ['ui.css', 'material-tokens.css'];
  const files = ['index.html', 'osbb/index.html', 'sklad/index.html'];
  const missing = [];
  for (const stylesheet of sharedStyles) {
    const path = `shared/${stylesheet}`;
    if (!existsSync(path)) missing.push(path);
    for (const file of files) {
      const marker = `href="/Osbb/shared/${stylesheet}"`;
      if (!readFileSync(file, 'utf8').includes(marker)) missing.push(`${file}:${marker}`);
    }
  }
  if (missing.length) {
    failed += 1;
    console.error(`not ok - shared stylesheets exist and are linked from all three entrypoints (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log('ok - shared stylesheets exist and are linked from all three entrypoints');
  }
}

// Desktop item table row should collapse secondary actions into the same
// item-more kebab menu the mobile cards already use, instead of a dense row
// of 7 icon-only buttons — and .table-modern must not clip that menu.
{
  const text = readSkladCombined();
  const label = 'sklad desktop item row uses the shared item-more kebab menu, not a dense icon row';
  const required = [
    'data-item-action="quick" data-item-id="${id}"><span class="ms ic-15-3">output</span> Видати',
    'data-item-action="history" data-item-id="${id}"><span class="ms ic-15-3">history</span> Історія',
    '<details class="item-more"><summary aria-label="Додаткові дії" aria-haspopup="menu" aria-expanded="false">',
    '.table-modern{overflow:visible;}',
    '.table-modern thead tr:first-child th:first-child{border-top-left-radius:var(--radius-xl);}',
  ];
  const forbidden = [
    'class="btn btn-ghost btn-sm" data-item-action="photo" data-item-id="${id}" aria-label="Фото"',
    '.table-modern{overflow:hidden;}',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const present = forbidden.filter(needle => text.includes(needle));
  if (missing.length || present.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; leftover: ${present.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

if (failed) {
  console.error(`\n${failed} smoke check(s) failed.`);
  process.exit(1);
}
console.log(`\n${passed} smoke checks passed.`);
