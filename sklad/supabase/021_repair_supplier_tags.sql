-- Повторно створює хмарні теги постачальників у базах, де міграція 010 не була застосована.

create table if not exists inventory_supplier_tags (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table inventory_supplier_tags enable row level security;

grant select, insert, delete on table inventory_supplier_tags to anon, authenticated;
grant usage, select on sequence inventory_supplier_tags_id_seq to anon, authenticated;

drop policy if exists "supplier tags select" on inventory_supplier_tags;
create policy "supplier tags select" on inventory_supplier_tags
  for select to anon, authenticated using (true);

drop policy if exists "supplier tags insert" on inventory_supplier_tags;
create policy "supplier tags insert" on inventory_supplier_tags
  for insert to anon, authenticated with check (true);

drop policy if exists "supplier tags delete" on inventory_supplier_tags;
create policy "supplier tags delete" on inventory_supplier_tags
  for delete to anon, authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_supplier_tags'
  ) then
    alter publication supabase_realtime add table inventory_supplier_tags;
  end if;
end;
$$;

notify pgrst, 'reload schema';

