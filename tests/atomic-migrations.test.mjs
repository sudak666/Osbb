import {PGlite} from '@electric-sql/pglite';
import test from 'node:test';
import fs from 'node:fs';import assert from 'node:assert/strict';
test('atomic audit and attendance migrations preserve data and retry safely', async () => {
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table inventory_items(id bigint primary key,name text,category text,unit text,quantity numeric);
create table inventory_audits(id bigserial primary key,note text,total_items int,items_with_diff int);
create table inventory_audit_items(id bigserial primary key,audit_id bigint,item_id bigint,item_name text,category text,unit text,qty_before numeric,qty_actual numeric);
create table osbb_attendance(month_key text primary key,data jsonb,updated_at timestamptz);
insert into inventory_items values(1,'Cable','Electric','m',10),(2,'Lamp','Electric','pcs',20);`);
for(const f of ['036_atomic_inventory_audit.sql','037_atomic_attendance_day.sql'])await db.exec(fs.readFileSync(new URL('../sklad/supabase/'+f,import.meta.url),'utf8'));
const call=(rows,id='11111111-1111-4111-8111-111111111111')=>db.query('select complete_inventory_audit($1::jsonb,$2,$3::uuid) id',[JSON.stringify(rows),'test',id]);
const rows=[{item_id:1,qty_before:10,qty_actual:8},{item_id:2,qty_before:19,qty_actual:18}];
await assert.rejects(call(rows),/inventory_changed/);assert.equal((await db.query('select count(*)::int n from inventory_audits')).rows[0].n,0);assert.equal((await db.query('select quantity from inventory_items where id=1')).rows[0].quantity,'10');
rows[1].qty_before=20;const r=await call(rows);assert.deepEqual(await call(rows),r);assert.equal((await db.query('select count(*)::int n from inventory_audits')).rows[0].n,1);
rows[0].qty_actual=7;await assert.rejects(call(rows),/request_id_conflict/);
await assert.rejects(call([{item_id:1,qty_before:8,qty_actual:-1}],'22222222-2222-4222-8222-222222222222'),/invalid_audit_quantity/);
// A failure after writes begin must also roll back audit history and all stock.
await db.exec(`create function reject_second_stock_update() returns trigger language plpgsql as $$ begin if new.id=2 then raise exception 'simulated_storage_failure'; end if; return new; end; $$;
create trigger fail_stock_update before update on inventory_items for each row execute function reject_second_stock_update();`);
await assert.rejects(call([{item_id:1,qty_before:8,qty_actual:6},{item_id:2,qty_before:18,qty_actual:16}], '33333333-3333-4333-8333-333333333333'),/simulated_storage_failure/);
assert.equal((await db.query('select quantity from inventory_items where id=1')).rows[0].quantity,'8');
assert.equal((await db.query('select count(*)::int n from inventory_audits')).rows[0].n,1);
await db.exec('drop trigger fail_stock_update on inventory_items');
await db.query("select save_attendance_day('2026-10',1,'electrician','08:00','','','17:00')");
await db.query("select save_attendance_day('2026-10',1,'plumber','09:00','','','18:00')");
await db.query("select save_attendance_day('2026-10',2,'janitor','07:00','','','16:00')");
const data=(await db.query('select data from osbb_attendance')).rows[0].data;assert.equal(data['1'].electrician.checkIn,'08:00');assert.equal(data['1'].plumber.checkIn,'09:00');assert.equal(data['2'].janitor.checkIn,'07:00');
console.log('SQL PASS: atomic rollback, stale stock, retry idempotency, request conflict, invalid quantity, attendance day/role merge');await db.close();

});
