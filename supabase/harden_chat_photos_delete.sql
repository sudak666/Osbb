-- Скрипт для основного застосунку ОСББ (журнал), не для модуля складу.
-- Звуження видалення повідомлень чату.
-- Анонімний ключ видимий у фронтенді, тому прямий DELETE з клієнта
-- замінюємо на RPC delete_chat_message(), яка повторно перевіряє PIN.
--
-- Виконати в тому ж Supabase-проєкті, де знаходиться таблиця chat і
-- функція verify_reset_pin(attempt) з setup_pin_auth.sql.

-- Лишаємо читання/створення/оновлення доступними для застосунку, але
-- прибираємо пряме видалення через REST/JS SDK.
drop policy if exists "allow all" on chat;
drop policy if exists "anon_all" on chat;
drop policy if exists "Allow all" on chat;
drop policy if exists "select all" on chat;
drop policy if exists "insert all" on chat;
drop policy if exists "update all" on chat;

create policy "select all" on chat for select to anon, authenticated using (true);
create policy "insert all" on chat for insert to anon, authenticated with check (true);
create policy "update all" on chat for update to anon, authenticated using (true) with check (true);

create or replace function delete_chat_message(p_message_id bigint, attempt text)
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

  delete from chat where id = p_message_id;
  return true;
end;
$$;

revoke all on function delete_chat_message(bigint, text) from public;
grant execute on function delete_chat_message(bigint, text) to anon, authenticated;

-- Звуження видалення фото журналу: самі фото лишаються штатною дією
-- користувача, але видалення запису з таблиці photos тепер проходить через
-- PIN-захищений RPC. Клієнт після успішного RPC може прибрати файл зі Storage.
drop policy if exists "allow all" on photos;
drop policy if exists "anon_all" on photos;
drop policy if exists "Allow all" on photos;
drop policy if exists "select all" on photos;
drop policy if exists "insert all" on photos;
drop policy if exists "update all" on photos;

create policy "select all" on photos for select to anon, authenticated using (true);
create policy "insert all" on photos for insert to anon, authenticated with check (true);
create policy "update all" on photos for update to anon, authenticated using (true) with check (true);

create or replace function delete_photo(p_photo_id bigint, attempt text)
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

  delete from photos where id = p_photo_id;
  return true;
end;
$$;

revoke all on function delete_photo(bigint, text) from public;
grant execute on function delete_photo(bigint, text) to anon, authenticated;
