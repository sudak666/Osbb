-- Графік робочих змін у спільному Supabase журналу.

create table if not exists work_shifts (
  shift_date date primary key,
  month_key text not null check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  sergiy text[] not null default '{}',
  oleksandr text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint work_shifts_sergiy_types check (sergiy <@ array['day','night','night_half2','rest']::text[]),
  constraint work_shifts_oleksandr_types check (oleksandr <@ array['day','night','night_half2','rest']::text[])
);

create index if not exists work_shifts_month_key_idx on work_shifts(month_key);

alter table work_shifts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='work_shifts' and policyname='work shifts select') then
    create policy "work shifts select" on work_shifts for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='work_shifts' and policyname='work shifts insert') then
    create policy "work shifts insert" on work_shifts for insert to anon, authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='work_shifts' and policyname='work shifts update') then
    create policy "work shifts update" on work_shifts for update to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='work_shifts' and policyname='work shifts delete') then
    create policy "work shifts delete" on work_shifts for delete to anon, authenticated using (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='work_shifts'
  ) then
    alter publication supabase_realtime add table work_shifts;
  end if;
end;
$$;

create or replace function reset_work_shifts_month(p_month_key text, attempt text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not verify_reset_pin(attempt) then
    return false;
  end if;
  delete from work_shifts where month_key = p_month_key;
  return true;
end;
$$;

revoke all on function reset_work_shifts_month(text, text) from public;
grant execute on function reset_work_shifts_month(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
