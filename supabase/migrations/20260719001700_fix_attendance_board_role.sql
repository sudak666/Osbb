-- Supabase CLI migration mirror for sklad/supabase/017_fix_attendance_board_role.sql.
-- Keep this file synchronized with the historical SQL file while the project migrates to CLI migrations.

-- Фікс: save_attendance_day (014_journal_staff_auth.sql) досі перевіряв
-- verify_result.role not in ('dispatcher', 'admin') -- роль 'board' ("Правління"),
-- додана в 015_add_board_role.sql з необмеженим доступом (крім Змін), туди не
-- потрапила. Наслідок: клієнт показує UI редагування Табеля для board-сесії
-- (isDispatcherSession() включає board), але кожен запис мовчки відхиляється
-- сервером -- саме це й давало "Не вдалося зберегти" для співробітника з роллю
-- Правління.

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
  if not verify_result.ok or verify_result.role not in ('dispatcher', 'admin', 'board') then
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

notify pgrst, 'reload schema';
