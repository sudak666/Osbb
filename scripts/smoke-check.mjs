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

let failed = 0;
for (const file of walk('.')) {
  const text = readFileSync(file, 'utf8');
  if (conflictMarker.test(text)) {
    failed += 1;
    console.error(`not ok - unresolved merge conflict marker found in ${file}`);
  }
}

for (const [file, needle, label] of checks) {
  const text = readFileSync(file, 'utf8');
  if (text.includes(needle)) {
    console.log(`ok - ${label}`);
  } else {
    failed += 1;
    console.error(`not ok - ${label} (${file} missing ${JSON.stringify(needle)})`);
  }
}

if (failed) {
  console.error(`\n${failed} smoke check(s) failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} smoke checks passed.`);
