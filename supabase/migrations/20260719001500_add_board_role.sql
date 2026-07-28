-- Supabase CLI migration mirror for sklad/supabase/015_add_board_role.sql.
-- Keep this file synchronized with the historical SQL file while the project migrates to CLI migrations.

-- Додає роль "Правління" (board) до staff-автентифікації журналу.
-- Доступ необмежений так само, як у dispatcher/admin (усі таби, повне
-- редагування Табеля, створення/видалення заявок), КРІМ вкладки "Зміни" —
-- вона й раніше захищена окремим PIN (verify_work_shifts_pin), не пов'язаним
-- зі staff-ролями, тому жодних додаткових обмежень тут не потрібно.

alter table osbb_staff drop constraint if exists osbb_staff_role_check;
alter table osbb_staff add constraint osbb_staff_role_check
  check (role in ('plumber', 'janitor', 'electrician', 'dispatcher', 'admin', 'board'));

-- Перестворюємо list_osbb_staff, щоб "Правління" сортувалось одразу після
-- Диспетчера/Адміна, а не впереміш з робітниками (else-гілка).
create or replace function list_osbb_staff()
returns table (id uuid, full_name text, role text)
language sql
security definer
set search_path = public
stable
as $$
  select id, full_name, role from osbb_staff where active order by
    case role when 'dispatcher' then 0 when 'admin' then 1 when 'board' then 2 else 3 end, full_name;
$$;

-- ЗАМІНІТЬ '3535' на власний PIN перед виконанням у своїй базі.
insert into osbb_staff (full_name, role, pin_hash) values
  ('Правління', 'board', extensions.crypt('3535', extensions.gen_salt('bf')))
on conflict do nothing;

notify pgrst, 'reload schema';
