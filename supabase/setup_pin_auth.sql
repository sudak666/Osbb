-- Налаштування серверної перевірки PIN-кодів для застосунку.
-- Виконати ОДИН РАЗ у Supabase Dashboard -> SQL Editor.
--
-- Ідея: самі PIN-коди ніде не зберігаються у відкритому вигляді і не
-- потрапляють в код застосунку (index.html). Клієнт лише викликає
-- RPC-функції verify_lock_pin(attempt) / verify_reset_pin(attempt),
-- які повертають true/false. Таблиця з хешами PIN закрита від прямого
-- читання/запису анонімним ключем (RLS без політик).

-- У Supabase розширення за замовчуванням встановлюється в схему "extensions",
-- тому явно вказуємо її, а функції нижче додають цю схему в свій search_path.
create extension if not exists pgcrypto with schema extensions;

create table if not exists app_auth (
  id int primary key default 1,
  lock_pin_hash text not null,
  reset_pin_hash text not null,
  constraint app_auth_single_row check (id = 1)
);

alter table app_auth enable row level security;
-- Політик доступу свідомо не додаємо: ні anon, ні authenticated
-- не можуть напряму читати/змінювати цю таблицю через REST/JS SDK.

-- Задати (або змінити) PIN-коди. Замініть '3535' та '3333' на свої значення.
-- lock_pin_hash  -- PIN входу в застосунок (екран блокування)
-- reset_pin_hash -- PIN для скидання журналу/сміття/диспетчера за місяць
insert into app_auth (id, lock_pin_hash, reset_pin_hash)
values (
  1,
  extensions.crypt('3535', extensions.gen_salt('bf')),
  extensions.crypt('3333', extensions.gen_salt('bf'))
)
on conflict (id) do update
  set lock_pin_hash = excluded.lock_pin_hash,
      reset_pin_hash = excluded.reset_pin_hash;

create or replace function verify_lock_pin(attempt text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from app_auth
    where id = 1 and lock_pin_hash = crypt(attempt, lock_pin_hash)
  );
$$;

create or replace function verify_reset_pin(attempt text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from app_auth
    where id = 1 and reset_pin_hash = crypt(attempt, reset_pin_hash)
  );
$$;

revoke all on function verify_lock_pin(text) from public;
revoke all on function verify_reset_pin(text) from public;
grant execute on function verify_lock_pin(text) to anon, authenticated;
grant execute on function verify_reset_pin(text) to anon, authenticated;

-- Щоб надалі змінити PIN-коди, достатньо повторно виконати INSERT ... ON CONFLICT
-- вище з новими значеннями замість '3535' / '3333'.
