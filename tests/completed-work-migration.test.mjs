import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('../sklad/supabase/023_add_completed_work_log.sql',import.meta.url),'utf8');
test('completed work writes are RPC-only and staff-PIN protected',()=>{
  assert.match(sql,/alter table public\.completed_work enable row level security/);
  assert.match(sql,/revoke insert, update, delete on table public\.completed_work from anon, authenticated/);
  assert.match(sql,/verify_result\.role not in \('dispatcher', 'admin', 'board'\)/);
  assert.match(sql,/security definer\s+set search_path = ''/);
  assert.match(sql,/revoke execute on function public\.save_completed_work[\s\S]*from public/);
});
