-- Правління й адміністратор можуть керувати персональним PIN-входом співробітників.
create or replace function list_osbb_staff_settings(p_staff_id uuid, attempt text)
returns table(id uuid, full_name text, role text, active boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  verify_result record;
begin
  select * into verify_result from verify_staff_pin(p_staff_id, attempt);
  if not verify_result.ok or verify_result.role not in ('board', 'admin') then
    return;
  end if;

  return query
    select s.id, s.full_name, s.role, s.active
    from osbb_staff s
    order by s.full_name;
end;
$$;

create or replace function set_osbb_staff_active(
  p_staff_id uuid,
  attempt text,
  p_target_staff_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  verify_result record;
begin
  select * into verify_result from verify_staff_pin(p_staff_id, attempt);
  if not verify_result.ok or verify_result.role not in ('board', 'admin') or p_target_staff_id = p_staff_id then
    return false;
  end if;

  update osbb_staff
  set active = p_active
  where id = p_target_staff_id;

  return found;
end;
$$;

revoke all on function list_osbb_staff_settings(uuid, text) from public;
revoke all on function set_osbb_staff_active(uuid, text, uuid, boolean) from public;
grant execute on function list_osbb_staff_settings(uuid, text) to anon, authenticated;
grant execute on function set_osbb_staff_active(uuid, text, uuid, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
