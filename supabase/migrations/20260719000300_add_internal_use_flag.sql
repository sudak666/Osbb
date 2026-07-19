-- Supabase CLI migration mirror for sklad/supabase/003_add_internal_use_flag.sql.
-- Keep this file synchronized with the historical SQL file while the project migrates to CLI migrations.

-- Додає прапорець "внутрішнє використання / хознужди" до товарів складу.
-- Такі товари лишаються на складі, але не входять до балансу видаткових
-- товарів (наприклад, оргтехніка, меблі, основні засоби, які не продаються
-- і не видаються остаточно, а просто використовуються ОСББ).
--
-- Виконайте цей скрипт у проєкті складу (vkwkyhjjjmcpmiakxohw) через
-- Supabase SQL Editor.

alter table inventory_items
  add column if not exists is_internal boolean not null default false;

comment on column inventory_items.is_internal is
  'Товар для внутрішнього використання/хознужди — не входить до балансу видаткових товарів';
