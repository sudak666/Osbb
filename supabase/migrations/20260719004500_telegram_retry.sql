-- Mirror of sklad/supabase/045_telegram_retry.sql
-- Keep both copies in sync.

-- Telegram: повтор невдалих відправлень (листопад 2026).
-- 26.11.2026 о 08:09 за Києвом сповіщення про видачу зі складу не дійшло: pg_net не встиг
-- з'єднатися з api.telegram.org за стандартні 5 с (timeout на TCP/TLS), а повторної спроби
-- не було — повідомлення просто губилось. Тепер:
--   * telegram_post() шле з тайм-аутом 20 с;
--   * notify_telegram() кладе кожне повідомлення в telegram_outbox разом з id запиту pg_net;
--   * retry_telegram_outbox() щохвилини (pg_cron 'osbb-telegram-retry') дивиться відповідь у
--     net._http_response: 2xx — доставлено; тайм-аут, помилка мережі, 5xx чи 429 — шле ще раз
--     (до 6 спроб, не старше 6 годин); інші 4xx (неправильний токен/чат) — не повторює.
-- Токен, як і раніше, лише в telegram_config (без policy, default-deny). Черга теж закрита для
-- anon/authenticated: RLS увімкнено без жодної policy, функції — лише для postgres/service_role.

create table if not exists public.telegram_outbox (
  id bigint generated always as identity primary key,
  msg text not null,
  request_id bigint,
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  last_try_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text
);

alter table public.telegram_outbox enable row level security;
revoke all on table public.telegram_outbox from public, anon, authenticated;

create index if not exists telegram_outbox_pending_idx
  on public.telegram_outbox (id)
  where sent_at is null and failed_at is null;

create or replace function public.telegram_post(msg text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg record;
begin
  select bot_token, chat_id into cfg from public.telegram_config where id = 1;
  if cfg.bot_token is null then
    return null;
  end if;
  return net.http_post(
    url := 'https://api.telegram.org/bot' || cfg.bot_token || '/sendMessage',
    body := jsonb_build_object('chat_id', cfg.chat_id, 'text', msg),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 20000
  );
end;
$$;

create or replace function public.notify_telegram(msg text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Помилка сповіщення ніколи не має ламати видачу/надходження (як і раніше).
  insert into public.telegram_outbox (msg, request_id) values (msg, public.telegram_post(msg));
exception when others then
  null;
end;
$$;

create or replace function public.retry_telegram_outbox()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  resp record;
  resent integer := 0;
begin
  for r in
    select * from public.telegram_outbox
    where sent_at is null and failed_at is null
    order by id
    limit 50
  loop
    if r.request_id is null then
      update public.telegram_outbox set failed_at = now(), last_error = 'no telegram_config' where id = r.id;
      continue;
    end if;

    select status_code, timed_out, error_msg into resp from net._http_response where id = r.request_id;

    if found and resp.status_code between 200 and 299 then
      update public.telegram_outbox set sent_at = now() where id = r.id;
      continue;
    end if;

    if found and resp.status_code between 400 and 499 and resp.status_code <> 429 then
      update public.telegram_outbox set failed_at = now(), last_error = 'HTTP ' || resp.status_code where id = r.id;
      continue;
    end if;

    -- Відповіді ще нема — запит у дорозі (тайм-аут 20 с), чекаємо.
    if not found and r.last_try_at > now() - interval '2 minutes' then
      continue;
    end if;

    if r.attempts >= 6 or r.created_at < now() - interval '6 hours' then
      update public.telegram_outbox
        set failed_at = now(),
            last_error = coalesce(resp.error_msg, case when found then 'HTTP ' || resp.status_code else 'no response' end)
        where id = r.id;
      continue;
    end if;

    update public.telegram_outbox
      set request_id = public.telegram_post(r.msg),
          attempts = attempts + 1,
          last_try_at = now(),
          last_error = coalesce(resp.error_msg, case when found then 'HTTP ' || resp.status_code else 'no response' end)
      where id = r.id;
    resent := resent + 1;
  end loop;

  delete from public.telegram_outbox where created_at < now() - interval '30 days';
  return resent;
end;
$$;

revoke all on function public.telegram_post(text) from public, anon, authenticated;
revoke all on function public.notify_telegram(text) from public, anon, authenticated;
revoke all on function public.retry_telegram_outbox() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'osbb-telegram-retry') then
    perform cron.unschedule('osbb-telegram-retry');
  end if;
  perform cron.schedule('osbb-telegram-retry', '* * * * *', 'select public.retry_telegram_outbox()');
end $$;
