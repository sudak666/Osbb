-- Supabase CLI migration mirror for sklad/supabase/012_fix_work_shifts_month_key.sql.
-- Keep this file synchronized with the historical SQL file while the project migrates to CLI migrations.

-- Виправляє regex month_key з першої версії інтеграції графіка змін.
-- Попередній escaped-шаблон відхиляв валідні значення на кшталт 2026-07.

alter table work_shifts
  drop constraint if exists work_shifts_month_key_check;

alter table work_shifts
  add constraint work_shifts_month_key_check
  check (month_key ~ '^[0-9]{4}-[0-9]{2}$');

notify pgrst, 'reload schema';
