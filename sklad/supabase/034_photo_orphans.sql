-- Прибирання файлів-«сиріт» у Storage-бакеті photos.
--
-- anon не має delete-політики на storage.objects, тож після delete_photo
-- (журнал) або заміни/видалення фото товару (склад) файл лишався в бакеті й
-- був доступний за прямим посиланням. photo_orphans повертає файли, на які
-- не посилається жодна з двох колонок-власників (перевірено скануванням усіх
-- текстових/JSON-колонок бази у вересні 2026: лише ці дві), і які старші за
-- p_min_age_minutes — щоб не зачепити фото, яке саме зараз завантажується
-- (файл з'являється раніше, ніж посилання на нього).
--
-- Видаляє файли Edge Function photo-cleanup (service role): із SQL файл
-- у Storage не видалити, лише запис у storage.objects.

create or replace function photo_orphans(p_min_age_minutes int default 10)
returns setof text
language sql
stable
security definer
set search_path = public, storage
as $$
  with refs as (
    select photo_url as url from public.inventory_items where photo_url like '%/object/public/photos/%'
    union all
    select url from public.photos where url like '%/object/public/photos/%'
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'photos'
    and o.created_at < now() - make_interval(mins => greatest(coalesce(p_min_age_minutes, 10), 5))
    and not exists (
      select 1 from refs r
      where split_part(split_part(r.url, '/object/public/photos/', 2), '?', 1) = o.name
         or position(o.name in r.url) > 0
    )
  order by o.created_at
  limit 100;
$$;

revoke all on function photo_orphans(int) from public, anon, authenticated;
grant execute on function photo_orphans(int) to service_role;
