-- Щоденний підсумок у Telegram — о 19:00 за Києвом замість 18:00 (запит власника, листопад 2026).
-- Як і в 040: pg_cron запускає send_daily_digest() двічі (16 і 17 UTC), а функція сама
-- пропускає «не ту» годину — так 19:00 за Києвом влучає і взимку (UTC+2), і влітку (UTC+3).
-- Права на функцію зберігаються (create or replace їх не скидає).

create or replace function public.send_daily_digest(p_force boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not p_force and extract(hour from now() at time zone 'Europe/Kyiv') <> 19 then
    return false;
  end if;
  perform public.notify_telegram(public.build_daily_digest());
  return true;
end;
$$;

revoke all on function public.send_daily_digest(boolean) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'osbb-daily-digest') then
    perform cron.unschedule('osbb-daily-digest');
  end if;
  perform cron.schedule('osbb-daily-digest', '0 16,17 * * *', 'select public.send_daily_digest()');
end $$;
