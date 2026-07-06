# Osbb

PWA-застосунок для ОСББ "Микитська Слобода". Репозиторій містить статичну оболонку, журнал чергувань і модуль складу, які працюють із Supabase та можуть встановлюватися як мобільний web app.

## Структура

| Шлях | Призначення |
| --- | --- |
| `index.html` | Головна shell-оболонка з PIN-входом, вкладками та iframe-завантаженням модулів. |
| `osbb/index.html` | Журнал ОСББ: чергування, сміття, диспетчер, фото, чат і локальний офлайн-кеш. |
| `sklad/index.html` | Склад: товари, видача, приходи, інвентаризація, фото, QR, графіки та Excel-експорт. |
| `manifest.json`, `sw.js` | PWA manifest і service worker для shell-оболонки. |
| `osbb/sw.js`, `sklad/sw.js` | Service worker-и вкладених модулів. |
| `supabase/*.sql` | SQL-скрипти для PIN-перевірки та посилення RLS для журналу. |
| `sklad/supabase/*.sql` | SQL-скрипти для PIN-перевірки складу. |

## Як працює авторизація

- PIN для входу не зберігається у фронтенді відкритим текстом.
- Клієнт викликає Supabase RPC-функції для перевірки PIN.
- Після успішного входу стан сесії зберігається в `sessionStorage` як `auth=ok` у межах поточної вкладки/сесії браузера.
- SQL-скрипти містять прикладові PIN-и для першого налаштування — перед production-використанням їх потрібно замінити у Supabase Dashboard.

## Supabase

Перед деплоєм перевірте, що у відповідних Supabase-проєктах створені таблиці, RPC-функції, RLS-політики та Storage bucket-и, які використовуються фронтендом.

Основні сутності, які видно з коду:

- журнал: `schedule`, `photos`, `garbage`, `dispatcher`, `chat`;
- склад: `inventory_items`, `inventory_logs`, `inventory_receipts`, `inventory_audits`, `inventory_audit_items`;
- RPC: `verify_lock_pin`, `verify_reset_pin`, `reset_month`, `verify_pin`, `delete_inventory_item`, `delete_inventory_log`, `delete_inventory_receipt`;
- Storage bucket: `photos`.

## Порядок виконання SQL у Supabase

Виконуйте SQL тільки у відповідному Supabase-проєкті:

1. Основний ОСББ / журнал: `supabase/setup_pin_auth.sql` — PIN входу, PIN скидання та server-side lockout.
2. Основний ОСББ / журнал: `supabase/harden_rls_delete.sql` — PIN-захищене скидання місяця для `schedule`, `garbage`, `dispatcher`.
3. Основний ОСББ / журнал: `supabase/harden_chat_photos_delete.sql` — PIN-захищене видалення `chat` і `photos`.
4. Склад: `sklad/supabase/setup_pin_auth.sql` — PIN входу та server-side lockout для складу.

Перед production-використанням замініть прикладові PIN-и у SQL-файлах на реальні значення. Після виконання SQL перевірте PIN-вхід, скидання місяця, видалення фото/чату та видалення складських записів.

## Автоматичні smoke-перевірки

У репозиторії є легкий smoke-check без залежностей, який перевіряє наявність критичних RPC, PIN-flow, iframe-завантаження модулів і scoped service-worker cleanup:

```bash
node scripts/smoke-check.mjs
