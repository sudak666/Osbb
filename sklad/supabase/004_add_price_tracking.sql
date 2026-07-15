-- Price tracking for the Sklad Supabase project only.
-- Project: vkwkyhjjjmcpmiakxohw (do not run this in the main OSBB/journal DB).
-- Adds optional price fields to inventory_items. Existing rows keep working; prices
-- can be filled manually or confirmed from the fetch-item-prices Edge Function.

alter table public.inventory_items
  add column if not exists price_unit numeric(12,2) check (price_unit is null or price_unit >= 0),
  add column if not exists price_source text,
  add column if not exists price_url text,
  add column if not exists price_checked_at timestamptz,
  add column if not exists price_confidence text check (price_confidence is null or price_confidence in ('manual','internet','low','medium','high'));

comment on column public.inventory_items.price_unit is 'Орієнтовна ціна за одиницю в грн для складського балансу.';
comment on column public.inventory_items.price_source is 'Джерело ціни: ручне введення, магазин, API або пошук.';
comment on column public.inventory_items.price_url is 'Посилання на сторінку товару/пошуку, якщо ціна підтягнута з інтернету.';
comment on column public.inventory_items.price_checked_at is 'Дата й час останньої перевірки/підтвердження ціни.';
comment on column public.inventory_items.price_confidence is 'Походження/якість ціни: manual або internet; reserved: low/medium/high.';
