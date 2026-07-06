-- Налаштування серверної перевірки PIN-коду для входу в застосунок.
-- Виконати ОДИН РАЗ у Supabase Dashboard -> SQL Editor.
--
-- Ідея: сам PIN ніде не зберігається у відкритому вигляді і не потрапляє
-- в код застосунку (index.html). Клієнт лише викликає RPC-функцію
-- verify_pin(attempt), яка повертає true/false. Таблиця з хешем PIN
-- закрита від прямого читання/запису анонімним ключем (RLS без політик).

-- У Supabase розширення за замовчуванням встановлюється в схему "extensions",
-- тому явно вказуємо її, а функції нижче додають цю схему в свій search_path.
create extension if not exists pgcrypto with schema extensions;

create table if not exists app_auth (
  id int primary key default 1,
  pin_hash text not null,
  constraint app_auth_single_row check (id = 1)
);

alter table app_auth enable row level security;
-- Політик доступу свідомо не додаємо: ні anon, ні authenticated
-- не можуть напряму читати/змінювати цю таблицю через REST/JS SDK.

-- Серверний throttle для PIN: клієнтський lockout можна обійти прямим
-- RPC-запитом, тому лічильник невдалих спроб зберігаємо в БД.
create table if not exists app_pin_attempts (
  pin_name text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz not null default now()
);

alter table app_pin_attempts enable row level security;
-- Політик також не додаємо: таблиця доступна тільки security definer RPC.

-- Задати (або змінити) PIN-код. Замініть '3535' на свій PIN.
insert into app_auth (id, pin_hash)
values (1, extensions.crypt('3535', extensions.gen_salt('bf')))
on conflict (id) do update set pin_hash = excluded.pin_hash;

create or replace function verify_pin(attempt text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  attempt_row app_pin_attempts%rowtype;
  ok boolean;
  next_failed_count int;
begin
  select * into attempt_row
  from app_pin_attempts
  where pin_name = 'login';

  if attempt_row.locked_until is not null and attempt_row.locked_until > now() then
    return false;
  end if;

  select exists (
    select 1 from app_auth
    where id = 1 and pin_hash = crypt(attempt, pin_hash)
  ) into ok;

  if ok then
    delete from app_pin_attempts where pin_name = 'login';
    return true;
  end if;

  next_failed_count := case
    when attempt_row.pin_name is null or attempt_row.last_failed_at < now() - interval '15 minutes' then 1
    else attempt_row.failed_count + 1
  end;

  insert into app_pin_attempts (pin_name, failed_count, locked_until, last_failed_at)
  values (
    'login',
    next_failed_count,
    case when next_failed_count >= 5 then now() + interval '5 minutes' else null end,
    now()
  )
  on conflict (pin_name) do update
    set failed_count = excluded.failed_count,
        locked_until = excluded.locked_until,
        last_failed_at = excluded.last_failed_at;

  return false;
end;
$$;

revoke all on function verify_pin(text) from public;
grant execute on function verify_pin(text) to anon, authenticated;

-- Щоб надалі змінити PIN, достатньо повторно виконати INSERT ... ON CONFLICT
-- вище з новим значенням замість '3535'.
