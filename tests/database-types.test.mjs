import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/database.types.ts', import.meta.url), 'utf8');

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
  for (const fn of ['verify_lock_pin', 'verify_reset_pin', 'reset_month', 'verify_pin', 'issue_item', 'receive_item', 'delete_inventory_item', 'delete_inventory_log', 'delete_inventory_receipt', 'delete_chat_message', 'delete_photo']) {
    assert.match(source, new RegExp(`${fn}: \\{`));
  }
});
