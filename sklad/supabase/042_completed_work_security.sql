-- Виконавець «Охорона» у журналі виконаних робіт (листопад 2026, на прохання власника).
-- Стосується лише completed_work: у табелі й staff-ролях охорони як і раніше немає.

alter table public.completed_work drop constraint if exists completed_work_worker_role_check;
alter table public.completed_work
  add constraint completed_work_worker_role_check
  check (worker_role in ('plumber', 'janitor', 'electrician', 'security'));

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
  if p_work_date is null or p_worker_role not in ('plumber', 'janitor', 'electrician', 'security')
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
