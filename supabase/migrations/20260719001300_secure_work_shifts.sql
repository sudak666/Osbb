-- Supabase CLI migration mirror for sklad/supabase/013_secure_work_shifts.sql.
-- Keep this file synchronized with the historical SQL file while the project migrates to CLI migrations.

-- Окремий PIN і безпечні серверні операції для графіка змін.

create extension if not exists pgcrypto with schema extensions;

create table if not exists work_shift_settings (
  id int primary key default 1,
  employee_one_name text not null default 'Сергій',
  employee_two_name text not null default 'Олександр',
  constraint work_shift_settings_single_row check (id = 1),
  constraint work_shift_employee_one_name check (char_length(trim(employee_one_name)) between 1 and 40),
  constraint work_shift_employee_two_name check (char_length(trim(employee_two_name)) between 1 and 40)
);

insert into work_shift_settings (id) values (1) on conflict (id) do nothing;
alter table work_shift_settings enable row level security;
create policy "work shift settings select" on work_shift_settings for select to anon, authenticated using (true);

create table if not exists work_shift_auth (
  id int primary key default 1,
  pin_hash text not null,
  constraint work_shift_auth_single_row check (id = 1)
);
alter table work_shift_auth enable row level security;

-- Замініть 2468 на власний чотиризначний PIN перед виконанням міграції.
insert into work_shift_auth (id, pin_hash)
values (1, extensions.crypt('2468', extensions.gen_salt('bf')))
on conflict (id) do nothing;

create table if not exists work_shift_pin_attempts (
  pin_name text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz not null default now()
);
alter table work_shift_pin_attempts enable row level security;

create or replace function verify_work_shifts_pin(attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  attempt_row work_shift_pin_attempts%rowtype;
  ok boolean := false;
  next_failed_count int;
begin
  select * into attempt_row from work_shift_pin_attempts where pin_name = 'work_shifts';
  if attempt_row.locked_until is not null and attempt_row.locked_until > now() then return false; end if;

  if length(attempt) = 4 and attempt ~ '^[0-9]{4}$' then
    select exists(select 1 from work_shift_auth where id = 1 and pin_hash = crypt(attempt, pin_hash)) into ok;
  end if;
  if ok then
    delete from work_shift_pin_attempts where pin_name = 'work_shifts';
    return true;
  end if;

  next_failed_count := case
    when attempt_row.pin_name is null or attempt_row.last_failed_at < now() - interval '15 minutes' then 1
    else attempt_row.failed_count + 1
  end;
  insert into work_shift_pin_attempts (pin_name, failed_count, locked_until, last_failed_at)
  values ('work_shifts', next_failed_count, case when next_failed_count >= 5 then now() + interval '5 minutes' end, now())
  on conflict (pin_name) do update
    set failed_count = excluded.failed_count, locked_until = excluded.locked_until, last_failed_at = excluded.last_failed_at;
  return false;
end;
$$;

create or replace function save_work_shift_day(
  p_shift_date date,
  p_sergiy text[],
  p_oleksandr text[],
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
     or not coalesce(p_oleksandr, '{}') <@ array['day','night','night_half2','rest']::text[] then
    raise exception 'invalid work shift type';
  end if;

  if cardinality(coalesce(p_sergiy, '{}')) = 0 and cardinality(coalesce(p_oleksandr, '{}')) = 0 then
    delete from work_shifts where shift_date = p_shift_date;
  else
    insert into work_shifts (shift_date, month_key, sergiy, oleksandr, updated_at)
    values (p_shift_date, to_char(p_shift_date, 'YYYY-MM'), coalesce(p_sergiy, '{}'), coalesce(p_oleksandr, '{}'), now())
    on conflict (shift_date) do update
      set month_key = excluded.month_key,
          sergiy = excluded.sergiy,
          oleksandr = excluded.oleksandr,
          updated_at = excluded.updated_at;
  end if;
  return true;
end;
$$;

create or replace function update_work_shift_names(p_employee_one_name text, p_employee_two_name text, attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_work_shifts_pin(attempt) then return false; end if;
  if char_length(trim(coalesce(p_employee_one_name, ''))) not between 1 and 40
     or char_length(trim(coalesce(p_employee_two_name, ''))) not between 1 and 40 then
    raise exception 'invalid employee name';
  end if;
  update work_shift_settings
  set employee_one_name = trim(p_employee_one_name), employee_two_name = trim(p_employee_two_name)
  where id = 1;
  return true;
end;
$$;

create or replace function reset_work_shifts_month(p_month_key text, attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_work_shifts_pin(attempt) then return false; end if;
  if p_month_key !~ '^[0-9]{4}-[0-9]{2}$' then return false; end if;
  delete from work_shifts where month_key = p_month_key;
  return true;
end;
$$;

drop policy if exists "work shifts insert" on work_shifts;
drop policy if exists "work shifts update" on work_shifts;
drop policy if exists "work shifts delete" on work_shifts;

revoke all on table work_shift_auth from anon, authenticated;
revoke all on table work_shift_settings from anon, authenticated;
grant select on table work_shift_settings to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'work_shift_settings'
  ) then
    alter publication supabase_realtime add table work_shift_settings;
  end if;
end;
$$;

revoke all on function verify_work_shifts_pin(text) from public;
revoke all on function save_work_shift_day(date, text[], text[], text) from public;
revoke all on function update_work_shift_names(text, text, text) from public;
revoke all on function reset_work_shifts_month(text, text) from public;
grant execute on function verify_work_shifts_pin(text) to anon, authenticated;
grant execute on function save_work_shift_day(date, text[], text[], text) to anon, authenticated;
grant execute on function update_work_shift_names(text, text, text) to anon, authenticated;
grant execute on function reset_work_shifts_month(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
