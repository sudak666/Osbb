-- Окремий журнал фактично виконаних робіт. Він не пов'язаний із Jira або складом.
create table if not exists public.completed_work (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  worker_role text not null check (worker_role in ('plumber', 'janitor', 'electrician')),
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references public.osbb_staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists completed_work_date_idx on public.completed_work (work_date desc, created_at desc);
alter publication supabase_realtime add table public.completed_work;
alter table public.completed_work enable row level security;
grant select on table public.completed_work to anon, authenticated;
revoke insert, update, delete on table public.completed_work from anon, authenticated;

drop policy if exists "read completed work" on public.completed_work;
create policy "read completed work" on public.completed_work for select to anon, authenticated using (true);

create or replace function public.save_completed_work(
  p_id uuid,
  p_work_date date,
  p_worker_role text,
  p_description text,
  p_note text,
  p_staff_id uuid,
  attempt text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  verify_result record;
  saved_id uuid;
begin
  select * into verify_result from public.verify_staff_pin(p_staff_id, attempt);
  if not verify_result.ok or verify_result.role not in ('dispatcher', 'admin', 'board') then
    return null;
  end if;
  if p_work_date is null or p_worker_role not in ('plumber', 'janitor', 'electrician')
     or char_length(btrim(coalesce(p_description, ''))) not between 1 and 1000
     or char_length(coalesce(p_note, '')) > 500 then
    return null;
  end if;

  if p_id is null then
    insert into public.completed_work (work_date, worker_role, description, note, created_by)
    values (p_work_date, p_worker_role, btrim(p_description), nullif(btrim(coalesce(p_note, '')), ''), p_staff_id)
    returning id into saved_id;
  else
    update public.completed_work
       set work_date = p_work_date,
           worker_role = p_worker_role,
           description = btrim(p_description),
           note = nullif(btrim(coalesce(p_note, '')), ''),
           updated_at = now()
     where id = p_id
     returning id into saved_id;
  end if;
  return saved_id;
end;
$$;

create or replace function public.delete_completed_work(p_id uuid, p_staff_id uuid, attempt text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare verify_result record;
begin
  select * into verify_result from public.verify_staff_pin(p_staff_id, attempt);
  if not verify_result.ok or verify_result.role not in ('dispatcher', 'admin', 'board') then return false; end if;
  delete from public.completed_work where id = p_id;
  return found;
end;
$$;

revoke execute on function public.save_completed_work(uuid, date, text, text, text, uuid, text) from public;
revoke execute on function public.delete_completed_work(uuid, uuid, text) from public;
grant execute on function public.save_completed_work(uuid, date, text, text, text, uuid, text) to anon, authenticated, service_role;
grant execute on function public.delete_completed_work(uuid, uuid, text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
