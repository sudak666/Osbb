#!/usr/bin/env node
import { readFileSync } from 'node:fs';

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

  ['supabase/setup_pin_auth.sql', 'app_pin_attempts', 'OSBB PIN attempts table exists'],
  ['supabase/setup_pin_auth.sql', 'locked_until', 'OSBB PIN lockout is present'],
  ['supabase/harden_chat_photos_delete.sql', 'delete_chat_message', 'chat delete RPC exists'],
  ['supabase/harden_chat_photos_delete.sql', 'delete_photo', 'photo delete RPC exists'],
  ['sklad/supabase/setup_pin_auth.sql', 'app_pin_attempts', 'sklad PIN attempts table exists'],
];

let failed = 0;
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
