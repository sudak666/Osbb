-- Supabase CLI migration mirror for sklad/supabase/008_document_undocumented_functions.sql.
-- Keep this file synchronized with the historical SQL file while the project migrates to CLI migrations.

-- Аудит липень 2026 виявив, що жива база (vkwkyhjjjmcpmiakxohw) містить
-- функції/тригери/зміни схеми, яких не було в жодному з файлів 001-007.
-- Це саме та ситуація, від якої застерігає CLAUDE.md ("Жорстке правило":
-- зміни живої схеми обов'язково супроводжувати SQL-файлом у git) — уже
-- траплялось раз із trg_notify_low_stock/telegram_config, і виявилось знову.
-- Цей файл нічого не змінює в поведінці застосунку: він або документує
-- те, що вже реально виконується в базі (create or replace — ідемпотентно),
-- або прибирає підтверджено мертвий артефакт (таблиця inventory).
--
-- Для нового розгортання виконати після 001-007.

-- 1. delete_inventory_item / delete_inventory_log / delete_inventory_receipt
-- Викликаються з sklad/index.html (кнопки видалення товару/логу видачі/
-- приходу), PIN-захищені через verify_pin(attempt) всередині. Existed
-- live, README.md (розділ RPC) їх згадував, SQL-файлу не було.

create or replace function delete_inventory_item(p_item_id bigint, attempt text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ok boolean;
begin
  select verify_pin(attempt) into ok;
  if not ok then
    return jsonb_build_object('ok', false, 'reason', 'bad_pin');
  end if;

  delete from inventory_items where id = p_item_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function delete_inventory_log(p_log_id bigint, attempt text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ok boolean;
  log_row inventory_logs%rowtype;
begin
  select verify_pin(attempt) into ok;
  if not ok then
    return jsonb_build_object('ok', false, 'reason', 'bad_pin');
  end if;

  select * into log_row from inventory_logs where id = p_log_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  update inventory_items set quantity = round((quantity + log_row.quantity)::numeric, 2) where id = log_row.item_id;
  delete from inventory_logs where id = p_log_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function delete_inventory_receipt(p_receipt_id bigint, attempt text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ok boolean;
  receipt_row inventory_receipts%rowtype;
  item_row inventory_items%rowtype;
  new_qty numeric;
begin
  select verify_pin(attempt) into ok;
  if not ok then
    return jsonb_build_object('ok', false, 'reason', 'bad_pin');
  end if;

  select * into receipt_row from inventory_receipts where id = p_receipt_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select * into item_row from inventory_items where id = receipt_row.item_id;
  if found then
    new_qty := round((item_row.quantity - receipt_row.quantity)::numeric, 2);
    if new_qty < 0 then
      return jsonb_build_object('ok', false, 'reason', 'negative_stock');
    end if;
    update inventory_items set quantity = new_qty where id = item_row.id;
  end if;

  delete from inventory_receipts where id = p_receipt_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function delete_inventory_item(bigint, text) from public;
revoke all on function delete_inventory_log(bigint, text) from public;
revoke all on function delete_inventory_receipt(bigint, text) from public;
grant execute on function delete_inventory_item(bigint, text) to anon, authenticated;
grant execute on function delete_inventory_log(bigint, text) to anon, authenticated;
grant execute on function delete_inventory_receipt(bigint, text) to anon, authenticated;

-- 2. Telegram-сповіщення про низький залишок / видачу / прихід.
-- trg_notify_chat вже задокументований у 005_merge_osbb_journal.sql —
-- ці три були пропущені.

create or replace function trg_notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.quantity <= 3 and (old.quantity is null or old.quantity > 3) then
    if new.quantity = 0 then
      perform notify_telegram('🔴 Товар «' || new.name || '» закінчився на складі');
    else
      perform notify_telegram('🟠 Товар «' || new.name || '» закінчується: залишилось ' || new.quantity || ' ' || coalesce(new.unit, ''));
    end if;
  end if;
  return new;
end;
$$;

create or replace function trg_notify_log()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform notify_telegram(
    '📤 Видано зі складу: ' || new.item_name || ' — ' || new.quantity ||
    case when new.issued_to is not null and new.issued_to <> '' then ' (кому: ' || new.issued_to || ')' else '' end
  );
  return new;
end;
$$;

create or replace function trg_notify_receipt()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform notify_telegram(
    '📥 Надійшло на склад: ' || new.item_name || ' — ' || new.quantity ||
    case when new.supplier is not null and new.supplier <> '' then ' (від: ' || new.supplier || ')' else '' end
  );
  return new;
end;
$$;

drop trigger if exists inventory_items_low_stock_notify on inventory_items;
create trigger inventory_items_low_stock_notify after update on inventory_items for each row execute function trg_notify_low_stock();

drop trigger if exists inventory_logs_notify on inventory_logs;
create trigger inventory_logs_notify after insert on inventory_logs for each row execute function trg_notify_log();

drop trigger if exists inventory_receipts_notify on inventory_receipts;
create trigger inventory_receipts_notify after insert on inventory_receipts for each row execute function trg_notify_receipt();

-- 3. Орфанна таблиця `inventory` (не плутати з `inventory_items`!) —
-- підтверджено 0 рядків, RLS enabled без жодної policy (default-deny,
-- нічого не читалось anon-ключем), і ніде в sklad/index.html чи інших
-- SQL-файлах не використовується. Схоже на залишок раннього прототипу до
-- перейменування колонок/таблиці на inventory_items. Прибираємо як мертву.

drop table if exists inventory;

-- 4. Supabase security advisor (WARN, не критично): pg_net встановлений
-- у схемі public, рекомендовано тримати extensions окремо. НЕ виконано:
-- `alter extension pg_net set schema extensions` падає з помилкою
-- "extension pg_net does not support SET SCHEMA" (перевірено наживо).
-- Єдиний робочий шлях — `drop extension pg_net` + `create extension
-- pg_net schema extensions`, що на мить прибирає net.http_post і може
-- обірвати Telegram-сповіщення в момент виконання — свідомо не робимо
-- цього автоматично, залишено як подальший ручний крок, якщо колись
-- знадобиться прибрати цей WARN.
