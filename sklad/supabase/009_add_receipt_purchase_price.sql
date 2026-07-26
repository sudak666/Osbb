-- Історична ціна закупівлі для кожного приходу та атомарне оновлення
-- поточної ціни товару під час поповнення складу.

alter table inventory_receipts
  add column if not exists purchase_price_unit numeric(12,2)
  check (purchase_price_unit is null or purchase_price_unit > 0);

comment on column inventory_receipts.purchase_price_unit is
  'Фактична ціна закупівлі за одиницю для конкретного приходу, грн.';

drop function if exists receive_item(bigint, numeric, text, text, timestamptz);

create function receive_item(
  p_item_id bigint,
  p_qty numeric,
  p_supplier text default null,
  p_note text default null,
  p_received_at timestamptz default null,
  p_price_unit numeric default null
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
  if p_price_unit is not null and p_price_unit <= 0 then
    raise exception 'invalid_purchase_price';
  end if;

  update inventory_items
  set quantity = quantity + p_qty,
      price_unit = coalesce(p_price_unit, price_unit),
      price_source = case when p_price_unit is not null then 'Закупівля' else price_source end,
      price_confidence = case when p_price_unit is not null then 'manual' else price_confidence end,
      price_checked_at = case when p_price_unit is not null then now() else price_checked_at end
  where id = p_item_id
  returning inventory_items.quantity, inventory_items.name, inventory_items.unit
  into v_new_qty, v_name, v_unit;

  if not found then
    raise exception 'item_not_found';
  end if;

  insert into inventory_receipts (
    item_id, item_name, quantity, purchase_price_unit, supplier, note, received_at
  )
  values (
    p_item_id, v_name, p_qty, p_price_unit, p_supplier, p_note, coalesce(p_received_at, now())
  );

  return query select v_new_qty, v_name, v_unit;
end;
$$;

revoke all on function receive_item(bigint, numeric, text, text, timestamptz, numeric) from public;
grant execute on function receive_item(bigint, numeric, text, text, timestamptz, numeric)
  to anon, authenticated;

