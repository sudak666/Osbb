-- Mirror of sklad/supabase/031_archive_legacy_journal_tables.sql
-- Keep in sync with the numbered source.

-- Прибирання застарілого журналу (вересень 2026).
--
-- Таблиці chat / schedule / dispatcher лишились від старого "Журналу чергувань",
-- чату й диспетчерського журналу, які прибрані з UI ще в липні 2026. Замість
-- drop вони переносяться в схему archive: вона не відкрита через PostgREST і не
-- має прав для anon/authenticated, тож дані недоступні застосунку, але не
-- втрачені. Остаточно видалити: drop schema archive cascade;
--
-- Разом з ними прибираються: тригер і функції Telegram-сповіщень чату,
-- delete_chat_message, а reset_month лишається лише для garbage.

create schema if not exists archive;
revoke all on schema archive from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['chat', 'schedule', 'dispatcher'] loop
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end;
$$;

drop trigger if exists chat_telegram_notify on public.chat;
drop function if exists public.trg_notify_chat();
drop function if exists public.delete_chat_message(bigint, text);
drop function if exists public.notify_osbb_telegram(text);

alter table if exists public.chat set schema archive;
alter table if exists public.schedule set schema archive;
alter table if exists public.dispatcher set schema archive;
alter table if exists public.osbb_telegram_config set schema archive;

revoke all on all tables in schema archive from public, anon, authenticated;
revoke all on all sequences in schema archive from public, anon, authenticated;

create or replace function reset_month(table_name text, p_month_key text, attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_reset_pin(attempt) then
    return false;
  end if;

  if table_name = 'garbage' then
    delete from garbage where month_key = p_month_key;
  else
    raise exception 'invalid table_name: %', table_name;
  end if;

  return true;
end;
$$;

revoke all on function reset_month(text, text, text) from public;
grant execute on function reset_month(text, text, text) to anon, authenticated;
