-- Mirror of: sklad/supabase/026_unify_main_pin_keep_shifts_separate.sql
-- Keep both migration trees identical below this header.

-- Один основний PIN для shell, журналу, складу та підтверджень.
-- Розділ "Зміни" навмисно зберігає окремий PIN у work_shift_auth.

update public.osbb_app_auth
set lock_pin_hash = extensions.crypt('3535', extensions.gen_salt('bf')),
    reset_pin_hash = extensions.crypt('3535', extensions.gen_salt('bf'))
where id = 1;

update public.app_auth
set pin_hash = extensions.crypt('3535', extensions.gen_salt('bf'))
where id = 1;

create or replace function public.verify_reset_pin(attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  attempt_row public.osbb_app_pin_attempts%rowtype;
  ok boolean;
  next_failed_count int;
begin
  select * into attempt_row from public.osbb_app_pin_attempts where pin_name = 'reset';
  if attempt_row.locked_until is not null and attempt_row.locked_until > now() then return false; end if;
  select exists (
    select 1
    from public.osbb_app_auth
    where id = 1
      and lock_pin_hash = extensions.crypt(attempt, lock_pin_hash)
  ) into ok;
  if ok then
    delete from public.osbb_app_pin_attempts where pin_name = 'reset';
    return true;
  end if;
  next_failed_count := case
    when attempt_row.pin_name is null or attempt_row.last_failed_at < now() - interval '15 minutes' then 1
    else attempt_row.failed_count + 1
  end;
  insert into public.osbb_app_pin_attempts (pin_name, failed_count, locked_until, last_failed_at)
  values ('reset', next_failed_count, case when next_failed_count >= 5 then now() + interval '5 minutes' end, now())
  on conflict (pin_name) do update
    set failed_count = excluded.failed_count,
        locked_until = excluded.locked_until,
        last_failed_at = excluded.last_failed_at;
  return false;
end;
$$;

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
    select exists (
      select 1
      from public.work_shift_auth
      where id = 1
        and pin_hash = extensions.crypt(attempt, pin_hash)
    ) into ok;
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

revoke all on function public.verify_reset_pin(text) from public;
revoke all on function public.verify_work_shifts_pin(text) from public;
grant execute on function public.verify_reset_pin(text) to anon, authenticated;
grant execute on function public.verify_work_shifts_pin(text) to anon, authenticated;

notify pgrst, 'reload schema';
