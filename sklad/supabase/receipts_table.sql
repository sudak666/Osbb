-- Таблиця "Прихід товару" (inventory_receipts) для складу.
-- Виконати ОДИН РАЗ у Supabase Dashboard -> SQL Editor (проєкт складу
-- vkwkyhjjjmcpmiakxohw), якщо таблиці ще немає — наприклад, при розгортанні
-- на новому Supabase-проєкті. На вже налаштованому проєкті `if not exists`
-- робить цей скрипт безпечним для повторного запуску (no-op).
--
-- UI (sklad/index.html, сторінка "Прихід") показує підказку виконати саме
-- цей файл, якщо запит до inventory_receipts падає з помилкою — тому файл
-- має існувати в репозиторії з такою назвою.

create table if not exists inventory_receipts (
  id bigint generated always as identity primary key,
  item_id bigint references inventory_items(id),
  item_name text not null,
  quantity numeric not null,
  supplier text,
  note text,
  received_at timestamptz default now()
);

alter table inventory_receipts enable row level security;

-- Читання, додавання й редагування приходу дозволені anon/authenticated
-- (як і для inventory_items/inventory_logs) — видалення записів навмисно
-- не відкрите тут, воно йде через PIN-захищений RPC delete_inventory_receipt
-- (див. delete_inventory_item/-log/-receipt RPC у README).
create policy "select all" on inventory_receipts
  for select to anon, authenticated using (true);

create policy "insert all" on inventory_receipts
  for insert to anon, authenticated with check (true);

create policy "update all" on inventory_receipts
  for update to anon, authenticated using (true) with check (true);
