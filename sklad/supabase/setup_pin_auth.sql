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

-- Задати (або змінити) PIN-код. Замініть '3535' на свій PIN.
insert into app_auth (id, pin_hash)
values (1, extensions.crypt('3535', extensions.gen_salt('bf')))
on conflict (id) do update set pin_hash = excluded.pin_hash;

create or replace function verify_pin(attempt text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from app_auth
    where id = 1 and pin_hash = crypt(attempt, pin_hash)
  );
$$;

revoke all on function verify_pin(text) from public;
grant execute on function verify_pin(text) to anon, authenticated;

-- Щоб надалі змінити PIN, достатньо повторно виконати INSERT ... ON CONFLICT
-- вище з новим значенням замість '3535'.
