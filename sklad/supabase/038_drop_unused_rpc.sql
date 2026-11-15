-- Прибрати RPC, які клієнт більше не викликає (аудит листопада 2026).
-- Кожна з них доступна anon як SECURITY DEFINER, тож зайві лише розширюють поверхню API.
--
-- • save_work_shift_day / update_work_shift_names (013) — замінені на *_v2 (028,
--   третій співробітник у графіку змін).
-- • list_osbb_staff_settings / set_osbb_staff_active (019/020) — екран
--   «Доступ користувачів» прибрано разом із персональним входом (#578);
--   після 035 у журналі лишився один профіль «Правління».

drop function if exists public.save_work_shift_day(date, text[], text[], text);
drop function if exists public.update_work_shift_names(text, text, text);
drop function if exists public.list_osbb_staff_settings(uuid, text);
drop function if exists public.set_osbb_staff_active(uuid, text, uuid, boolean);
