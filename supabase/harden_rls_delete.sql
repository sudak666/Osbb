-- Звуження RLS-політик на dispatcher/garbage/schedule: прибираємо DELETE
-- для анонімного ключа (він видимий у коді сторінки будь-кому), лишаємо
-- SELECT+INSERT+UPDATE, якими застосунок реально користується щодня.
-- "Скидання місяця" (раніше — прямий .delete() з клієнта) переведено на
-- RPC reset_month(), яка сама перевіряє PIN (той самий verify_reset_pin,
-- що вже використовує PIN-модалка) і лише тоді виконує видалення.
--
-- Таблицю photos свідомо НЕ чіпаємо: видалення окремого фото — штатна дія
-- будь-якого користувача застосунку без PIN (кнопка "Видалити фото"),
-- це вже так задумано розробником, не стосується цієї знахідки.

-- 1. dispatcher
drop policy if exists "allow all" on dispatcher;
create policy "select all" on dispatcher for select to anon, authenticated using (true);
create policy "insert all" on dispatcher for insert to anon, authenticated with check (true);
create policy "update all" on dispatcher for update to anon, authenticated using (true) with check (true);

-- 2. garbage
drop policy if exists "anon_all" on garbage;
create policy "select all" on garbage for select to anon, authenticated using (true);
create policy "insert all" on garbage for insert to anon, authenticated with check (true);
create policy "update all" on garbage for update to anon, authenticated using (true) with check (true);

-- 3. schedule
drop policy if exists "Allow all" on schedule;
create policy "select all" on schedule for select to anon, authenticated using (true);
create policy "insert all" on schedule for insert to anon, authenticated with check (true);
create policy "update all" on schedule for update to anon, authenticated using (true) with check (true);

-- 4. RPC для скидання місяця: перевіряє PIN (verify_reset_pin вже існує
-- з попереднього фіксу auth) і лише після успіху видаляє рядок за
-- month_key з дозволеної (allow-list) таблиці — без динамічного SQL,
-- без ризику SQL-ін'єкції через table_name.
create or replace function reset_month(table_name text, p_month_key text, attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ok boolean;
begin
  select verify_reset_pin(attempt) into ok;
  if not ok then
    return false;
  end if;

  if table_name = 'schedule' then
    delete from schedule where month_key = p_month_key;
  elsif table_name = 'garbage' then
    delete from garbage where month_key = p_month_key;
  elsif table_name = 'dispatcher' then
    delete from dispatcher where month_key = p_month_key;
  else
    raise exception 'invalid table_name: %', table_name;
  end if;

  return true;
end;
$$;

revoke all on function reset_month(text, text, text) from public;
grant execute on function reset_month(text, text, text) to anon, authenticated;
