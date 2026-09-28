-- Остаточне видалення архіву застарілого журналу (вересень 2026).
-- Схема archive з 031 (chat/schedule/dispatcher/osbb_telegram_config) більше
-- не потрібна — видалено на прохання користувача, дані не відновлюються.

drop schema if exists archive cascade;
