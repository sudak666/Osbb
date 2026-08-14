-- Mirror of: sklad/supabase/025_unify_work_shifts_pin.sql
-- Keep both migration trees identical below this header.

-- Графік змін використовує той самий PIN, що й вхід до журналу.
-- Старий PIN лишається сумісним для вже налаштованих інсталяцій.
create or replace function public.verify_work_shifts_pin(attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  attempt_row public.work_shift_pin_attempts%rowtype;
  ok boolean := false;
  next_failed_count int;
begin
  select * into attempt_row
  from public.work_shift_pin_attempts
  where pin_name = 'work_shifts';

  if attempt_row.locked_until is not null and attempt_row.locked_until > now() then
    return false;
  end if;

  if length(attempt) = 4 and attempt ~ '^[0-9]{4}$' then
    select
      exists (
        select 1
        from public.work_shift_auth
        where id = 1
          and pin_hash = extensions.crypt(attempt, pin_hash)
      )
      or exists (
        select 1
        from public.osbb_app_auth
        where id = 1
          and lock_pin_hash = extensions.crypt(attempt, lock_pin_hash)
      )
    into ok;
  end if;

  if ok then
    delete from public.work_shift_pin_attempts where pin_name = 'work_shifts';
    return true;
  end if;

  next_failed_count := case
    when attempt_row.pin_name is null
      or attempt_row.last_failed_at < now() - interval '15 minutes' then 1
    else attempt_row.failed_count + 1
  end;

  insert into public.work_shift_pin_attempts (pin_name, failed_count, locked_until, last_failed_at)
  values (
    'work_shifts',
    next_failed_count,
    case when next_failed_count >= 5 then now() + interval '5 minutes' end,
    now()
  )
  on conflict (pin_name) do update
    set failed_count = excluded.failed_count,
        locked_until = excluded.locked_until,
        last_failed_at = excluded.last_failed_at;

  return false;
end;
$$;

revoke all on function public.verify_work_shifts_pin(text) from public;
grant execute on function public.verify_work_shifts_pin(text) to anon, authenticated;
