# Osbb

PWA-застосунок для ОСББ "Микитська Слобода". Репозиторій містить статичну оболонку, журнал чергувань і модуль складу, які працюють із Supabase та можуть встановлюватися як мобільний web app.

> **Липень 2026**: журнал ОСББ і Склад об'єднані в один спільний Supabase-проєкт (`vkwkyhjjjmcpmiakxohw`). Окремий проєкт журналу видалено після перевірки. Нижче в тексті всі згадки "проєкту складу" стосуються цієї єдиної бази — окремої бази журналу більше не існує.

## Структура

| Шлях | Призначення |
| --- | --- |
| `index.html` | Shell-оболонка з PIN-входом, єдиним меню всіх розділів (бічна панель на комп'ютері, нижнє меню + лист «Ще» на телефоні), екраном «Головна», звітом для керівництва (PDF за день/тиждень/місяць) та iframe-завантаженням модулів; підключає TypeScript entrypoint `src/shell.ts` через Vite. |
| `osbb/index.html` | Журнал ОСББ: виконані роботи (разом із ліфтером), сміття, графік змін і табель. Старі журнал чергувань, графіки, чат, диспетчер і Jira-заявки видалені. |
| `sklad/index.html` | Склад: товари, видача, приходи, інвентаризація, фото, QR, графіки та Excel-експорт. |
| `src/*.ts`, `src/*.js` | TypeScript-шар shell, спільний Supabase transport, чисті доменні модулі та browser-runnable JS fallback для журналу і складу. |
| `src/database.types.ts` | TypeScript-типи Supabase-сутностей і RPC, які реально викликає клієнт (підтримуються вручну). |
| `package.json`, `tsconfig.json`, `vite.config.ts` | Мінімальна Vite + TypeScript інфраструктура для поступової міграції shell-оболонки; build збирає shell, journal і sklad як MPA entrypoints. |
| `manifest.json`, `sw.js` | PWA manifest і єдиний service worker (scope `/Osbb/`), який обслуговує shell, журнал і склад. |
| `sklad/supabase/*.sql` | Актуальні SQL-міграції єдиного проєкту, пронумеровані в порядку виконання (`001_...` → `043_digest_show_absence.sql`). |
| `sklad/supabase/functions/photo-cleanup` | Supabase Edge Function, що видаляє з бакета `photos` файли, на які більше ніщо не посилається (`034`). |

## Як працює авторизація

- PIN для входу не зберігається у фронтенді відкритим текстом.
- Клієнт викликає Supabase RPC-функції для перевірки PIN.
- Після успішного входу стан сесії зберігається в `sessionStorage` як `auth=ok` у межах поточної вкладки/сесії браузера.
- SQL-скрипти містять прикладові PIN-и для першого налаштування — перед production-використанням їх потрібно замінити у Supabase Dashboard.

## Supabase

Один спільний проєкт (`vkwkyhjjjmcpmiakxohw`) для журналу й складу. Перед деплоєм перевірте, що в ньому створені таблиці, RPC-функції, RLS-політики та Storage bucket-и, які використовуються фронтендом.

Основні сутності, які видно з коду:

- журнал: `photos`, `garbage`, `completed_work`, `elevator_visits`, `work_shifts`, `work_shift_settings`, `work_shift_auth`, `osbb_staff`, `osbb_attendance`, `osbb_app_auth`;
- склад: `inventory_items`, `inventory_logs`, `inventory_receipts`, `inventory_audits`, `inventory_audit_items`, `inventory_supplier_tags`, `app_auth`, `telegram_config`;
- спільне: `pin_throttle` (ліміт спроб PIN по IP, `033`);
- RPC журналу: `verify_lock_pin`, `verify_reset_pin`, `list_osbb_staff`, `verify_staff_pin`, `save_attendance_day`, `save_completed_work`, `delete_completed_work`, `save_garbage_day`, `reset_month`, `verify_work_shifts_pin`, `save_work_shift_day_v2`, `update_work_shift_names_v2`, `reset_work_shifts_month`, `delete_photo`;
- RPC складу: `verify_pin`, `issue_item`, `receive_item`, `update_inventory_log`, `update_inventory_receipt`, `complete_inventory_audit`, `delete_inventory_item`, `delete_inventory_log`, `delete_inventory_receipt`;
- Storage bucket: `photos` (фото складу без префіксу, фото чергувань журналу — під `osbb-duty/`).

Журнал і склад технічно зберігають окремі auth-таблиці для сумісності, але після `026_unify_main_pin_keep_shifts_separate.sql` використовують один основний PIN для входу й підтверджень. Лише розділ «Зміни» має окремий PIN у `work_shift_auth`.

## Порядок виконання SQL у Supabase

Для нового розгортання виконайте всі файли з `sklad/supabase/` **по порядку номерів** (`001_...` → `043_...`) — кожен наступний може залежати від попереднього:

1. `001_setup_pin_auth.sql` — PIN входу та server-side lockout для складу.
2. `002_receipts_table.sql` — таблиця `inventory_receipts`. На вже налаштованому проєкті це no-op (`if not exists`).
3. `003_add_internal_use_flag.sql` — додає поле `is_internal` до `inventory_items`. Без нього кнопка "Додати товар" впаде з помилкою.
4. `004_add_price_tracking.sql` — опційні поля ціни (`price_unit`, джерело, URL, час перевірки) в `inventory_items`.
5. `005_merge_osbb_journal.sql` — увесь журнал ОСББ (`schedule`/`garbage`/`dispatcher`/`chat`/`photos` + PIN-и + RPC + тригер сповіщень чату) в тому ж проєкті.
6. `006_atomic_stock_issue_receive.sql` — атомарні RPC `issue_item`/`receive_item` для видачі/приходу складу.
7. `007_enable_realtime.sql` — вмикає Supabase Realtime (`postgres_changes`) на робочих таблицях журналу й складу.
8. `008_document_undocumented_functions.sql` — документує RPC (`delete_inventory_item`/-`log`/-`receipt`) і Telegram-тригери (`trg_notify_low_stock`/-`log`/-`receipt`), які вже існували в живій базі без SQL-файлу; прибирає мертву таблицю `inventory` (не плутати з `inventory_items`) і переносить розширення `pg_net` зі схеми `public` у `extensions`.
9. `009_add_receipt_purchase_price.sql` — додає ціну закупівлі до історії приходів та атомарно оновлює поточну ціну товару під час поповнення.
10. `010_add_supplier_tags.sql` — синхронізує власні теги постачальників між комп’ютером і мобільними пристроями.
11. `011_add_work_shifts.sql` — додає інтегрований графік змін Сергія та Олександра, realtime і PIN-захищене скидання корекцій місяця.
12. `012_fix_work_shifts_month_key.sql` — виправляє constraint формату місяця у ранніх інсталяціях `011`, через який Supabase відхиляв збереження зміни.
13. `013_secure_work_shifts.sql` — додає окремий PIN графіка, редаговані імена працівників і закриває прямий запис у `work_shifts`; перед виконанням замініть прикладовий PIN `2468` на власний.
14. `014_journal_staff_auth.sql` — персональні staff-акаунти та ролі журналу.
15. `015_add_board_role.sql` — роль «Правління» з повним доступом.
16. `016_add_elevator_log.sql` — журнал приїздів ліфтера.
17. `017_fix_attendance_board_role.sql` — дозволяє ролі `board` зберігати табель.
18. `018_fix_attendance_jsonb_set.sql` — виправляє збереження першого запису дня в табелі.
19. `019_staff_login_settings.sql` — керування персональним PIN-входом.
20. `020_allow_board_manage_staff_access.sql` — дозволяє правлінню керувати доступом працівників.
21. `021_repair_supplier_tags.sql` — безпечно відновлює теги постачальників, права, RLS і Realtime.
22. `022_add_attendance_breaks.sql` — додає початок/кінець обіду до Табеля, серверну валідацію часу та сумісність зі старими записами приходу/відходу.
23. `023_add_completed_work_log.sql` — додає окремий журнал фактично виконаних робіт із захищеним створенням, редагуванням і видаленням.
24. `024_unify_operator_pin.sql` — дозволяє диспетчеру, адміністратору та Правлінню входити із загальним PIN журналу.
25. `025_unify_work_shifts_pin.sql` — історично дозволив загальний PIN журналу для графіка змін.
26. `026_unify_main_pin_keep_shifts_separate.sql` — встановлює один основний PIN для shell, журналу, складу й підтверджень та повертає окремий PIN для розділу «Зміни».
27. `027_remove_attendance_pin.sql` — прибирає окремий PIN Табеля.
28. `028_add_third_shift_employee.sql` — третій співробітник у графіку змін.
29. `029_idempotent_stock_movements.sql` — ідемпотентні `issue_item`/`receive_item` (`p_client_request_id`), атомарне редагування видач/приходів, Telegram-тригер на новий товар, фіксація storage-політик `photos`. Потребує `009`.
30. `030_garbage_day_save.sql` — `save_garbage_day`: журнал сміття зберігає один день, а не перезаписує весь місяць.
31. `031_archive_legacy_journal_tables.sql` — переносить застарілі `chat`/`schedule`/`dispatcher` у закриту схему `archive`, прибирає функції чату, `reset_month` лише для сміття.
32. `032_drop_archive_schema.sql` — остаточно видаляє схему `archive` з цими таблицями.
33. `033_pin_throttle_per_ip.sql` — ліміт невдалих спроб PIN окремо для кожного IP (`cf-connecting-ip`) і загальний запобіжник від перебору з багатьох адрес.
34. `034_photo_orphans.sql` — `photo_orphans()` для Edge Function `photo-cleanup`: прибирання файлів фото, на які більше ніщо не посилається.
35. `035_remove_inactive_staff.sql` — видаляє вимкнені демо-профілі; лишається один профіль «Правління».
36. `036_atomic_inventory_audit.sql` — атомарна ідемпотентна інвентаризація (`complete_inventory_audit`).
37. `037_atomic_attendance_day.sql` — `save_attendance_day` зливає зміни окремих днів/ролей, не перезаписуючи місяць.
38. `038_drop_unused_rpc.sql` — видаляє RPC, які клієнт більше не викликає (v1 графіка змін і керування доступом співробітників).
39. `039_add_min_quantity.sql` — мінімальний залишок товару (`inventory_items.min_quantity`) для списку закупівлі на сторінці «Статистика» складу.
40. `040_daily_telegram_digest.sql` — щоденний підсумок у Telegram о 18:00 за Києвом (`build_daily_digest`/`send_daily_digest` + pg_cron `osbb-daily-digest`).
41. `041_digest_attendance_garbage_only.sql` — підсумок поки що лише з табелем і сміттям (без видач, робіт і ліфтера).
42. `042_completed_work_security.sql` — виконавець «Охорона» у журналі виконаних робіт (лише там, не в табелі).
43. `043_digest_show_absence.sql` — у Telegram-підсумку біля годин показується відсутність працівника, якщо вона є.

`supabase/migrations/` містить timestamp-дзеркала всіх `001_...` → `043_...` SQL-файлів у форматі Supabase CLI. `npm run test:migrations` перевіряє їхню парність. `supabase/functions/` так само дзеркалить Edge Functions зі `sklad/supabase/functions/`, а `npm run test:functions` перевіряє парність і `verify_jwt = false` для `photo-cleanup` (publishable-key клієнт).


Перед production-використанням замініть прикладові PIN-и у Supabase Dashboard на реальні значення. Після виконання SQL перевірте PIN-вхід (обидва контури — журнал і склад), staff-вхід, табель, скидання місяця, видалення фото та складських записів.

## Товари для внутрішнього використання (хознужди)

У Складі товар можна позначити як "внутрішнє використання" (хознужди) — прапорцем при створенні (сторінка "Додати") або значком-перемикачем у списку товарів. Такі товари лишаються на складі й доступні для видачі, але:

- виключаються з підрахунку "позицій на балансі" на сторінці "Статистика";
- позначаються бейджем 🏠 у списку товарів;
- можуть бути приховані кнопкою-перемикачем "Без внутрішніх" (або показані окремо кнопкою "Тільки внутрішні") на сторінці "Товари";
- потрапляють в окремий лист "Баланс" в Excel-експорті з підсумками "на балансі" / "внутрішнє використання".

Застосунок підтримує опційний облік вартості товарів: після виконання `sklad/supabase/004_add_price_tracking.sql` ціну за одиницю можна вказати вручну або під час оприбуткування надходження.

## Telegram-сповіщення про рух товару (Склад)

Сповіщення надсилає сама база даних: тригери `inventory_logs_notify` (видача), `inventory_receipts_notify` (прихід), `inventory_items_new_notify` (новий товар, `029`) і `inventory_items_low_stock_notify` (закінчується) викликають `notify_telegram()` через `pg_net`. Токен бота й chat_id лежать у таблиці `telegram_config` без жодної RLS-policy (default-deny), тому anon-ключем їх не прочитати. Клієнт у Telegram нічого не шле, тож дублів більше немає. Колишню публічну Edge Function `notify-telegram` видалено.

Щодня о 18:00 за Києвом той самий бот надсилає підсумок дня: табель і вивіз сміття (`040`, з `041` — лише ці два розділи; видачі, роботи й ліфтер прибрані на прохання власника). Текст можна подивитися без надсилання: `select public.build_daily_digest();` (або за конкретний день: `select public.build_daily_digest('2026-11-13');`). Надіслати вручну: `select public.send_daily_digest(true);`. Вимкнути: `select cron.unschedule('osbb-daily-digest');`.

## Автоматичні smoke-перевірки

У репозиторії є легкий smoke-check без залежностей, який перевіряє наявність критичних RPC, PIN-flow, iframe-завантаження модулів і scoped service-worker cleanup. Після старту міграції shell-оболонки на Vite + TypeScript частина перевірок читає і `index.html`, і `src/shell.ts`:

```bash
node scripts/smoke-check.mjs
```

Для нового TypeScript-шару shell-оболонки також доступні npm-скрипти. DevDependencies навмисно pinned exact versions, а не `latest`, щоб CI не ламався від неочікуваних major-релізів TypeScript/Vite. `test:runtime` перевіряє browser-runnable JS fallback для shell, `test:unit` запускає unit-тести для pure auth/store логіки без зовнішніх залежностей, а `build` збирає `dist/` для GitHub Pages:

```bash
npm install
npm run typecheck
npm run test:runtime
npm run test:unit
npm run smoke
npm run build
```

## GitHub Pages deploy

`.github/workflows/pages.yml` на кожен PR збирає preview-artifact (`npm install` → `npm run test` → `npm run build` → upload `dist/`), а після push у `main` деплоїть той самий `dist/` через GitHub Pages. Vite збирається з `base: '/Osbb/'`, бо це project site під шляхом `/Osbb/`, а не root-домен. Після Vite-міграції це важливо: production має отримувати зібраний JavaScript, а не сирий `src/shell.ts`. До повного перемикання Pages на Actions `index.html` підключає browser-runnable fallback `src/shell.js`, щоб PIN-екран не лишався без обробників.

`npm run build` після `vite build` запускає `scripts/copy-static-assets.mjs`, який докладає до `dist/` PWA/service-worker файли (`sw.js`, `manifest.json`, іконки та відповідні файли `osbb/`/`sklad/`).

## Можливий професійний перепис

Проєкт почав поступовий перехід на сучасний production-стек із shell-оболонки: її runtime-логіку винесено в `src/shell.ts`, стан і сесію розділено в окремі TypeScript-модулі, а Vite + TypeScript додані як build-шар. Повний перенос журналу й складу все ще не є точковим рефакторингом поточних HTML-файлів, а окремим етапом перепису. Поточна архітектура навмисно проста: статичні сторінки без збірки, спільний PIN і ручне виконання SQL-файлів. Для масштабу одного будинку це зменшує вартість підтримки, але має зрозумілі межі.

Раціональний цільовий стек для такого перепису:

- **Vite + TypeScript** замість Tailwind CDN і inline JavaScript. TypeScript-типи варто генерувати зі схеми Supabase, щоб `inventory_items`, `garbage`, `osbb_attendance` та інші сутності не описувались вручну.
- **Компонентний UI** на React/Vue/Svelte. У цьому масштабі Svelte був би достатньо легким варіантом: `CustomSelect`, `Tooltip`, `StatTile`, skeleton-заглушки, нижня навігація та інші патерни стали б компонентами замість повторюваних HTML-шаблонів у `renderX()`.
- **Явний стан застосунку** замість глобальних змінних на кшталт `allItems`, `currentMonth`, `hideInternal`, `onlyInternal`. Для Svelte це можуть бути вбудовані stores; для React — Zustand або інший малий стор.
- **Нормальні тести**: Vitest для чистої логіки, Testing Library для компонентів і Playwright для e2e-сценаріїв на кшталт входу по PIN, видачі зі складу, інвентаризації та скидання місяця.
- **CI/CD** у GitHub Actions: lint, typecheck, unit/component/e2e тести й preview-деплой на кожен PR.
- **Supabase Auth і реальні RLS-політики** замість спільного PIN та `using(true)`: користувачі, ролі, `auth.uid()`, аудит конкретної особи, яка виконала дію.
- **Supabase CLI migrations** у стандартній папці `supabase/migrations/` з timestamp-файлами, які накочуються автоматично, замість ручного копіювання `sklad/supabase/00X_*.sql` у SQL Editor.
- **Секрети в Supabase Edge Function secrets** для серверних токенів, зокрема Telegram bot-токена, а не в таблицях бази.

Головний компроміс — вартість. Такий перехід має сенс, якщо зʼявляються кілька будинків, більше співробітників, вимога аудиту дій, регулярні релізи або потреба безпечно делегувати доступ різним ролям. Якщо ж застосунок лишається інструментом для одного ОСББ і малої довіреної команди, поточний підхід може бути виправданим, а безпечніший шлях — робити точкові покращення: не дублювати спільний UI, додавати smoke-перевірки, документувати SQL-зміни й поступово виносити найризикованішу логіку на серверні RPC.

## Виправлення аудиту й порядок випуску

Див. [інструкцію міграцій 036–037 та перевірок](docs/audit-fixes.md). Ці міграції потрібно застосувати **перед** випуском нового фронтенду з атомарною інвентаризацією.
