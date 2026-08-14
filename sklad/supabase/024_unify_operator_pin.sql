-- Керівні профілі використовують той самий PIN, що й вхід до журналу.
-- Персональні PIN-и лишаються сумісними для вже налаштованих інсталяцій.
create or replace function public.verify_staff_pin(p_staff_id uuid, attempt text)
returns table (ok boolean, role text, full_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  staff_row public.osbb_staff%rowtype;
  attempt_row public.osbb_staff_pin_attempts%rowtype;
  is_ok boolean := false;
  next_failed_count int;
begin
  select * into staff_row
  from public.osbb_staff
  where id = p_staff_id and active;

  if staff_row.id is null then
    return query select false, null::text, null::text;
    return;
  end if;

  select * into attempt_row
  from public.osbb_staff_pin_attempts
  where staff_id = p_staff_id;

  if attempt_row.locked_until is not null and attempt_row.locked_until > now() then
    return query select false, null::text, null::text;
    return;
  end if;

  select
    staff_row.pin_hash = extensions.crypt(attempt, staff_row.pin_hash)
    or (
      staff_row.role in ('dispatcher', 'admin', 'board')
      and exists (
        select 1
        from public.osbb_app_auth
        where id = 1
          and lock_pin_hash = extensions.crypt(attempt, lock_pin_hash)
      )
    )
  into is_ok;

  if is_ok then
    delete from public.osbb_staff_pin_attempts where staff_id = p_staff_id;
    return query select true, staff_row.role, staff_row.full_name;
    return;
  end if;

  next_failed_count := case
    when attempt_row.staff_id is null
      or attempt_row.last_failed_at < now() - interval '15 minutes' then 1
    else attempt_row.failed_count + 1
  end;

  insert into public.osbb_staff_pin_attempts (staff_id, failed_count, locked_until, last_failed_at)
  values (
    p_staff_id,
    next_failed_count,
    case when next_failed_count >= 5 then now() + interval '5 minutes' end,
    now()
  )
  on conflict (staff_id) do update
    set failed_count = excluded.failed_count,
        locked_until = excluded.locked_until,
        last_failed_at = excluded.last_failed_at;

  return query select false, null::text, null::text;
end;
$$;

revoke all on function public.verify_staff_pin(uuid, text) from public;
grant execute on function public.verify_staff_pin(uuid, text) to anon, authenticated;
