-- Supabase CLI migration mirror for sklad/supabase/006_atomic_stock_issue_receive.sql.
-- Keep this file synchronized with the historical SQL file while the project migrates to CLI migrations.

-- Атомарне списання/поповнення складу.
--
-- До цього фронтенд робив read-check-write з клієнта: читав item.quantity
-- з локального кешу allItems, сам перевіряв достатність, і двома окремими
-- незалежними запитами оновлював quantity та вставляв рядок в
-- inventory_logs/inventory_receipts. Два одночасні списання того самого
-- товару могли пройти обидві клієнтські перевірки і дати від'ємний
-- залишок — задокументований відомий ризик у CLAUDE.md.
--
-- Виконати ОДИН РАЗ у Supabase SQL Editor (проєкт складу).

alter table inventory_items
  add constraint inventory_items_quantity_nonnegative check (quantity >= 0);

create or replace function issue_item(
  p_item_id bigint,
  p_qty numeric,
  p_person text,
  p_note text default null,
  p_issued_at timestamptz default null
)
returns table(new_quantity numeric, item_name text, unit text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text;
  v_unit text;
  v_new_qty numeric;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'invalid_quantity';
  end if;

  update inventory_items
  set quantity = quantity - p_qty
  where id = p_item_id and quantity >= p_qty
  returning inventory_items.quantity, inventory_items.name, inventory_items.unit
  into v_new_qty, v_name, v_unit;

  if not found then
    raise exception 'insufficient_stock';
  end if;

  insert into inventory_logs (item_id, item_name, quantity, issued_to, note, issued_at)
  values (p_item_id, v_name, p_qty, p_person, p_note, coalesce(p_issued_at, now()));

  return query select v_new_qty, v_name, v_unit;
end;
$$;

create or replace function receive_item(
  p_item_id bigint,
  p_qty numeric,
  p_supplier text default null,
  p_note text default null,
  p_received_at timestamptz default null
)
returns table(new_quantity numeric, item_name text, unit text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text;
  v_unit text;
  v_new_qty numeric;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'invalid_quantity';
  end if;

  update inventory_items
  set quantity = quantity + p_qty
  where id = p_item_id
  returning inventory_items.quantity, inventory_items.name, inventory_items.unit
  into v_new_qty, v_name, v_unit;

  if not found then
    raise exception 'item_not_found';
  end if;

  insert into inventory_receipts (item_id, item_name, quantity, supplier, note, received_at)
  values (p_item_id, v_name, p_qty, p_supplier, p_note, coalesce(p_received_at, now()));

  return query select v_new_qty, v_name, v_unit;
end;
$$;

revoke all on function issue_item(bigint, numeric, text, text, timestamptz) from public;
revoke all on function receive_item(bigint, numeric, text, text, timestamptz) from public;
grant execute on function issue_item(bigint, numeric, text, text, timestamptz) to anon, authenticated;
grant execute on function receive_item(bigint, numeric, text, text, timestamptz) to anon, authenticated;
