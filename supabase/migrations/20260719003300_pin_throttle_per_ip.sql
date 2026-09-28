-- Mirror of sklad/supabase/033_pin_throttle_per_ip.sql
-- Keep in sync with the numbered source.

-- Ліміт невдалих спроб PIN по IP клієнта замість одного глобального лічильника.
--
-- Було: 5 помилок від будь-кого блокували перевірку PIN усім на 5 хвилин
-- (DoS), а повільний перебір 4-значного PIN займав ~тиждень.
--
-- IP: заголовок cf-connecting-ip (Cloudflare перед Supabase перезаписує його і
-- блокує запити, де клієнт намагається передати свій, — перевірено на живому
-- проєкті у вересні 2026). Резерв — sb-forwarded-for. X-Forwarded-For НЕ
-- використовується: клієнт може дописати туди будь-що.
--
-- Правила (pin_throttle):
--   * на IP: 5 помилок за 15 хв → блок лише цієї адреси; повторні блоки
--     довшають: 5 хв → 15 хв → 1 год → 4 год (рівень скидається за 24 год
--     без помилок);
--   * глобальний запобіжник на кожен PIN: 30 помилок за 15 хв з будь-яких
--     адрес → блок для всіх на 10 хв (захист від перебору з багатьох IP).
-- Успішний вхід скидає лише лічильник свого IP.
--
-- Логіка звірки самих PIN-хешів у функціях не змінена.

create table if not exists pin_throttle (
  scope text not null,
  client text not null,
  failed_count int not null default 0,
  lock_level int not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  primary key (scope, client)
);
alter table pin_throttle enable row level security;
revoke all on table pin_throttle from public, anon, authenticated;

create or replace function pin_client_ip()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  headers jsonb;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    headers := null;
  end;
  return coalesce(
    nullif(btrim(headers->>'cf-connecting-ip'), ''),
    nullif(btrim(split_part(headers->>'sb-forwarded-for', ',', 1)), ''),
    'unknown'
  );
end;
$$;

create or replace function pin_throttle_blocked(p_scope text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from pin_throttle
    where scope = p_scope
      and client in (pin_client_ip(), '*')
      and locked_until > now()
  );
$$;

create or replace function pin_throttle_fail(p_scope text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client text := pin_client_ip();
  v_row pin_throttle%rowtype;
  v_count int;
  v_level int;
begin
  select * into v_row from pin_throttle where scope = p_scope and client = v_client for update;
  v_count := case when v_row.client is null or v_row.last_failed_at < now() - interval '15 minutes' then 1 else v_row.failed_count + 1 end;
  v_level := case when v_row.client is null or v_row.last_failed_at < now() - interval '24 hours' then 0 else v_row.lock_level end;

  if v_count >= 5 then
    v_level := v_level + 1;
    insert into pin_throttle (scope, client, failed_count, lock_level, locked_until, last_failed_at)
    values (p_scope, v_client, 0, v_level,
            now() + case v_level when 1 then interval '5 minutes' when 2 then interval '15 minutes' when 3 then interval '1 hour' else interval '4 hours' end,
            now())
    on conflict (scope, client) do update
      set failed_count = excluded.failed_count, lock_level = excluded.lock_level,
          locked_until = excluded.locked_until, last_failed_at = excluded.last_failed_at;
  else
    insert into pin_throttle (scope, client, failed_count, lock_level, locked_until, last_failed_at)
    values (p_scope, v_client, v_count, v_level, null, now())
    on conflict (scope, client) do update
      set failed_count = excluded.failed_count, lock_level = excluded.lock_level,
          locked_until = excluded.locked_until, last_failed_at = excluded.last_failed_at;
  end if;

  select * into v_row from pin_throttle where scope = p_scope and client = '*' for update;
  v_count := case when v_row.client is null or v_row.last_failed_at < now() - interval '15 minutes' then 1 else v_row.failed_count + 1 end;
  insert into pin_throttle (scope, client, failed_count, lock_level, locked_until, last_failed_at)
  values (p_scope, '*', case when v_count >= 30 then 0 else v_count end, 0,
          case when v_count >= 30 then now() + interval '10 minutes' end, now())
  on conflict (scope, client) do update
    set failed_count = excluded.failed_count,
        locked_until = coalesce(excluded.locked_until, case when pin_throttle.locked_until > now() then pin_throttle.locked_until end),
        last_failed_at = excluded.last_failed_at;
end;
$$;

create or replace function pin_throttle_success(p_scope text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from pin_throttle where scope = p_scope and client = pin_client_ip();
$$;

revoke all on function pin_client_ip() from public, anon, authenticated;
revoke all on function pin_throttle_blocked(text) from public, anon, authenticated;
revoke all on function pin_throttle_fail(text) from public, anon, authenticated;
revoke all on function pin_throttle_success(text) from public, anon, authenticated;

-- ── Основний PIN (shell/журнал) ─────────────────────────────────────────
create or replace function verify_lock_pin(attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ok boolean;
begin
  if pin_throttle_blocked('lock') then return false; end if;
  select exists (
    select 1 from osbb_app_auth
    where id = 1 and lock_pin_hash = crypt(attempt, lock_pin_hash)
  ) into ok;
  if ok then perform pin_throttle_success('lock'); return true; end if;
  perform pin_throttle_fail('lock');
  return false;
end;
$$;

-- ── PIN підтверджень (скидання місяця, видалення фото) ─────────────────
create or replace function verify_reset_pin(attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ok boolean;
begin
  if pin_throttle_blocked('reset') then return false; end if;
  select exists (
    select 1 from public.osbb_app_auth
    where id = 1 and lock_pin_hash = extensions.crypt(attempt, lock_pin_hash)
  ) into ok;
  if ok then perform pin_throttle_success('reset'); return true; end if;
  perform pin_throttle_fail('reset');
  return false;
end;
$$;

-- ── PIN складу ──────────────────────────────────────────────────────────
create or replace function verify_pin(attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ok boolean;
begin
  if pin_throttle_blocked('login') then return false; end if;
  select exists (
    select 1 from app_auth
    where id = 1 and pin_hash = crypt(attempt, pin_hash)
  ) into ok;
  if ok then perform pin_throttle_success('login'); return true; end if;
  perform pin_throttle_fail('login');
  return false;
end;
$$;

-- ── PIN розділу «Зміни» ─────────────────────────────────────────────────
create or replace function verify_work_shifts_pin(attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ok boolean := false;
begin
  if pin_throttle_blocked('work_shifts') then return false; end if;
  if length(attempt) = 4 and attempt ~ '^[0-9]{4}$' then
    select exists (
      select 1 from public.work_shift_auth
      where id = 1 and pin_hash = extensions.crypt(attempt, pin_hash)
    ) into ok;
  end if;
  if ok then perform pin_throttle_success('work_shifts'); return true; end if;
  perform pin_throttle_fail('work_shifts');
  return false;
end;
$$;

-- ── Персональний PIN співробітника ──────────────────────────────────────
create or replace function verify_staff_pin(p_staff_id uuid, attempt text)
returns table(ok boolean, role text, full_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  staff_row public.osbb_staff%rowtype;
  v_scope text := 'staff:' || p_staff_id::text;
  is_ok boolean := false;
begin
  select * into staff_row from public.osbb_staff where id = p_staff_id and active;
  if staff_row.id is null then
    return query select false, null::text, null::text;
    return;
  end if;

  if pin_throttle_blocked(v_scope) then
    return query select false, null::text, null::text;
    return;
  end if;

  select
    staff_row.pin_hash = extensions.crypt(attempt, staff_row.pin_hash)
    or (
      staff_row.role in ('dispatcher', 'admin', 'board')
      and exists (
        select 1 from public.osbb_app_auth
        where id = 1 and lock_pin_hash = extensions.crypt(attempt, lock_pin_hash)
      )
    )
  into is_ok;

  if is_ok then
    perform pin_throttle_success(v_scope);
    return query select true, staff_row.role, staff_row.full_name;
    return;
  end if;

  perform pin_throttle_fail(v_scope);
  return query select false, null::text, null::text;
end;
$$;

-- Старі глобальні лічильники більше ніде не використовуються.
drop table if exists osbb_app_pin_attempts;
drop table if exists app_pin_attempts;
drop table if exists work_shift_pin_attempts;
drop table if exists osbb_staff_pin_attempts;
