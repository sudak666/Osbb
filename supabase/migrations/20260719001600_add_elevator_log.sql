-- Supabase CLI migration mirror for sklad/supabase/016_add_elevator_log.sql.
-- Keep this file synchronized with the historical SQL file while the project migrates to CLI migrations.

-- Журнал відміток приїзду ліфтера (буває кілька разів на місяць) — окрема
-- невелика таблиця в тому самому стилі, що й dispatcher/garbage: один рядок
-- на місяць, дані масивом у jsonb. Живе всередині вкладки "Диспетчер".

create table if not exists elevator_visits (
  month_key text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table elevator_visits enable row level security;

-- Свідомо відкритий RLS, як і на решті "робочих" таблиць проєкту (schedule,
-- garbage, dispatcher, chat, photos, inventory_*) — маленька довірена команда,
-- PIN-екран є бар'єром перед UI, не перед даними напряму (див. CLAUDE.md).
create policy "elevator visits select" on elevator_visits for select to anon, authenticated using (true);
create policy "elevator visits insert" on elevator_visits for insert to anon, authenticated with check (true);
create policy "elevator visits update" on elevator_visits for update to anon, authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'elevator_visits'
  ) then
    alter publication supabase_realtime add table elevator_visits;
  end if;
end;
$$;

notify pgrst, 'reload schema';
