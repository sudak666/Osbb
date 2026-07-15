-- Вмикає Supabase Realtime (postgres_changes) на таблицях журналу й складу.
-- За замовчуванням жодна таблиця не входить у publication supabase_realtime,
-- тому без цього скрипту підписки на клієнті (osbb/index.html, sklad/index.html)
-- підключаються без помилки, але ніколи не отримують жодної події.
--
-- Виконати ОДИН РАЗ у Supabase SQL Editor (спільний проєкт журналу+складу).

alter publication supabase_realtime add table
  schedule,
  garbage,
  dispatcher,
  chat,
  photos,
  inventory_items,
  inventory_logs,
  inventory_receipts;
