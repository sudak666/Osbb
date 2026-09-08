-- Third employee starts without automatically assigned shifts.
alter table public.work_shifts add column if not exists third text[] not null default '{}';
alter table public.work_shifts add constraint work_shifts_third_types check (third <@ array['day','night','night_half2','rest']::text[]);
alter table public.work_shift_settings add column if not exists employee_three_name text not null default 'Третій співробітник';

create or replace function save_work_shift_day_v2(
  p_shift_date date,
  p_sergiy text[],
  p_oleksandr text[],
  p_third text[],
  attempt text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_work_shifts_pin(attempt) then return false; end if;
  if not coalesce(p_sergiy, '{}') <@ array['day','night','night_half2','rest']::text[]
     or not coalesce(p_oleksandr, '{}') <@ array['day','night','night_half2','rest']::text[]
     or not coalesce(p_third, '{}') <@ array['day','night','night_half2','rest']::text[] then
    raise exception 'invalid work shift type';
  end if;

  if cardinality(coalesce(p_sergiy, '{}')) = 0 and cardinality(coalesce(p_oleksandr, '{}')) = 0 and cardinality(coalesce(p_third, '{}')) = 0 then
    delete from work_shifts where shift_date = p_shift_date;
  else
    insert into work_shifts (shift_date, month_key, sergiy, oleksandr, third, updated_at)
    values (p_shift_date, to_char(p_shift_date, 'YYYY-MM'), coalesce(p_sergiy, '{}'), coalesce(p_oleksandr, '{}'), coalesce(p_third, '{}'), now())
    on conflict (shift_date) do update
      set month_key = excluded.month_key,
          sergiy = excluded.sergiy,
          oleksandr = excluded.oleksandr,
          third = excluded.third,
          updated_at = excluded.updated_at;
  end if;
  return true;
end;
$$;

create or replace function update_work_shift_names_v2(p_employee_one_name text, p_employee_two_name text, p_employee_three_name text, attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_work_shifts_pin(attempt) then return false; end if;
  if char_length(trim(coalesce(p_employee_one_name, ''))) not between 1 and 40
     or char_length(trim(coalesce(p_employee_two_name, ''))) not between 1 and 40
     or char_length(trim(coalesce(p_employee_three_name, ''))) not between 1 and 40 then
    raise exception 'invalid employee name';
  end if;
  update work_shift_settings
  set employee_one_name = trim(p_employee_one_name), employee_two_name = trim(p_employee_two_name), employee_three_name = trim(p_employee_three_name)
  where id = 1;
  return true;
end;
$$;


revoke all on function save_work_shift_day_v2(date, text[], text[], text[], text) from public;
revoke all on function update_work_shift_names_v2(text, text, text, text) from public;
grant execute on function save_work_shift_day_v2(date, text[], text[], text[], text) to anon, authenticated;
grant execute on function update_work_shift_names_v2(text, text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
