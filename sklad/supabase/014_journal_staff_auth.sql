-- Персональна автентифікація для журналу ОСББ (per-worker PIN) +
-- Табель точного часу приходу/відходу, який редагує тільки Диспетчер/Адмін.
--
-- Контекст: до цієї міграції весь журнал захищав один спільний PIN
-- (osbb_app_auth) без розрізнення "хто саме" відкрив застосунок. Тепер
-- поверх нього додається другий крок — вибір конкретного співробітника
-- зі списку та його особистий PIN. Ролі: сантехнік/двірник/електрик
-- (тільки перегляд свого графіка й заявок), диспетчер/адмін (повне
-- редагування). Ролі "охорона" немає і не додається навмисно.

create extension if not exists pgcrypto with schema extensions;

create table if not exists osbb_staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text not null check (role in ('plumber', 'janitor', 'electrician', 'dispatcher', 'admin')),
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table osbb_staff enable row level security;
-- Політик прямого select/insert/update на цю таблицю немає навмисно —
-- pin_hash не повинен бути читаним anon-ключем. Публічний список
-- співробітників (без pin_hash) віддає функція list_osbb_staff() нижче.

create table if not exists osbb_staff_pin_attempts (
  staff_id uuid primary key references osbb_staff(id) on delete cascade,
  failed_count int not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz not null default now()
);
alter table osbb_staff_pin_attempts enable row level security;

create or replace function list_osbb_staff()
returns table (id uuid, full_name text, role text)
language sql
security definer
set search_path = public
stable
as $$
  select id, full_name, role from osbb_staff where active order by
    case role when 'dispatcher' then 0 when 'admin' then 1 else 2 end, full_name;
$$;

revoke all on function list_osbb_staff() from public;
grant execute on function list_osbb_staff() to anon, authenticated;

create or replace function verify_staff_pin(p_staff_id uuid, attempt text)
returns table (ok boolean, role text, full_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  staff_row osbb_staff%rowtype;
  attempt_row osbb_staff_pin_attempts%rowtype;
  is_ok boolean := false;
  next_failed_count int;
begin
  select * into staff_row from osbb_staff where id = p_staff_id and active;
  if staff_row.id is null then
    return query select false, null::text, null::text;
    return;
  end if;

  select * into attempt_row from osbb_staff_pin_attempts where staff_id = p_staff_id;
  if attempt_row.locked_until is not null and attempt_row.locked_until > now() then
    return query select false, null::text, null::text;
    return;
  end if;

  select (staff_row.pin_hash = crypt(attempt, staff_row.pin_hash)) into is_ok;

  if is_ok then
    delete from osbb_staff_pin_attempts where staff_id = p_staff_id;
    return query select true, staff_row.role, staff_row.full_name;
    return;
  end if;

  next_failed_count := case
    when attempt_row.staff_id is null or attempt_row.last_failed_at < now() - interval '15 minutes' then 1
    else attempt_row.failed_count + 1
  end;
  insert into osbb_staff_pin_attempts (staff_id, failed_count, locked_until, last_failed_at)
  values (p_staff_id, next_failed_count, case when next_failed_count >= 5 then now() + interval '5 minutes' end, now())
  on conflict (staff_id) do update
    set failed_count = excluded.failed_count, locked_until = excluded.locked_until, last_failed_at = excluded.last_failed_at;

  return query select false, null::text, null::text;
end;
$$;

revoke all on function verify_staff_pin(uuid, text) from public;
grant execute on function verify_staff_pin(uuid, text) to anon, authenticated;

-- Приклад співробітників — ЗАМІНІТЬ pin_hash перед виконанням у своїй базі
-- (нижче '1111'/'2222'/'3333'/'4444' — тільки заглушки для демонстрації).
insert into osbb_staff (full_name, role, pin_hash) values
  ('Диспетчер', 'dispatcher', extensions.crypt('1111', extensions.gen_salt('bf'))),
  ('Сантехнік', 'plumber', extensions.crypt('2222', extensions.gen_salt('bf'))),
  ('Двірник', 'janitor', extensions.crypt('3333', extensions.gen_salt('bf'))),
  ('Електрик', 'electrician', extensions.crypt('4444', extensions.gen_salt('bf')))
on conflict do nothing;

-- ==========================================
-- ТАБЕЛЬ: точний час приходу/відходу за роллю на день, редагує лише
-- Диспетчер/Адмін (перевіряється серверно через staff PIN у save_attendance_day).
-- ==========================================
create table if not exists osbb_attendance (
  month_key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table osbb_attendance enable row level security;
create policy "osbb attendance select" on osbb_attendance for select to anon, authenticated using (true);
-- insert/update навмисно без відкритої політики — запис тільки через
-- save_attendance_day, яка сама перевіряє staff PIN і роль.

create or replace function save_attendance_day(
  p_month_key text,
  p_day int,
  p_role text,
  p_check_in text,
  p_check_out text,
  p_staff_id uuid,
  attempt text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  verify_result record;
  current_data jsonb;
  day_key text;
begin
  if p_month_key !~ '^[0-9]{4}-[0-9]{2}$' or p_role not in ('plumber', 'janitor', 'electrician') then
    return false;
  end if;

  select * into verify_result from verify_staff_pin(p_staff_id, attempt);
  if not verify_result.ok or verify_result.role not in ('dispatcher', 'admin') then
    return false;
  end if;

  day_key := p_day::text;
  select coalesce(data, '{}'::jsonb) into current_data from osbb_attendance where month_key = p_month_key;
  current_data := coalesce(current_data, '{}'::jsonb);
  current_data := jsonb_set(
    current_data,
    array[day_key, p_role],
    jsonb_build_object('checkIn', coalesce(p_check_in, ''), 'checkOut', coalesce(p_check_out, '')),
    true
  );

  insert into osbb_attendance (month_key, data, updated_at)
  values (p_month_key, current_data, now())
  on conflict (month_key) do update set data = excluded.data, updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function save_attendance_day(text, int, text, text, text, uuid, text) from public;
grant execute on function save_attendance_day(text, int, text, text, text, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
