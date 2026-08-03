import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/database.types.ts', import.meta.url), 'utf8');
const apiSource = fs.readFileSync(new URL('../src/supabase-api.ts', import.meta.url), 'utf8');

test('database types model merged OSBB month-key tables, not the old row schema', () => {
  assert.match(source, /schedule: RowOperation<\{\n\s+month_key: string;\n\s+data: Json;/);
  assert.match(source, /garbage: RowOperation<\{\n\s+month_key: string;\n\s+data: Json;/);
  assert.match(source, /dispatcher: RowOperation<\{\n\s+month_key: string;\n\s+data: Json \| null;/);
});

test('database types expose Sklad movement column names used by the UI and RPCs', () => {
  assert.match(source, /inventory_logs: RowOperation<\{[\s\S]*quantity: number;[\s\S]*issued_to: string \| null;[\s\S]*issued_at: Timestamp;/);
  assert.match(source, /inventory_receipts: RowOperation<\{[\s\S]*quantity: number;[\s\S]*supplier: string \| null;[\s\S]*received_at: Timestamp;/);
});

test('database types include critical security-definer RPC contracts', () => {
  for (const fn of ['verify_lock_pin', 'verify_reset_pin', 'list_osbb_staff', 'verify_staff_pin', 'list_osbb_staff_settings', 'set_osbb_staff_active', 'save_attendance_day', 'reset_month', 'verify_pin', 'issue_item', 'receive_item', 'delete_inventory_item', 'delete_inventory_log', 'delete_inventory_receipt', 'delete_chat_message', 'delete_photo']) {
    assert.match(source, new RegExp(`${fn}: \\{`));
  }
});

test('database types model current OSBB staff, attendance and elevator tables', () => {
  for (const table of ['osbb_staff', 'osbb_staff_pin_attempts', 'osbb_attendance', 'elevator_visits']) {
    assert.match(source, new RegExp(`${table}: RowOperation<\\{`));
  }
  assert.match(source, /export type OsbbStaffRole = 'plumber' \| 'janitor' \| 'electrician' \| 'dispatcher' \| 'admin' \| 'board';/);
  assert.match(source, /save_attendance_day: \{[\s\S]*p_role: Extract<OsbbStaffRole, 'plumber' \| 'janitor' \| 'electrician'>;/);
});

test('Supabase REST transport exposes typed table and RPC boundaries', () => {
  assert.match(apiSource, /from<Table extends PublicTableName>\(table: Table\)/);
  assert.match(apiSource, /PublicTableRow<Table>,\n\s+PublicTableInsert<Table>,\n\s+PublicTableUpdate<Table>/);
  assert.match(apiSource, /rpc<Fn extends PublicFunctionName>\(fn: Fn, params: PublicFunctionArgs<Fn>\): Promise<PublicFunctionReturns<Fn> \| null>/);
  assert.match(apiSource, /data: T \| null;/);
});
