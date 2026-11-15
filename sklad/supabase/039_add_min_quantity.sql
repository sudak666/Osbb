-- Мінімальний залишок товару для списку закупівлі (аудит листопада 2026, тиждень 4).
-- null — мінімум не задано: товар не потрапляє в список закупівлі.
-- Фронтенд пише колонку лише через update (редагування товару), INSERT «Додати товар»
-- її не використовує, тож без цієї міграції падає тільки збереження мінімуму.
alter table public.inventory_items add column if not exists min_quantity numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inventory_items'::regclass and conname = 'inventory_items_min_quantity_check'
  ) then
    alter table public.inventory_items
      add constraint inventory_items_min_quantity_check check (min_quantity is null or min_quantity >= 0);
  end if;
end $$;
