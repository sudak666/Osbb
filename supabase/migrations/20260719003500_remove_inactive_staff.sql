-- Mirror of sklad/supabase/035_remove_inactive_staff.sql
-- Keep in sync with the numbered source.

-- Єдиний користувач застосунку — профіль «Правління».
-- Демо-профілі Диспетчер/Сантехнік/Двірник/Електрик (вимкнені) видаляються.
-- completed_work.created_by має on delete set null; ролі в Табелі/роботах — окреме поле.
delete from public.osbb_staff_pin_attempts
where staff_id in (select id from public.osbb_staff where not active and role <> 'board');

delete from public.osbb_staff
where not active and role <> 'board';
