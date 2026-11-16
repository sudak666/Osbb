-- Щоденний підсумок (041): у рядку табеля показуємо відсутність, якщо вона є —
-- «11:00–16:00 (3 год, відсутність 12:00–14:00)», щоб години не здавались помилкою.
-- Решта функції як у 041; права зберігаються (create or replace їх не скидає).

create or replace function public.build_daily_digest(p_day date default (now() at time zone 'Europe/Kyiv')::date)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  months text[] := array['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
  roles text[] := array['electrician','janitor','plumber'];
  role_names text[] := array['Електрик','Двірник','Сантехнік'];
  y integer := extract(year from p_day)::integer;
  m integer := extract(month from p_day)::integer;
  d integer := extract(day from p_day)::integer;
  att jsonb;
  cell jsonb;
  garbage_row jsonb;
  minutes integer;
  break_minutes integer;
  i integer;
  lines text[] := array[]::text[];
  bins integer;
begin
  lines := lines || format('📋 Підсумок дня, %s %s', d, months[m]);

  -- Табель
  select data -> d::text into att from public.osbb_attendance where month_key = format('%s-%s', y, lpad(m::text, 2, '0'));
  lines := lines || ''::text || '🕘 Табель:'::text;
  for i in 1 .. array_length(roles, 1) loop
    cell := att -> roles[i];
    if coalesce(cell ->> 'checkIn', '') <> '' and coalesce(cell ->> 'checkOut', '') <> '' then
      minutes := public.digest_minutes(cell ->> 'checkOut') - public.digest_minutes(cell ->> 'checkIn');
      break_minutes := coalesce(public.digest_minutes(cell ->> 'breakEnd') - public.digest_minutes(cell ->> 'breakStart'), 0);
      minutes := greatest(coalesce(minutes, 0) - greatest(break_minutes, 0), 0);
      lines := lines || format('• %s: %s–%s (%s год%s%s)', role_names[i], cell ->> 'checkIn', cell ->> 'checkOut', minutes / 60,
        case when minutes % 60 > 0 then format(' %s хв', minutes % 60) else '' end,
        case when coalesce(cell ->> 'breakStart', '') <> '' and coalesce(cell ->> 'breakEnd', '') <> ''
          then format(', відсутність %s–%s', cell ->> 'breakStart', cell ->> 'breakEnd') else '' end);
    elsif coalesce(cell ->> 'checkIn', '') <> '' then
      lines := lines || format('• %s: прийшов о %s, відхід не відмічено', role_names[i], cell ->> 'checkIn');
    else
      lines := lines || format('• %s: не відмічено', role_names[i]);
    end if;
  end loop;

  -- Сміття (ключ місяця нульовий: листопад = 10, день — '05' або '5')
  select coalesce(data -> lpad(d::text, 2, '0'), data -> d::text) into garbage_row
    from public.garbage where month_key in (format('%s-%s', y, m - 1), format('%s-%s', y, lpad((m - 1)::text, 2, '0')))
    order by (month_key = format('%s-%s', y, m - 1)) desc limit 1;
  bins := coalesce(nullif(garbage_row #>> '{types,bins}', '')::integer, 0);
  if garbage_row is not null and (coalesce(garbage_row ->> 'time', '') <> '' or bins > 0
      or coalesce(nullif(garbage_row #>> '{types,plastic}', '')::integer, 0) > 0
      or coalesce(nullif(garbage_row #>> '{types,glass}', '')::integer, 0) > 0) then
    lines := lines || ''::text || format('🗑 Сміття: вивезено%s%s',
      case when coalesce(garbage_row ->> 'time', '') <> '' then ' о ' || (garbage_row ->> 'time') else '' end,
      case when bins > 0 then format(', баків: %s', bins) else '' end);
  else
    lines := lines || ''::text || '🗑 Сміття: за сьогодні запису немає'::text;
  end if;

  return array_to_string(lines, E'\n');
end;
$$;

revoke all on function public.build_daily_digest(date) from public, anon, authenticated;
