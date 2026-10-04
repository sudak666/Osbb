-- Єдиний користувач застосунку — профіль «Правління».
-- Демо-профілі Диспетчер/Сантехнік/Двірник/Електрик (вимкнені) видаляються.
-- Лічильник спроб PIN — у pin_throttle (033), окремої таблиці спроб уже нема.
-- completed_work.created_by має on delete set null; ролі в Табелі/роботах — окреме поле.
delete from public.osbb_staff
where not active and role <> 'board';
