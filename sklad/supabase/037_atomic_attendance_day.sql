-- Merge concurrent changes to different days/roles without replacing the month.
create or replace function public.save_attendance_day(
  p_month_key text,
  p_day integer,
  p_role text,
  p_check_in text,
  p_break_start text,
  p_break_end text,
  p_check_out text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
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

  day_key := p_day::text;
  current_data := jsonb_build_object(day_key, jsonb_build_object(p_role, jsonb_build_object(
    'checkIn', coalesce(p_check_in,''), 'breakStart', coalesce(p_break_start,''),
    'breakEnd', coalesce(p_break_end,''), 'checkOut', coalesce(p_check_out,'')
  )));
  insert into public.osbb_attendance as existing(month_key,data,updated_at)
  values(p_month_key,current_data,now())
  on conflict(month_key) do update set
    data = jsonb_set(coalesce(existing.data,'{}'::jsonb),array[day_key],
      coalesce(existing.data->day_key,'{}'::jsonb) || (excluded.data->day_key),true),
    updated_at=excluded.updated_at;

  return true;
end;
$$;

revoke execute on function public.save_attendance_day(text, integer, text, text, text, text, text) from public;
grant execute on function public.save_attendance_day(text, integer, text, text, text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

