-- Журнал сміття: збереження одного дня замість перезапису всього місяця.
--
-- Раніше клієнт робив upsert усього JSONB-документа місяця (last-write-wins):
-- двоє людей, що редагують різні дні одночасно, затирали зміни одне одного.
-- save_garbage_day змінює лише ключ свого дня. jsonb_set тут має шлях довжини 1,
-- тож пастка з 018 (create_missing не створює проміжні рівні) не виникає.
--
-- p_row = null або {} видаляє день із документа.
-- security invoker: RLS таблиці garbage і так дозволяє anon insert/update.

create or replace function save_garbage_day(p_month_key text, p_day text, p_row jsonb)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_month_key !~ '^\d{4}-(\d|0\d|1[01])$' then
    raise exception 'invalid_month_key';
  end if;
  if p_day !~ '^(0?[1-9]|[12]\d|3[01])$' then
    raise exception 'invalid_day';
  end if;
  if p_row is not null and jsonb_typeof(p_row) <> 'object' then
    raise exception 'invalid_row';
  end if;

  if p_row is null or p_row = '{}'::jsonb then
    update garbage set data = data - p_day where month_key = p_month_key;
    return true;
  end if;

  insert into garbage (month_key, data)
  values (p_month_key, jsonb_build_object(p_day, p_row))
  on conflict (month_key) do update
    set data = jsonb_set(coalesce(garbage.data, '{}'::jsonb), array[p_day], p_row, true);

  return true;
end;
$$;

revoke all on function save_garbage_day(text, text, jsonb) from public;
grant execute on function save_garbage_day(text, text, jsonb) to anon, authenticated;
