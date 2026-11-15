-- Mirror of sklad/supabase/040_daily_telegram_digest.sql
-- Keep both copies in sync.

-- Щоденний підсумок у Telegram о 18:00 за Києвом (аудит листопада 2026, тиждень 4).
-- Шле той самий бот, що й тригери складу (notify_telegram → telegram_config).
--
-- build_daily_digest(день) лише складає текст — її можна безпечно викликати вручну:
--   select public.build_daily_digest();
-- send_daily_digest() надсилає. pg_cron запускає її о 15:00 і 16:00 UTC, а функція
-- сама перевіряє, що в Києві саме 18-та година, — так розклад не зсувається при
-- переході на літній/зимовий час (той самий прийом, що в school-hw-remind).
-- Обидві функції закриті від anon/authenticated: викликати їх може лише pg_cron/postgres,
-- інакше будь-хто з публічним ключем міг би слати повідомлення в чат.

create or replace function public.digest_minutes(p_time text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then split_part(p_time, ':', 1)::integer * 60 + split_part(p_time, ':', 2)::integer
  end;
$$;

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
  day_start timestamptz := (p_day::timestamp at time zone 'Europe/Kyiv');
  day_end timestamptz := ((p_day + 1)::timestamp at time zone 'Europe/Kyiv');
  att jsonb;
  cell jsonb;
  garbage_row jsonb;
  elevator jsonb;
  minutes integer;
  break_minutes integer;
  i integer;
  lines text[] := array[]::text[];
  work_lines text;
  work_count integer;
  issue_count integer;
  issue_lines text;
  out_of_stock integer;
  below_min integer;
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
      lines := lines || format('• %s: %s–%s (%s год%s)', role_names[i], cell ->> 'checkIn', cell ->> 'checkOut', minutes / 60,
        case when minutes % 60 > 0 then format(' %s хв', minutes % 60) else '' end);
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

  -- Виконані роботи
  select count(*), string_agg('• ' || left(description, 120), E'\n' order by created_at)
    into work_count, work_lines
    from (select description, created_at from public.completed_work where work_date = p_day order by created_at limit 5) w;
  select count(*) into work_count from public.completed_work where work_date = p_day;
  if work_count > 0 then
    lines := lines || ''::text || format('🛠 Виконані роботи: %s', work_count) || work_lines;
  end if;

  -- Ліфтер
  select data into elevator from public.elevator_visits where month_key = format('%s-%s', y, m - 1);
  if elevator is not null and jsonb_typeof(elevator) = 'array' then
    select string_agg('🛗 Ліфтер: ' || left(e ->> 'text', 120), E'\n') into work_lines
      from jsonb_array_elements(elevator) e where (e ->> 'day') = d::text;
    if work_lines is not null then lines := lines || ''::text || work_lines; end if;
  end if;

  -- Склад
  select count(*), string_agg('• ' || item_name || ' — ' || trim(to_char(quantity, 'FM999999990.##')) ||
      case when coalesce(issued_to, '') <> '' then ' (' || issued_to || ')' else '' end, E'\n' order by issued_at)
    into issue_count, issue_lines
    from public.inventory_logs where issued_at >= day_start and issued_at < day_end;
  select count(*) filter (where quantity <= 0 and not coalesce(is_internal, false)),
         count(*) filter (where min_quantity is not null and quantity < min_quantity and not coalesce(is_internal, false))
    into out_of_stock, below_min
    from public.inventory_items;
  lines := lines || ''::text || format('📦 Склад: видач сьогодні — %s', issue_count);
  if issue_count > 0 then lines := lines || issue_lines; end if;
  lines := lines || format('Закінчились: %s%s', out_of_stock,
    case when exists (select 1 from public.inventory_items where min_quantity is not null)
      then format(' · нижче мінімуму: %s', below_min) else '' end);

  return array_to_string(lines, E'\n');
end;
$$;

create or replace function public.send_daily_digest(p_force boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not p_force and extract(hour from now() at time zone 'Europe/Kyiv') <> 18 then
    return false;
  end if;
  perform public.notify_telegram(public.build_daily_digest());
  return true;
end;
$$;

revoke all on function public.digest_minutes(text) from public, anon, authenticated;
revoke all on function public.build_daily_digest(date) from public, anon, authenticated;
revoke all on function public.send_daily_digest(boolean) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'osbb-daily-digest') then
    perform cron.unschedule('osbb-daily-digest');
  end if;
  perform cron.schedule('osbb-daily-digest', '0 15,16 * * *', 'select public.send_daily_digest()');
end $$;
