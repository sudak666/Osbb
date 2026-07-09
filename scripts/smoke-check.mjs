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
