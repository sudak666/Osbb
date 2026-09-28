-- Ідемпотентні видача/прихід, атомарне редагування рухів складу і
-- серверне Telegram-сповіщення про новий товар.
--
-- Передумова: 009_add_receipt_purchase_price.sql (колонка purchase_price_unit
-- і receive_item з p_price_unit).
--
-- 1. p_client_request_id: клієнт генерує UUID один раз на логічну операцію і
--    повторює його при ретраї після мережевої помилки. Повтор з тим самим id
--    не списує/не додає залишок удруге, а повертає поточний стан товару.
-- 2. update_inventory_log / update_inventory_receipt: різниця кількості
--    застосовується до залишку в тій самій транзакції (раніше клієнт писав
--    абсолютний залишок, обчислений зі свого кешу, — гонка з іншими діями).
-- 3. trg_notify_new_item: замінює клієнтський виклик Edge Function
--    notify-telegram (видача/прихід уже сповіщаються тригерами з 008).

alter table inventory_logs add column if not exists client_request_id uuid;
create unique index if not exists inventory_logs_client_request_id_key
  on inventory_logs (client_request_id) where client_request_id is not null;

alter table inventory_receipts add column if not exists client_request_id uuid;
create unique index if not exists inventory_receipts_client_request_id_key
  on inventory_receipts (client_request_id) where client_request_id is not null;

-- ── Видача ──────────────────────────────────────────────────────────────
drop function if exists issue_item(bigint, numeric, text, text, timestamptz);
drop function if exists issue_item(bigint, numeric, text, text, timestamptz, uuid);

create function issue_item(
  p_item_id bigint,
  p_qty numeric,
  p_person text,
  p_note text default null,
  p_issued_at timestamptz default null,
  p_client_request_id uuid default null
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

  if p_client_request_id is not null
     and exists (select 1 from inventory_logs l where l.client_request_id = p_client_request_id) then
    return query select i.quantity, i.name, i.unit from inventory_items i where i.id = p_item_id;
    return;
  end if;

  if not exists (select 1 from inventory_items i where i.id = p_item_id) then
    raise exception 'item_not_found';
  end if;

  begin
    update inventory_items
    set quantity = quantity - p_qty
    where id = p_item_id and quantity >= p_qty
    returning inventory_items.quantity, inventory_items.name, inventory_items.unit
    into v_new_qty, v_name, v_unit;

    if not found then
      raise exception 'insufficient_stock';
    end if;

    insert into inventory_logs (item_id, item_name, quantity, issued_to, note, issued_at, client_request_id)
    values (p_item_id, v_name, p_qty, p_person, p_note, coalesce(p_issued_at, now()), p_client_request_id);
  exception when unique_violation then
    -- Паралельний дубль того самого запиту вже зафіксований: списання цього
    -- субблоку відкочено, повертаємо актуальний стан.
    return query select i.quantity, i.name, i.unit from inventory_items i where i.id = p_item_id;
    return;
  end;

  return query select v_new_qty, v_name, v_unit;
end;
$$;

-- ── Прихід ──────────────────────────────────────────────────────────────
drop function if exists receive_item(bigint, numeric, text, text, timestamptz);
drop function if exists receive_item(bigint, numeric, text, text, timestamptz, numeric);
drop function if exists receive_item(bigint, numeric, text, text, timestamptz, numeric, uuid);

create function receive_item(
  p_item_id bigint,
  p_qty numeric,
  p_supplier text default null,
  p_note text default null,
  p_received_at timestamptz default null,
  p_price_unit numeric default null,
  p_client_request_id uuid default null
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

  if p_client_request_id is not null
     and exists (select 1 from inventory_receipts r where r.client_request_id = p_client_request_id) then
    return query select i.quantity, i.name, i.unit from inventory_items i where i.id = p_item_id;
    return;
  end if;

  begin
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
      item_id, item_name, quantity, purchase_price_unit, supplier, note, received_at, client_request_id
    )
    values (
      p_item_id, v_name, p_qty, p_price_unit, p_supplier, p_note, coalesce(p_received_at, now()), p_client_request_id
    );
  exception when unique_violation then
    return query select i.quantity, i.name, i.unit from inventory_items i where i.id = p_item_id;
    return;
  end;

  return query select v_new_qty, v_name, v_unit;
end;
$$;

-- ── Редагування видачі ──────────────────────────────────────────────────
create or replace function update_inventory_log(
  p_log_id bigint,
  p_qty numeric,
  p_person text,
  p_note text default null,
  p_issued_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_log inventory_logs%rowtype;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select * into v_log from inventory_logs where id = p_log_id for update;
  if not found then
    raise exception 'log_not_found';
  end if;

  if v_log.item_id is not null then
    update inventory_items
    set quantity = quantity + v_log.quantity - p_qty
    where id = v_log.item_id and quantity + v_log.quantity - p_qty >= 0;
    if not found and exists (select 1 from inventory_items where id = v_log.item_id) then
      raise exception 'insufficient_stock';
    end if;
  end if;

  update inventory_logs
  set quantity = p_qty,
      issued_to = p_person,
      note = p_note,
      issued_at = coalesce(p_issued_at, issued_at)
  where id = p_log_id;

  return true;
end;
$$;

-- ── Редагування приходу ─────────────────────────────────────────────────
create or replace function update_inventory_receipt(
  p_receipt_id bigint,
  p_qty numeric,
  p_supplier text default null,
  p_note text default null,
  p_received_at timestamptz default null,
  p_price_unit numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_receipt inventory_receipts%rowtype;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'invalid_quantity';
  end if;
  if p_price_unit is not null and p_price_unit <= 0 then
    raise exception 'invalid_purchase_price';
  end if;

  select * into v_receipt from inventory_receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'receipt_not_found';
  end if;

  if v_receipt.item_id is not null then
    update inventory_items
    set quantity = quantity - v_receipt.quantity + p_qty,
        price_unit = coalesce(p_price_unit, price_unit),
        price_source = case when p_price_unit is not null then 'Закупівля' else price_source end,
        price_confidence = case when p_price_unit is not null then 'manual' else price_confidence end,
        price_checked_at = case when p_price_unit is not null then now() else price_checked_at end
    where id = v_receipt.item_id and quantity - v_receipt.quantity + p_qty >= 0;
    if not found and exists (select 1 from inventory_items where id = v_receipt.item_id) then
      raise exception 'negative_stock';
    end if;
  end if;

  update inventory_receipts
  set quantity = p_qty,
      purchase_price_unit = p_price_unit,
      supplier = p_supplier,
      note = p_note,
      received_at = coalesce(p_received_at, received_at)
  where id = p_receipt_id;

  return true;
end;
$$;

revoke all on function issue_item(bigint, numeric, text, text, timestamptz, uuid) from public;
revoke all on function receive_item(bigint, numeric, text, text, timestamptz, numeric, uuid) from public;
revoke all on function update_inventory_log(bigint, numeric, text, text, timestamptz) from public;
revoke all on function update_inventory_receipt(bigint, numeric, text, text, timestamptz, numeric) from public;
grant execute on function issue_item(bigint, numeric, text, text, timestamptz, uuid) to anon, authenticated;
grant execute on function receive_item(bigint, numeric, text, text, timestamptz, numeric, uuid) to anon, authenticated;
grant execute on function update_inventory_log(bigint, numeric, text, text, timestamptz) to anon, authenticated;
grant execute on function update_inventory_receipt(bigint, numeric, text, text, timestamptz, numeric) to anon, authenticated;

-- ── Telegram: новий товар ───────────────────────────────────────────────
create or replace function trg_notify_new_item()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform notify_telegram(
    '🆕 Новий товар: ' || new.name || ' — ' || new.quantity || ' ' || coalesce(new.unit, '') ||
    case when new.is_internal then ' (внутрішнє використання)' else '' end
  );
  return new;
end;
$$;

drop trigger if exists inventory_items_new_notify on inventory_items;
create trigger inventory_items_new_notify
  after insert on inventory_items
  for each row execute function trg_notify_new_item();

-- ── Storage `photos` (фіксуємо фактичний стан живої бази) ──────────────
-- Публічний бакет: читання й завантаження нових файлів для anon. Політик на
-- update/delete навмисно немає — anon не може перезаписати чи видалити файл.
-- Наслідок: після delete_photo файл лишається в бакеті (orphan); чистка —
-- вручну в Dashboard або через service-role.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public Access') then
    create policy "Public Access" on storage.objects for select using (bucket_id = 'photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public Upload') then
    create policy "Public Upload" on storage.objects for insert with check (bucket_id = 'photos');
  end if;
end;
$$;
