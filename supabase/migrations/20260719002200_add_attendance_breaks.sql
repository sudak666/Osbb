-- Supabase CLI migration mirror for sklad/supabase/022_add_attendance_breaks.sql.
-- Keep this file synchronized with the historical SQL file while the project migrates to CLI migrations.

-- Додає до JSONB-клітинки табеля початок і завершення обіду. Сама таблиця
-- лишається сумісною зі старими записами {checkIn, checkOut}; нові ключі
-- зберігаються лише під час наступного редагування дня.

drop function if exists public.save_attendance_day(text, integer, text, text, text, uuid, text);

create or replace function public.save_attendance_day(
  p_month_key text,
  p_day integer,
  p_role text,
  p_check_in text,
  p_break_start text,
  p_break_end text,
  p_check_out text,
  p_staff_id uuid,
  attempt text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  verify_result record;
  current_data jsonb;
  day_key text;
  check_in_minutes integer;
  check_out_minutes integer;
  break_start_minutes integer;
  break_end_minutes integer;
  shift_minutes integer;
  break_start_offset integer;
  break_end_offset integer;
begin
  if p_month_key !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or p_day < 1 or p_day > 31
     or p_role not in ('plumber', 'janitor', 'electrician') then
    return false;
  end if;

  if coalesce(p_check_in, '') !~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(p_break_start, '') !~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(p_break_end, '') !~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(p_check_out, '') !~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    return false;
  end if;

  if (coalesce(p_break_start, '') = '') <> (coalesce(p_break_end, '') = '') then
    -- Дозволяємо поетапне введення обіду; клієнт позначить день незавершеним.
    null;
  elsif coalesce(p_check_in, '') <> '' and coalesce(p_check_out, '') <> ''
        and coalesce(p_break_start, '') <> '' then
    check_in_minutes := split_part(p_check_in, ':', 1)::integer * 60 + split_part(p_check_in, ':', 2)::integer;
    check_out_minutes := split_part(p_check_out, ':', 1)::integer * 60 + split_part(p_check_out, ':', 2)::integer;
    break_start_minutes := split_part(p_break_start, ':', 1)::integer * 60 + split_part(p_break_start, ':', 2)::integer;
    break_end_minutes := split_part(p_break_end, ':', 1)::integer * 60 + split_part(p_break_end, ':', 2)::integer;
    shift_minutes := (check_out_minutes - check_in_minutes + 1440) % 1440;
    break_start_offset := (break_start_minutes - check_in_minutes + 1440) % 1440;
    break_end_offset := (break_end_minutes - check_in_minutes + 1440) % 1440;
    if break_start_offset >= break_end_offset or break_end_offset > shift_minutes then
      return false;
    end if;
  end if;

  select * into verify_result from public.verify_staff_pin(p_staff_id, attempt);
  if not verify_result.ok or verify_result.role not in ('dispatcher', 'admin', 'board') then
    return false;
  end if;

  day_key := p_day::text;
  select coalesce(data, '{}'::jsonb)
    into current_data
    from public.osbb_attendance
    where month_key = p_month_key;
  current_data := coalesce(current_data, '{}'::jsonb);
  current_data := jsonb_set(
    current_data,
    array[day_key],
    coalesce(current_data->day_key, '{}'::jsonb) || jsonb_build_object(
      p_role,
      jsonb_build_object(
        'checkIn', coalesce(p_check_in, ''),
        'breakStart', coalesce(p_break_start, ''),
        'breakEnd', coalesce(p_break_end, ''),
        'checkOut', coalesce(p_check_out, '')
      )
    ),
    true
  );

  insert into public.osbb_attendance (month_key, data, updated_at)
  values (p_month_key, current_data, now())
  on conflict (month_key) do update
    set data = excluded.data,
        updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke execute on function public.save_attendance_day(text, integer, text, text, text, text, text, uuid, text) from public;
grant execute on function public.save_attendance_day(text, integer, text, text, text, text, text, uuid, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
