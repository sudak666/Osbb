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
  ['osbb/index.html', 'id="desktop-tabs" class="journal-tabs" role="tablist" aria-label="Розділи журналу"', 'journal desktop tabs expose tablist semantics'],
  ['osbb/index.html', 'id="tab-dispatcher" role="tab" aria-selected="true" aria-controls="section-dispatcher" aria-current="page"', 'journal desktop active tab exposes tab semantics'],
  ['osbb/index.html', 'id="bottom-nav" role="tablist" aria-label="Мобільні розділи журналу"', 'journal mobile tabs expose tablist semantics'],
  ['osbb/index.html', 'id="tab-dispatcher-m" role="tab" aria-selected="true" aria-controls="section-dispatcher" aria-current="page"', 'journal mobile active tab exposes tab semantics'],
  ['osbb/index.html', "el.toggleAttribute('aria-current', t === tab)", 'journal tab switch updates aria-current'],
  ['osbb/index.html', "el.setAttribute('aria-selected', String(t === tab))", 'journal tab switch updates aria-selected'],
  ['sklad/index.html', '<nav aria-label="Розділи складу">', 'sklad sidebar exposes navigation label'],
  ['sklad/index.html', 'id="bottomNav" aria-label="Мобільні розділи складу"', 'sklad bottom nav exposes navigation label'],
  ['sklad/index.html', 'class="ni active" data-page="items" aria-current="page"', 'sklad sidebar active page exposes aria-current'],
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


// Material Symbols are ligature text until the webfont arrives. Keep those
// internal names hidden during startup and reveal icons only after font load.
{
  const label = 'Material Symbols ligatures stay hidden until the icon font loads';
  const entrypoints = ['index.html', 'osbb/index.html', 'sklad/index.html'];
  const sharedCss = readFileSync('shared/ui.css', 'utf8');
  const loader = readFileSync('shared/material-symbols-ready.js', 'utf8');
  const copyScript = readFileSync('scripts/copy-static-assets.mjs', 'utf8');
  const missing = entrypoints.filter(file => !readFileSync(file, 'utf8').includes('/Osbb/shared/material-symbols-ready.js'));
  const valid = sharedCss.includes('.material-symbols-rounded { visibility: hidden; }') &&
    sharedCss.includes('.material-symbols-ready .material-symbols-rounded { visibility: visible; }') &&
    loader.includes('document.fonts') && loader.includes("classList.add('material-symbols-ready')") &&
    copyScript.includes("'shared/material-symbols-ready.js'");
  if (missing.length || !valid) {
    failed += 1;
    console.error(`not ok - ${label} (entrypoints: ${missing.join(', ')}; loader: ${valid})`);
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
    '--md-sys-color-secondary-container',
    '--md-sys-color-tertiary-container',
    '--md-sys-color-error-container',
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
    ['osbb/index.html', 'class="journal-action-btn journal-action-btn-danger md-state-layer"'],
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
    'data-month-step="-1" data-tip="Попередній місяць" aria-label="Попередній місяць" class="journal-icon-btn md-state-layer',
    'data-month-step="1" data-tip="Наступний місяць" aria-label="Наступний місяць" class="journal-icon-btn md-state-layer',
    'data-action="go-today" id="btn-today" class="journal-tonal-btn md-state-layer',
    'data-action="refresh-data" data-tip="Оновити дані" aria-label="Оновити дані" class="journal-icon-btn md-state-layer',
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
    "frame.contentDocument?.getElementById('app-lock-screen')",
    "frame.contentWindow?.postMessage({ type: 'osbb:shell-unlocked' }",
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

// Вбудовані модулі покладаються на PIN shell-оболонки, а при прямому відкритті
// й далі самостійно перевіряють TTL. Це запобігає повторному PIN після idle-lock.
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
    'function isEmbeddedShellFrame',
    "window.parent.document.getElementById('shell-main')",
    "|| (sessionStorage.getItem('auth') === 'ok' && earlyAuthFresh)",
    '|| isAuthSessionValid())',
    "'osbb:shell-unlocked'",
  ];
  const forbidden = [
    'function setAuthSession() {\n        setAuthSession();',
    'function setAuthSession(){\n  setAuthSession();',
    "if (sessionStorage.getItem('auth') === 'ok') {\n        const lockScreen",
    "if(sessionStorage.getItem('auth')==='ok')",
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
    'data-osbb-tab="dispatcher"',
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

// OSBB lightbox, month reset and photo container actions should use
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
    'onclick="openLightbox',
    'onclick="deletePhoto',
  ];
  const required = [
    'data-lightbox-backdrop',
    'data-lightbox-action="prev"',
    'data-action="garbage-clear-month"',
    'data-action="dispatcher-clear-month"',
    'data-photo-action="open"',
    'data-photo-action="delete"',
    'function bindOsbbPhotoActions',
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
    'data-disp-action="ticket-add"',
    'data-journal-action="photo-upload-mobile" data-day="${d}" data-role="dispatcher"',
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
    "${escapeHtml(t.text)}",
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
    'value="${escapeAttr(row.time||\'\')}" data-g-action="row-update"',
    'value="${escapeAttr(String(val))}"',
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
    'z-index:60;min-width:208px;max-height:min(62dvh,360px);overflow-y:auto;',
    "if(menu.classList.contains('topbar-more'))",
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
    '.topbar{padding:0 8px;height:56px;border-radius:0 0 var(--md-sys-shape-corner-large,16px) var(--md-sys-shape-corner-large,16px);gap:6px;}',
    '.topbar h2{font-size:15px;flex:1;min-width:0;max-width:none!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.topbar .btn:not(.topbar-right-excel){display:inline-flex!important;align-items:center!important;justify-content:center!important;width:48px!important;min-width:48px!important;height:48px!important;min-height:48px!important;padding:0!important;line-height:1!important;}',
    '.topbar .btn:not(.topbar-right-excel) .ms{display:inline-grid!important;place-items:center!important;width:1em!important;height:1em!important;font-size:21px!important;line-height:1!important;margin:0!important;}',
    '.topbar-more summary{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:48px;height:48px;min-height:48px;padding:0;line-height:1!important;}',
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
    'class="g4 items-metrics insight-grid inventory-summary"',
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
    '.items-filter-pill{position:relative;display:inline-grid;',
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
    '.price-badge-btn{padding:6px 12px;',
    '.price-badge-btn.has-price{display:flex;',
    '.price-badge-value{font-weight:700;',
    '.price-badge-source{width:100%;font-size:10px;',
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
    '.table-name-cell{font-weight:500;',
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
    '.log-qty-out{font-weight:700;color:var(--md-sys-color-secondary,#6366f1);}',
    '.log-qty-in{font-weight:700;color:var(--sklad-green);}',
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

// Garbage yearly chart bars should use a class-based gradient with only the
// per-bar height left inline, instead of a full inline gradient ternary.
{
  const text = readOsbbCombined();
  const label = 'osbb garbage chart bars use class-based gradient';
  const required = [
    '.g-chart-bar { width:100%; border-radius:var(--md-sys-shape-corner-small,8px) var(--md-sys-shape-corner-small,8px) 0 0; background:linear-gradient(var(--md-sys-color-primary,#22c55e),color-mix(in srgb,var(--md-sys-color-primary,#22c55e) 82%,#000)); }',
    '.g-chart-bar.is-current { background:linear-gradient(var(--md-sys-color-tertiary,#fbbf24),color-mix(in srgb,var(--md-sys-color-tertiary,#f59e0b) 82%,#000)); }',
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

// The PIN-modal icon circles should use class-based markup instead of repeated inline style strings.
{
  const text = readOsbbCombined();
  const label = 'osbb PIN-modal icons use class-based markup';
  const required = [
    '.pin-modal-icon-wrap { display:inline-flex; width:40px; height:40px; border-radius:var(--md-sys-shape-corner-full,999px); align-items:center; justify-content:center; }',
    '.pin-modal-icon-wrap.is-indigo { background:var(--md-sys-color-secondary-container); color:var(--md-sys-color-on-secondary-container); }',
    '.pin-modal-icon-wrap.is-red { background:var(--md-sys-color-error-container); color:var(--md-sys-color-on-error-container); }',
    '.pin-modal-icon-wrap.is-green { background:var(--md-sys-color-primary-container); color:var(--md-sys-color-on-primary-container); }',
    '.pin-modal-icon-wrap.is-green-soft { background:var(--md-sys-color-primary-container); color:var(--md-sys-color-on-primary-container); }',
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
    "cell.className = 'month-grid-cell' + (isWeekend ? ' is-weekend' : '') + (isToday ? ' is-today' : '') + (hasEvent ? ' has-shifts' : '');",
    "cell.setAttribute('aria-haspopup', 'dialog');",
    'function gOpenDayDetail(day) {',
    'function dispOpenDayDetail(d) {',
    "function refreshOpenDayDetail(context, day) {",
    '.month-grid-cell { min-height:82px;',
    '.month-grid-cell { align-items:center; min-height:62px;',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const usesSquareCells = text.includes('.month-grid-cell { aspect-ratio: 1;');
  if (missing.length || usesSquareCells) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; square cells: ${usesSquareCells})`);
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
    '.stats-panel{padding:18px 22px;',
    '.stats-filter-grid{display:grid;',
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
    '.journal-metric-value {',
    '.journal-metric-label {',
    'class="journal-metric-value" id="g-total-month"',
    'Баків без пластику/скла',
    '.skel-w-date { width: 70px; }',
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
    'class="stat-card journal-stat-card journal-mini-stat role-garbage',
    '.journal-panel {',
    '.journal-table-shell {',
    '.garbage-chart-panel { padding:16px;',
    '.journal-list-shell { overflow:hidden; border-radius:var(--md-sys-shape-corner-extra-large,28px)!important; padding:0!important; }',
    '.journal-list-head { padding:16px 22px;',
    '.journal-status-chip {',
    '.journal-icon-btn {',
    '.journal-tonal-btn {',
    '.journal-select {',
    'class="journal-status-chip"',
    'class="journal-select"',
    '.journal-event-sheet {',
    '.journal-textarea {',
    '.journal-photo-action {',
    'class="journal-event-sheet role-dispatcher"',
    'class="journal-photo-action md-state-layer"',
    'class="journal-photo-action is-secondary md-state-layer"',
    '.garbage-chart { height:80px; }',
    'class="journal-panel garbage-chart-panel"',
    'class="journal-panel journal-list-shell"',
    'class="garbage-chart flex items-end justify-between gap-1"',
    'class="journal-panel"',
    '.journal-title-row {',
    '.journal-action-row {',
    '.journal-tabs-row {',
    'class="tab-btn md-state-layer active"',
    'class="journal-bottom-nav no-print"',
    'class="mob-tab md-state-layer mob-active"',
    '.journal-tabs { display:flex;',
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
    'id="journalThemeIcon" class="journal-theme-icon" aria-hidden="true"><span class="material-symbols-rounded" aria-hidden="true">contrast</span>',
    '</span><span id="journalThemeLabel" class="sr-only">Світла</span>',
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
    'class="journal-action-btn journal-action-btn-danger md-state-layer"',
    'class="material-symbols-rounded journal-inline-icon"',
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
    'aria-label="Час вивозу сміття за день ${day}"',
    'aria-label="Працівник сміття за день ${day}"',
    'aria-label="Кількість баків за день ${day}"',
    'aria-label="Текст нової заявки"',
    'aria-label="Додати фото диспетчера за день ${d}"',
    'aria-label="Додати фото диспетчера з галереї за день ${d}"',
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

// Placeholder-only search fields need stable accessible names.
{
  const sklad = readFileSync('sklad/index.html', 'utf8');
  const label = 'search fields expose aria-labels';
  const required = [
    [sklad, 'id="searchInp" aria-label="Пошук складських найменувань"'],
    [sklad, 'id="logSearch" aria-label="Пошук у журналі видач"'],
    [sklad, 'id="auditSearch" aria-label="Пошук товару для інвентаризації"'],
    [sklad, 'id="recSearch" aria-label="Пошук у приходах"'],
    [sklad, 'id="manualBarcodeI" class="inp" aria-label="Ввести штрих-код вручну"'],
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
    'data-page="items" aria-current="page" aria-label="Запаси"',
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
    'id="st-available"',
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


// Item overflow menus must stay inside the usable viewport. This guards the
// fixed positioning and scrollable-height calculation near every screen edge.
{
  const text = readSkladCombined();
  const label = 'sklad item menus account for mobile viewport boundaries';
  const required = [
    "const bottomNav=document.querySelector('.bottom-nav')",
    "getComputedStyle(bottomNav).display!=='none'",
    'bottomNav.getBoundingClientRect().top',
    'const spaceAbove=Math.max(0,summaryRect.top-topBoundary-8)',
    'const spaceBelow=Math.max(0,bottomBoundary-summaryRect.bottom-8)',
    "panel.classList.add('is-viewport-positioned')",
    "panel.style.maxHeight=visibleHeight+'px'",
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

// Мобільний Pull-to-Refresh має використовувати наявний безпечний refreshAll,
// запускатися лише з верхньої межі сторінки та не конфліктувати з модалами.
{
  const text = readSkladCombined();
  const label = 'sklad mobile view exposes accessible pull-to-refresh';
  const required = [
    'id="pullRefresh" class="pull-refresh" role="status" aria-live="polite"',
    'function initPullToRefresh()',
    "window.scrollY>0 || refreshBusy",
    "document.querySelector('.modal-bg.open,.lightbox.open')",
    "document.addEventListener('touchmove',event=>",
    "const success=await refreshAll()",
    'initPullToRefresh();',
    '.pull-refresh.is-refreshing .pull-refresh-glyph{animation:pull-refresh-spin .75s linear infinite;}',
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
    '.item-more-menu.is-viewport-positioned{position:fixed;right:auto;bottom:auto;}',
    "panel.style.maxHeight=visibleHeight+'px';",
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

// Inventory cards are an alternative mobile representation of the desktop
// table and must never render alongside it on a wide viewport.
{
  const css = readFileSync('sklad/styles.css', 'utf8');
  const label = 'sklad inventory cards stay hidden on desktop and appear on mobile';
  const desktopRule = '.mobile-cards{display:none;}';
  const mobileRule = '.mobile-cards{display:block!important;}';
  const mobileSectionIndex = css.indexOf('/* ===MOBILE === */');
  const desktopIndex = css.indexOf(desktopRule);
  const mobileMediaIndex = css.indexOf('@media(max-width:768px)', mobileSectionIndex);
  const mobileIndex = css.indexOf(mobileRule, mobileMediaIndex);
  if (mobileSectionIndex < 0 || desktopIndex < mobileSectionIndex || mobileMediaIndex < 0 || mobileIndex < mobileMediaIndex || desktopIndex > mobileMediaIndex) {
    failed += 1;
    console.error(`not ok - ${label}`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Existing inventory items expose the same safe metadata editor from both
// desktop and mobile menus without changing stock or movement history.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const label = 'sklad inventory items can edit validated metadata';
  const required = [
    'id="editItemModal" data-modal-backdrop="editItemModal"',
    'data-item-action="edit" data-item-id="${id}"',
    "case 'edit': openEditItem(id); break;",
    "async function confirmEditItem(button)",
    ".update({name,category,unit}).eq('id',item.id)",
    "normalizeSearchText(candidate.name)===normalizeSearchText(name)",
    "'edit-item-confirm':(button)=>confirmEditItem(button)",
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

// Purchase prices can be captured when creating or receiving stock and remain
// visible/editable on the receipt that established the current item price.
{
  const text = readSkladCombined();
  const migration = readFileSync('sklad/supabase/009_add_receipt_purchase_price.sql', 'utf8');
  const types = readFileSync('src/database.types.ts', 'utf8');
  const label = 'sklad captures purchase prices for new items and receipts';
  const required = [
    'id="newPrice" min="0.01" step="0.01"',
    'id="refillPriceI" min="0.01" step="0.01"',
    'id="editReceiptPrice" min="0.01" step="0.01"',
    'p_price_unit:purchasePrice',
    'purchase_price_unit:purchasePrice',
    '<th>Ціна закупівлі</th>',
    'money(hasReceiptPrice?r.purchase_price_unit:item?.price_unit)',
    'hasReceiptPrice?r.purchase_price_unit:item?.price_unit',
    'class="price-origin-note">поточна</span>',
    "r.purchase_price_unit||item?.price_unit||''",
    'function isPurchasePriceSchemaError(error)',
    "showPurchasePriceMigrationNotice()",
    "console.info('Історія закупівельних цін стане доступною після міграції 009.')",
    "delete receiptRow.purchase_price_unit",
    'data-supplier-preset="Епіцентр" data-supplier-target="refillSupplierI"',
    'data-supplier-preset="Епіцентр" data-supplier-target="editReceiptSupplier"',
    'function setSupplierPreset(button)',
    'function addCustomSupplierTag()',
    'function renderCustomSupplierTags()',
    "const SUPPLIER_TAGS_STORAGE_KEY='sklad_supplier_tags_v1'",
    'data-sklad-action="supplier-tag-add"',
    '.insight-grid .stat-card::before{display:none;}',
    'id="newItemSupplier"',
    'id="supplierTagDeleteModal"',
    'function requestRemoveCustomSupplierTag(tag)',
    "db.from('inventory_supplier_tags').select('name')",
    "table:'inventory_supplier_tags'",
  ];
  const missing = required.filter(needle => !text.includes(needle));
  if (!migration.includes('add column if not exists purchase_price_unit numeric(12,2)') ||
      !migration.includes('p_price_unit numeric default null') ||
      !migration.includes("notify pgrst, 'reload schema'") ||
      !types.includes('purchase_price_unit: number | null;') || missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Користувацькі постачальники синхронізуються через Supabase, а картки
// журналу використовують тональні поверхні без декоративних верхніх смуг.
{
  const supplierMigration = readFileSync('sklad/supabase/010_add_supplier_tags.sql', 'utf8');
  const journalCss = readFileSync('osbb/styles.css', 'utf8');
  const label = 'supplier tags sync across devices and journal cards have no color strips';
  const required = [
    'create table if not exists inventory_supplier_tags',
    "alter publication supabase_realtime add table inventory_supplier_tags",
    '.journal-stat-card { --role-accent:var(--accent);',
    'background:var(--md-sys-color-surface-container-low,var(--surface-1))!important;',
  ];
  const combined = supplierMigration + '\n' + journalCss;
  const missing = required.filter(needle => !combined.includes(needle));
  const hasOldStrip = /\.journal-stat-card\.role-[^{]+\{[^}]*border-top:\s*3px/.test(journalCss);
  if (missing.length || hasOldStrip) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; old strip: ${hasOldStrip})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Основні порожні списки використовують єдиний M3 empty state, а назви та
// підказки проходять escapeHtml перед вставкою в DOM.
{
  const text = readFileSync('sklad/index.html', 'utf8');
  const label = 'sklad list empty states use safe Material 3 structure';
  const required = [
    "const emptyStateIcons=new Set(['inbox','search_off','inventory_2','history'])",
    'function emptyState(icon,title,supportingText=',
    'class="empty md-empty-state"',
    'class="ms md-empty-state-icon"',
    'class="md-empty-state-title"',
    'escapeHtml(supportingText)',
    "emptyState('history','Видач ще не було'",
    "emptyState('inbox','Приходів ще не було'",
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

// Повторні завантаження приходів та історії використовують M3 skeleton loaders.
{
  const text = readSkladCombined();
  const label = 'sklad async views use reusable Material 3 skeleton loaders';
  const required = [
    'function skeletonRows(columns=1,rows=3)',
    'function skeletonStack(rows=3)',
    'tb.innerHTML=skeletonRows(7,3)',
    'mb.innerHTML=skeletonStack(3)',
    "document.getElementById('histList').innerHTML=skeletonStack(3)",
    '.skeleton-card{display:grid;',
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

// Складські filter chips мають M3 selected-check, центрований label і
// aria-pressed; навігація місяців використовує центровані Material Symbols.
{
  const sklad = readSkladCombined();
  const journal = readFileSync('osbb/index.html', 'utf8');
  const label = 'filter chips and month arrows use centered Material 3 controls';
  const required = [
    'function setFilterPillState(button,active)',
    "button.setAttribute('aria-pressed',String(active))",
    'class="ms items-filter-icon" aria-hidden="true">check</span><span class="items-filter-label"',
    '.items-filter-pill{position:relative;display:inline-grid;place-items:center;height:48px;',
    '.items-filter-pill.active .items-filter-icon{opacity:1;',
    'class="material-symbols-rounded" aria-hidden="true">chevron_left</span>',
    'class="material-symbols-rounded" aria-hidden="true">chevron_right</span>',
  ];
  const combined = sklad + '\n' + journal;
  const missing = required.filter(needle => !combined.includes(needle));
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Навігаційні поверхні Складу використовують M3 containers, а активна
// мобільна іконка — стандартний 56px tonal indicator.
{
  const text = readFileSync('sklad/styles.css', 'utf8');
  const label = 'sklad navigation uses Material 3 tonal containers';
  const required = [
    '.sidebar{width:var(--sb);background:var(--md-sys-color-surface-container-low',
    '.topbar{background:var(--md-sys-color-surface-container-low',
    '/* === Material 3 navigation bar === */',
    'background:var(--md-sys-color-surface-container-high',
    '.bn-item.active{color:var(--md-sys-color-on-secondary-container',
    '.bn-item.active .bn-icon-wrap{width:56px;background:var(--md-sys-color-secondary-container',
    'box-shadow:var(--md-sys-elevation-level2)',
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

// На desktop-пристроях navigation rail розгортається разом із відступом основного
// контенту, тому slide-out не накладається на робочу область.
{
  const text = readFileSync('sklad/styles.css', 'utf8');
  const label = 'sklad desktop sidebar expands without covering content';
  const required = [
    '@media(min-width:769px) and (hover:hover)',
    '.sidebar:is(:hover,:focus-within){width:var(--sb);}',
    '.sidebar:is(:hover,:focus-within) + .main{margin-left:var(--sb);}',
    '.sidebar:is(:hover,:focus-within) .nav-label,',
    'transition:margin-left var(--md-sys-motion-duration-medium2',
    '.sidebar .ni-badge{position:absolute;top:5px;right:3px;min-width:22px;max-width:30px;',
    '.sidebar:is(:hover,:focus-within) .ni-badge{position:static;min-width:0;max-width:none;',
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

// Графік змін працює як нативна M3-вкладка Журналу на спільному Supabase.
{
  const html = readFileSync('osbb/index.html', 'utf8');
  const css = readFileSync('osbb/styles.css', 'utf8');
  const migration = readFileSync('sklad/supabase/011_add_work_shifts.sql', 'utf8');
  const fixMigration = readFileSync('sklad/supabase/012_fix_work_shifts_month_key.sql', 'utf8');
  const securityMigration = readFileSync('sklad/supabase/013_secure_work_shifts.sql', 'utf8');
  const readme = readFileSync('README.md', 'utf8');
  const databaseTypes = readFileSync('src/database.types.ts', 'utf8');
  const label = 'journal integrates smena schedule with Material 3 and Supabase';
  const required = [
    'data-osbb-tab="shifts" id="tab-shifts"',
    'data-osbb-tab="shifts" id="tab-shifts-m"',
    'id="section-shifts"',
    'function shiftLoadMonth()',
    'function requestTab(tab)',
    "showPinModal('PIN графіка змін', 'Введіть окремий PIN для доступу'",
    "function shiftAppendIndicators(container, person, values)",
    "marker.className = `shift-dot is-${person} is-half`",
    '.shift-dot.is-half {',
    "db.from('work_shifts').select('*').eq('month_key', shiftMonthKey())",
    "db.rpc('save_work_shift_day'",
    "db.rpc('update_work_shift_names'",
    "'verify_work_shifts_pin'",
    "db.rpc('reset_work_shifts_month'",
    "table: 'work_shifts'",
    "addEventListener('keydown', shiftTrapEditorFocus)",
    "details.includes('23514')",
    '.shift-shell { display:grid;',
    '.shift-editor-overlay.is-open { display:flex; }',
    '.hidden { display:none!important; }',
  ];
  const combined = html + '\n' + css;
  const missing = required.filter(needle => !combined.includes(needle));
  const directWritesClosed = !html.includes("db.from('work_shifts').upsert") && !html.includes("db.from('work_shifts').delete");
  const migrationReady = migration.includes('create table if not exists work_shifts')
    && migration.includes("month_key ~ '^[0-9]{4}-[0-9]{2}$'")
    && migration.includes('create or replace function reset_work_shifts_month')
    && fixMigration.includes('drop constraint if exists work_shifts_month_key_check')
    && fixMigration.includes("month_key ~ '^[0-9]{4}-[0-9]{2}$'")
    && securityMigration.includes('create table if not exists work_shift_auth')
    && securityMigration.includes('create or replace function verify_work_shifts_pin')
    && securityMigration.includes('create or replace function save_work_shift_day')
    && securityMigration.includes('create or replace function update_work_shift_names')
    && securityMigration.includes('drop policy if exists "work shifts insert"')
    && securityMigration.includes('if not verify_work_shifts_pin(attempt) then return false; end if;');
  const docsReady = readme.includes('011_add_work_shifts.sql') && readme.includes('012_fix_work_shifts_month_key.sql') && readme.includes('013_secure_work_shifts.sql');
  const typesReady = databaseTypes.includes('work_shifts: RowOperation') && databaseTypes.includes('reset_work_shifts_month:') && databaseTypes.includes('save_work_shift_day:');
  if (missing.length || !migrationReady || !directWritesClosed || !docsReady || !typesReady) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; migration: ${migrationReady}; direct writes closed: ${directWritesClosed}; docs: ${docsReady}; types: ${typesReady})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Поля та кастомні select-и Складу дотримуються M3 outlined/tonal розмірів:
// 56px field, 48px option і secondary-container для вибраного значення.
{
  const text = readFileSync('sklad/styles.css', 'utf8');
  const label = 'sklad fields and selects use Material 3 sizing and states';
  const required = [
    '.inp{width:100%;border:1px solid var(--md-sys-color-outline',
    'min-height:56px;font-size:16px;',
    '.inp:focus{border:2px solid var(--md-sys-color-primary',
    'background:var(--md-sys-color-surface-container-highest',
    '.custom-select-panel{position:absolute;',
    'background:var(--md-sys-color-surface-container-high',
    '.custom-select-option{display:flex;align-items:center;min-height:48px;',
    '.custom-select-option.active{background:var(--md-sys-color-secondary-container',
    '.inp { min-height: 56px !important; }',
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

// Темна тема додає контрольовану «живу» глибину лише інтерактивним карткам
// і кнопкам; hover-lift не запускається на сенсорних екранах.
{
  const journalCss = readFileSync('osbb/styles.css', 'utf8');
  const skladCss = readFileSync('sklad/styles.css', 'utf8');
  const label = 'dark theme uses restrained ambient glow and hover lift';
  const required = [
    [journalCss, '.theme-dark :is(.journal-stat-card,.ticket-item,.my-ticket-card,.shift-stat-card,.att-stat-card)'],
    [journalCss, '@media (hover:hover) and (pointer:fine)'],
    [journalCss, 'transform:translateY(-3px);'],
    [journalCss, '.theme-dark .mob-tab.mob-active .material-symbols-rounded'],
    [skladCss, '.theme-dark :is(.m-card,.stat-card)'],
    [skladCss, '.theme-dark :is(.btn-primary,.btn-ghost,.ni,.bottom-nav button)'],
    [skladCss, '.theme-dark .bottom-nav button.active'],
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

// Диспетчер може повторно відкрити помилково закриту заявку, очистивши
// застарілі ознаки виконання та синхронізувавши зміну звичайним save-потоком.
{
  const text = readFileSync('osbb/index.html', 'utf8');
  const label = 'dispatcher can reopen an accidentally closed ticket';
  const required = [
    'function dispReopenTicket(d, ticketId)',
    "if (!isDispatcherSession()) { showToast('Відкрити заявку повторно може лише Диспетчер/Адмін'); return; }",
    "ticket.status = 'open';",
    'delete ticket.closedAt;',
    'delete ticket.closedBy;',
    'data-disp-action="ticket-reopen"',
    "if (action.dataset.dispAction === 'ticket-reopen')",
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

// Списки Журналу прокручуються без нативної смуги, яка у мобільних WebView
// виходить за округлений край панелі та залишає видимий «хвостик» зверху.
{
  const text = readFileSync('osbb/styles.css', 'utf8');
  const label = 'journal custom select hides the overflowing native scrollbar';
  const required = [
    'overscroll-behavior:contain; scrollbar-width:none; -ms-overflow-style:none;',
    '.custom-select-panel::-webkit-scrollbar { display:none; width:0; height:0; }',
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

// PIN-підтвердження журналу використовує M3 dialog на desktop і modal bottom
// sheet на mobile; індикатор PIN керується класом, а не hardcoded кольором JS.
{
  const text = readOsbbCombined();
  const label = 'journal PIN confirmation uses Material 3 dialog and bottom sheet';
  const required = [
    '.pin-modal-dialog { background:var(--md-sys-color-surface-container-high',
    '.pin-modal-dialog .pin-mb-btn { background:var(--md-sys-color-surface-container-highest',
    '.pin-modal-dialog .pin-dot.is-entered { background:var(--md-sys-color-primary',
    '.pin-modal-overlay { align-items:flex-end; }',
    '.pin-modal-dialog::before { content:',
    "dot.classList.toggle('is-entered', i < pinModalBuf.length)",
    'data-pin-modal-delete',
    'stroke="currentColor"',
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

// Поля журналу та спільний custom select використовують ті самі M3 field
// tokens, що й Склад: 56px, outlined focus і tonal selected option.
{
  const text = readFileSync('osbb/styles.css', 'utf8');
  const label = 'journal fields and selects use Material 3 sizing and states';
  const required = [
    '.journal-select { min-height:56px;',
    'background-color:var(--md-sys-color-surface-container-highest',
    '.journal-select:focus { border:2px solid var(--md-sys-color-primary',
    '.journal-textarea { width:100%; min-height:128px; padding:16px;',
    '.custom-select-option { display:flex; align-items:center; min-height:48px;',
    '.custom-select-option.active { background:var(--md-sys-color-secondary-container);',
    'box-shadow:var(--md-sys-elevation-level2); padding:8px; max-height:320px;',
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

// Toast Складу відповідає M3 snackbar: inverse surface, 48px, semantic icon
// colors і мобільне розміщення над navigation bar; modal scrim без blur.
{
  const text = readFileSync('sklad/styles.css', 'utf8');
  const label = 'sklad feedback uses Material 3 snackbar and scrim';
  const required = [
    '#toast{position:fixed;bottom:24px;right:24px;display:flex;align-items:center;',
    'min-height:48px;',
    'background:var(--md-sys-color-inverse-surface',
    '#toast.success .ms{color:var(--md-sys-color-primary-fixed-dim',
    '#toast.error .ms{color:var(--md-sys-color-error',
    '#toast.info .ms{color:var(--md-sys-color-secondary',
    '#toast{left:12px;right:12px;bottom:calc(100px + env(safe-area-inset-bottom))',
    '.modal-bg{position:fixed;inset:0;background:color-mix(in srgb,var(--md-sys-color-scrim',
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

// Головний екран показує корисний для ОСББ підсумок запасів, а не магазинні
// лічильники дефіциту та дубльовані червоні badges у навігації.
{
  const text = readSkladCombined();
  const label = 'sklad inventory summary prioritizes availability quantity and value';
  const required = [
    'class="g4 items-metrics insight-grid inventory-summary"',
    'id="st-available"',
    'Найменувань у наявності',
    'id="st-units"',
    'Одиниць на складі',
    'id="st-value"',
    'Орієнтовна вартість',
    "const available=allItems.filter(item=>Number(item.quantity)>0).length",
    "const units=allItems.reduce((sum,item)=>sum+Math.max(0,Number(item.quantity)||0),0)",
    "const value=allItems.reduce((sum,item)=>sum+Math.max(0,Number(item.quantity)||0)*priceValue(item),0)",
    '.items-metrics.g4.inventory-summary{grid-template-columns:repeat(3,minmax(0,1fr));}',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const hasLegacyCounters = ['id="st-zero"','id="st-low"','id="st-ok"','id="sb-alert"','id="bn-alert"','id="alertBanner"'].some(needle=>text.includes(needle));
  if (missing.length || hasLegacyCounters) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; legacy counters: ${hasLegacyCounters})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Підсумкові метрики є семантичними статичними картками, а не фальшивими
// кнопками-фільтрами: вони лише повідомляють агреговані дані.
{
  const text = readSkladCombined();
  const label = 'sklad summary metrics use non-interactive Material 3 cards';
  const required = [
    '<article class="stat-card summary-card sc-green">',
    '<article class="stat-card summary-card sc-purple">',
    '<article class="stat-card summary-card sc-orange">',
    '.inventory-summary .summary-card{min-height:132px;cursor:default;',
    '.stat-icon{position:absolute;right:14px;top:14px;z-index:1;',
    '.stat-icon .ms{font-size:22px;}',
    '.sw .inp{padding-left:42px!important;}',
    '.items-search-field > #searchInp{box-sizing:border-box;padding-inline-start:46px!important;}',
    '.si.ms{font-size:18px;}',
    'href="styles.css?v=20260727-search-icons"',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const hasInteractiveSummary = /<(button)[^>]*class="[^"]*summary-card/.test(text);
  if (missing.length || hasInteractiveSummary) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; interactive summary: ${hasInteractiveSummary})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Category filter chips мають group semantics, 48px touch target та
// синхронний aria-pressed у виборі й reset flow.
{
  const text = readSkladCombined();
  const label = 'sklad category filters use accessible Material 3 chips';
  const required = [
    'id="catPills" role="group" aria-label="Фільтр за категорією"',
    'data-category-filter="" aria-pressed="true"',
    'data-category-filter="Прибирання" aria-pressed="false"',
    "b.setAttribute('aria-pressed',String(active))",
    '.pill{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:48px;',
    '.pill:hover{background:var(--md-sys-color-surface-container-high',
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

// Button content не повинен використовувати прихований filter-check icon:
// він залишав нульовий flex-item із gap і оптично зсував label від центру.
{
  const html = readFileSync('sklad/index.html', 'utf8');
  const css = readFileSync('sklad/styles.css', 'utf8');
  const label = 'sklad button labels and icons stay geometrically centered';
  const required = [
    'class="btn btn-primary btn-sm items-hero-action"',
    'class="ms hero-action-icon" aria-hidden="true">output</span><span class="btn-label">Видати</span>',
    'class="ms hero-action-icon" aria-hidden="true">add_circle</span><span class="btn-label">Поповнити</span>',
    '.items-hero-action{position:relative;display:inline-grid;place-items:center;min-width:116px;',
    '.hero-action-icon{position:absolute;left:14px;top:50%;width:18px;height:18px;',
    'line-height:1.2;text-align:center;vertical-align:middle;',
    '.btn .ms{align-self:center;margin:0;line-height:1;}',
    '.btn-label{display:inline-flex;align-items:center;justify-content:center;',
    '.btn.items-hero-action{display:inline-grid;place-items:center;min-width:116px;padding-inline:38px;}',
    '.items-filter-icon{position:absolute;left:14px;top:50%;',
    '.items-filter-label{display:grid;place-items:center;width:100%;height:100%;',
    '.pill.items-filter-pill{display:inline-grid;place-items:center;padding:0 32px;}',
    '.pill.items-filter-pill .items-filter-icon{position:absolute;}',
    '.btn.items-hero-action .hero-action-icon{position:absolute;}',
  ];
  const combined = html + '\n' + css;
  const missing = required.filter(needle => !combined.includes(needle));
  const hiddenFilterIconInButton = /class="[^"]*\bbtn\b[^"]*"[^>]*>[\s\S]{0,160}class="[^"]*items-filter-icon/.test(html);
  if (missing.length || hiddenFilterIconInButton) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; hidden filter icon: ${hiddenFilterIconInButton})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Табель має desktop-календар із сімома колонками, а на вузьких екранах
// перемикається на вертикальні day cards без горизонтального свайпу.
{
  const html = readFileSync('osbb/index.html', 'utf8');
  const css = readFileSync('osbb/styles.css', 'utf8');
  const label = 'attendance uses a responsive Material 3 calendar';
  const required = [
    'id="att-calendar" class="att-calendar"',
    'class="att-calendar-weekdays"',
    'calendar.innerHTML = calendarHtml;',
    '#att-calendar [data-att-day]',
    "'att-body', 'att-calendar', 'att-mobile-list'",
    'const isToday = d === todayDay && currentMonth === todayMonth && currentYear === todayYear;',
    "${isToday ? 'is-today' : ''}",
    'aria-current="date"',
    'class="att-stat-value">${totals[role].days}',
    'змін відпрацьовано',
    '.att-calendar-weekdays,.att-calendar { display:grid; grid-template-columns:repeat(7',
    '.month-grid-cell.is-today,.shift-day.is-today {',
    'border-width:1px;',
    'box-shadow:0 0 0 3px color-mix(in srgb,var(--md-sys-color-primary,var(--accent)) 14%,transparent)',
    '.month-grid-cell.is-today .month-grid-day,.shift-day.is-today .shift-day-number {',
    'background:transparent; color:inherit;',
    '.att-calendar-day.is-today,.att-mobile-day.is-today {',
    '.att-calendar-day.is-today > header strong,.att-mobile-day.is-today > header strong { background:transparent;',
    "function attDayState(d, visibleRoles = attVisibleRoles())",
    "function attCellState(cell)",
    "if (populated === 0) return 'is-empty-day';",
    "return completed === cells.length ? 'is-filled-day' : 'is-partial-day';",
    'data-att-day-card="${d}"',
    'data-att-cell="${d}-${role}"',
    '.att-calendar-day.is-partial-day,.att-mobile-day.is-partial-day {',
    '.att-calendar-day.is-filled-day,.att-mobile-day.is-filled-day {',
    '.att-calendar-role.is-complete-cell,.att-mobile-role.is-complete-cell,.att-table td.is-complete-cell {',
    '.is-complete-cell .att-time-input {',
    '.is-partial-cell .att-time-input:not(:placeholder-shown) {',
    '@media (max-width:900px) {',
    '.att-calendar-scroll { display:none; }',
    '.att-mobile-list { display:flex;',
  ];
  const combined = html + '\n' + css;
  const missing = required.filter(needle => !combined.includes(needle));
  const hasSolidTodayCircle = combined.includes('is-today > header strong { background:var(--md-sys-color-primary)')
    || combined.includes('is-today .shift-day-number { display:grid; place-items:center; min-width:32px;');
  if (missing.length || hasSolidTodayCircle) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; solid today circle: ${hasSolidTodayCircle})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Множинний вибір типів сміття використовує M3 checkbox, а не круглий radio
// indicator, який помилково натякав на вибір лише одного типу.
{
  const css = readFileSync('osbb/styles.css', 'utf8');
  const label = 'garbage multi-select uses a Material 3 checkbox indicator';
  const required = [
    '.garbage-type-indicator { display:grid; place-items:center; width:20px; height:20px;',
    'border-radius:var(--md-sys-shape-corner-extra-small,4px);',
    '.garbage-type-indicator .material-symbols-rounded { font-size:16px;',
  ];
  const missing = required.filter(needle => !css.includes(needle));
  const circularIndicator = /\.garbage-type-indicator\s*\{[^}]*shape-corner-full/.test(css);
  if (missing.length || circularIndicator) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; circular: ${circularIndicator})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Усі outlined-поля журналу використовують узгоджену M3 medium shape замість
// майже квадратної extra-small shape.
{
  const css = readFileSync('osbb/styles.css', 'utf8');
  const label = 'journal outlined fields use the rounded Material 3 medium shape';
  const expected = 'border-radius:var(--md-sys-shape-corner-medium,12px);';
  const globalFieldStart = css.indexOf("input:not([type='checkbox']):not([type='radio']),select,textarea {");
  const globalFieldEnd = css.indexOf('}', globalFieldStart);
  const globalFieldRule = globalFieldStart >= 0 ? css.slice(globalFieldStart, globalFieldEnd + 1) : '';
  if (!globalFieldRule.includes(expected) || globalFieldRule.includes('shape-corner-extra-small')) {
    failed += 1;
    console.error(`not ok - ${label} (global field shape is not medium)`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Поле опису в блоці ліфтера не повинно успадковувати global text-field
// shape поверх локального M3 large shape.
{
  const css = readFileSync('osbb/styles.css', 'utf8');
  const label = 'elevator description field keeps its rounded Material 3 shape';
  const expected = '.elevator-add-form .dispatcher-location-input { border-radius:var(--md-sys-shape-corner-large,16px)!important; }';
  if (!css.includes(expected)) {
    failed += 1;
    console.error(`not ok - ${label} (missing rounded field override)`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Search bar uses one rounded focus container, not a second rectangular
// outlined input inside it.
{
  const css = readFileSync('osbb/styles.css', 'utf8');
  const label = 'journal search bars keep a single Material 3 focus outline';
  const required = [
    '.dispatcher-search-input {',
    'border:0!important;',
    '.dispatcher-search-input:focus-visible { outline:0!important;',
    '.dispatcher-search-wrap:focus-within {',
    'border:2px solid var(--md-sys-color-primary);',
  ];
  const missing = required.filter(needle => !css.includes(needle));
  if (missing.length) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Стан підтвердження видалення не оголошується top-level lexical binding:
// iframe може повторно виконати inline-скрипт під час відновлення вкладки.
{
  const text = readFileSync('osbb/index.html', 'utf8');
  const label = 'journal ticket delete state survives repeated iframe script execution';
  const required = [
    'window.osbbTicketDeleteState = window.osbbTicketDeleteState ||',
    'window.osbbTicketDeleteState.pending',
    'window.osbbTicketDeleteState.focusReturn',
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const topLevelBinding = /\b(?:let|const)\s+(?:pendingTicketDelete|ticketDeleteFocusReturn)\b/.test(text);
  if (missing.length || topLevelBinding) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; lexical binding: ${topLevelBinding})`);
  } else {
    passed += 1;
    console.log(`ok - ${label}`);
  }
}

// Desktop navigation Складу використовує нативні button controls замість
// div role="button" і зберігає aria-current для активної сторінки.
{
  const text = readSkladCombined();
  const label = 'sklad desktop navigation uses native Material 3 buttons';
  const required = [
    '<button type="button" class="ni active" data-page="items" aria-current="page">',
    '<button type="button" class="ni" data-page="issue">',
    '<button type="button" class="ni" data-page="stats">',
    '.ni{display:flex;width:calc(100% - 16px);align-items:center;',
    'font:inherit;font-size:14px;font-weight:500;line-height:1.2;text-align:left;',
    "n.setAttribute('aria-current','page')",
  ];
  const missing = required.filter(needle => !text.includes(needle));
  const legacyNav = /class="ni[^"]*"[^>]*role="button"/.test(text);
  if (missing.length || legacyNav) {
    failed += 1;
    console.error(`not ok - ${label} (missing: ${missing.join(', ')}; legacy nav: ${legacyNav})`);
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
