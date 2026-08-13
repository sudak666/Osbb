# Osbb

PWA-застосунок для ОСББ "Микитська Слобода". Репозиторій містить статичну оболонку, журнал чергувань і модуль складу, які працюють із Supabase та можуть встановлюватися як мобільний web app.

> **Липень 2026**: журнал ОСББ і Склад об'єднані в один спільний Supabase-проєкт (`vkwkyhjjjmcpmiakxohw`). Окремий проєкт журналу видалено після перевірки. Нижче в тексті всі згадки "проєкту складу" стосуються цієї єдиної бази — окремої бази журналу більше не існує.

## Структура

| Шлях | Призначення |
| --- | --- |
| `index.html` | Головна shell-оболонка з PIN-входом, вкладками та iframe-завантаженням модулів; підключає TypeScript entrypoint `src/shell.ts` через Vite. |
| `osbb/index.html` | Журнал ОСББ: заявки/диспетчер, сміття, табель, ліфтер і «Мої заявки». Старі журнал чергувань, графіки та чат видалені. |
| `sklad/index.html` | Склад: товари, видача, приходи, інвентаризація, фото, QR, графіки та Excel-експорт. |
| `src/*.ts`, `src/*.js` | TypeScript-шар shell, спільний Supabase transport, чисті доменні модулі та browser-runnable JS fallback для журналу і складу. |
| `src/database.types.ts` | Базові TypeScript-типи Supabase-сутностей і RPC, підготовлені до заміни на автоматично згенеровані типи зі схеми. |
| `package.json`, `tsconfig.json`, `vite.config.ts` | Мінімальна Vite + TypeScript інфраструктура для поступової міграції shell-оболонки; build збирає shell, journal і sklad як MPA entrypoints. |
| `manifest.json`, `sw.js` | PWA manifest і service worker для shell-оболонки. |
| `osbb/sw.js`, `sklad/sw.js` | Service worker-и вкладених модулів. |
| `supabase/*.sql` | **Історичний архів** — схема окремого проєкту журналу до злиття (див. `supabase/README.md`). Для нового розгортання не потрібні. |
| `sklad/supabase/*.sql` | Актуальні SQL-міграції єдиного проєкту, пронумеровані в порядку виконання (`001_...` → `021_repair_supplier_tags.sql`). |
| `sklad/supabase/functions/notify-telegram` | Supabase Edge Function, що шле Telegram-сповіщення при додаванні/приході/видачі товару зі складу. |

## Як працює авторизація

- PIN для входу не зберігається у фронтенді відкритим текстом.
- Клієнт викликає Supabase RPC-функції для перевірки PIN.
- Після успішного входу стан сесії зберігається в `sessionStorage` як `auth=ok` у межах поточної вкладки/сесії браузера.
- SQL-скрипти містять прикладові PIN-и для першого налаштування — перед production-використанням їх потрібно замінити у Supabase Dashboard.

## Supabase

Один спільний проєкт (`vkwkyhjjjmcpmiakxohw`) для журналу й складу. Перед деплоєм перевірте, що в ньому створені таблиці, RPC-функції, RLS-політики та Storage bucket-и, які використовуються фронтендом.

Основні сутності, які видно з коду:

- журнал: `schedule`, `photos`, `garbage`, `dispatcher`, `work_shifts`, `osbb_staff`, `osbb_attendance`, `elevator_visits`, `osbb_app_auth`, `osbb_app_pin_attempts`;
- склад: `inventory_items`, `inventory_logs`, `inventory_receipts`, `inventory_audits`, `inventory_audit_items`, `app_auth`, `app_pin_attempts`, `telegram_config`;
- RPC: `verify_lock_pin`, `verify_reset_pin`, `list_osbb_staff`, `verify_staff_pin`, `save_attendance_day`, `reset_month`, `reset_work_shifts_month`, `verify_pin`, `issue_item`, `receive_item`, `delete_inventory_item`, `delete_inventory_log`, `delete_inventory_receipt`, `delete_photo`;
- Storage bucket: `photos` (фото складу без префіксу, фото чергувань журналу — під `osbb-duty/`).

Журнал і склад мають окремі `app_auth`-таблиці (`osbb_app_auth` — два PIN, вхід+скидання; `app_auth` складу — один PIN) — це не помилка, а свідоме рішення: два незалежні PIN-контури, а не єдина авторизація.

## Порядок виконання SQL у Supabase

Для нового розгортання виконайте всі файли з `sklad/supabase/` **по порядку номерів** (`001_...` → `021_...`) — кожен наступний може залежати від попереднього:

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

`supabase/migrations/` містить timestamp-дзеркала всіх `001_...` → `022_...` SQL-файлів у форматі Supabase CLI. `npm run test:migrations` перевіряє їхню парність. `supabase/functions/` так само дзеркалить Edge Functions зі `sklad/supabase/functions/`, а `npm run test:functions` перевіряє парність і `verify_jwt = false` у `supabase/config.toml` для publishable-key клієнта.

`supabase/*.sql` (без номерів у назві директорії — лише файли всередині пронумеровані) — **історичний архів**, для нового розгортання не потрібен, див. `supabase/README.md`.

Перед production-використанням замініть прикладові PIN-и у Supabase Dashboard на реальні значення. Після виконання SQL перевірте PIN-вхід (обидва контури — журнал і склад), staff-вхід, табель, скидання місяця, видалення фото та складських записів.

## Товари для внутрішнього використання (хознужди)

У Складі товар можна позначити як "внутрішнє використання" (хознужди) — прапорцем при створенні (сторінка "Додати") або значком-перемикачем у списку товарів. Такі товари лишаються на складі й доступні для видачі, але:

- виключаються з підрахунку "позицій на балансі" на сторінці "Статистика";
- позначаються бейджем 🏠 у списку товарів;
- можуть бути приховані кнопкою-перемикачем "Без внутрішніх" (або показані окремо кнопкою "Тільки внутрішні") на сторінці "Товари";
- потрапляють в окремий лист "Баланс" в Excel-експорті з підсумками "на балансі" / "внутрішнє використання".

Застосунок підтримує опційний облік вартості товарів: після виконання `sklad/supabase/004_add_price_tracking.sql` ціну за одиницю можна вказати вручну або під час оприбуткування надходження.

## Telegram-сповіщення про рух товару (Склад)

`sklad/index.html` викликає Supabase Edge Function `notify-telegram` при додаванні нового товару, приході (поповненні) та видачі. Токен бота ніколи не потрапляє в клієнтський код — він зберігається як секрет на сервері. Після змін у `sklad/supabase/functions/notify-telegram/index.ts` функцію потрібно повторно задеплоїти, інакше GitHub Pages продовжить звертатись до старої серверної версії.

Налаштування (один раз, у проєкті складу `vkwkyhjjjmcpmiakxohw`):

```bash
supabase functions deploy notify-telegram --project-ref vkwkyhjjjmcpmiakxohw --no-verify-jwt
supabase secrets set TELEGRAM_BOT_TOKEN=ваш_токен_від_BotFather --project-ref vkwkyhjjjmcpmiakxohw
supabase secrets set TELEGRAM_CHAT_ID=ваш_chat_id --project-ref vkwkyhjjjmcpmiakxohw
```

`--no-verify-jwt` потрібен тому, що клієнт авторизується новим форматом ключів Supabase (`sb_publishable_...`), який не є JWT. Після деплою перевірте, що додавання/прихід/видача товару в Складі надсилають повідомлення у ваш Telegram-чат.

Швидка перевірка після деплою з Windows PowerShell:

```powershell
npx.cmd supabase@latest secrets list --project-ref vkwkyhjjjmcpmiakxohw

curl.exe -i -X POST "https://vkwkyhjjjmcpmiakxohw.supabase.co/functions/v1/notify-telegram" `
  -H "Content-Type: text/plain;charset=UTF-8" `
  --data-raw "Test Telegram zi skladu OSBB"
```

У списку secrets мають бути `TELEGRAM_BOT_TOKEN` і `TELEGRAM_CHAT_ID`. Успішний тест повертає `{"ok":true}` і надсилає повідомлення в Telegram.

## Jira-заявки

Вкладка «Мої заявки» читає картки безпосередньо через фільтр Jira-дошки `JIRA_BOARD_ID`, тому список і лічильники відповідають цій дошці. Додатково залишаються лише відкриті картки типу `JIRA_ISSUE_TYPE`, які мають Parent. Інтеграція працює лише для перегляду: змінювати, призначати або закривати заявки із застосунку не можна. Якщо `JIRA_BOARD_ID` не задано і в проєкті одна дошка, функція визначає її автоматично; для кількох дощок ID обов’язковий. API-токен і email зберігаються тільки в Supabase Secrets.

```bash
supabase functions deploy jira-issues --project-ref vkwkyhjjjmcpmiakxohw --no-verify-jwt
supabase secrets set \
  JIRA_API_TOKEN=ваш_токен \
  JIRA_EMAIL=guard.mykytska.sloboda@gmail.com \
  JIRA_BASE_URL=https://mykytska-sloboda.atlassian.net \
  JIRA_PROJECT_KEY=MS \
  JIRA_ISSUE_TYPE=Task \
  JIRA_BOARD_ID=ID_ДОШКИ \
  --project-ref vkwkyhjjjmcpmiakxohw
```

Після зміни токена достатньо повторно виконати `supabase secrets set JIRA_API_TOKEN=...`; перевипускати фронтенд не потрібно.

Правління або адміністратор можуть відкрити «Доступ користувачів» у шапці журналу та ввімкнути або вимкнути персональний PIN-вхід для інших користувачів. Після попереднього встановлення `019_staff_login_settings.sql` потрібно також застосувати міграцію `020_allow_board_manage_staff_access.sql`; поточний користувач не може вимкнути власний активний обліковий запис.

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

- **Vite + TypeScript** замість Tailwind CDN і inline JavaScript. TypeScript-типи варто генерувати зі схеми Supabase, щоб `inventory_items`, `schedule`, `garbage`, `dispatcher`, `chat` та інші сутності не описувались вручну.
- **Компонентний UI** на React/Vue/Svelte. У цьому масштабі Svelte був би достатньо легким варіантом: `CustomSelect`, `Tooltip`, `StatTile`, skeleton-заглушки, нижня навігація та інші патерни стали б компонентами замість повторюваних HTML-шаблонів у `renderX()`.
- **Явний стан застосунку** замість глобальних змінних на кшталт `allItems`, `currentMonth`, `hideInternal`, `onlyInternal`. Для Svelte це можуть бути вбудовані stores; для React — Zustand або інший малий стор.
- **Нормальні тести**: Vitest для чистої логіки, Testing Library для компонентів і Playwright для e2e-сценаріїв на кшталт входу по PIN, видачі зі складу, інвентаризації та скидання місяця.
- **CI/CD** у GitHub Actions: lint, typecheck, unit/component/e2e тести й preview-деплой на кожен PR.
- **Supabase Auth і реальні RLS-політики** замість спільного PIN та `using(true)`: користувачі, ролі, `auth.uid()`, аудит конкретної особи, яка виконала дію.
- **Supabase CLI migrations** у стандартній папці `supabase/migrations/` з timestamp-файлами, які накочуються автоматично, замість ручного копіювання `sklad/supabase/00X_*.sql` у SQL Editor.
- **Секрети в Supabase Edge Function secrets** для серверних токенів, зокрема Telegram bot-токена, а не в таблицях бази.

Головний компроміс — вартість. Такий перехід має сенс, якщо зʼявляються кілька будинків, більше співробітників, вимога аудиту дій, регулярні релізи або потреба безпечно делегувати доступ різним ролям. Якщо ж застосунок лишається інструментом для одного ОСББ і малої довіреної команди, поточний підхід може бути виправданим, а безпечніший шлях — робити точкові покращення: не дублювати спільний UI, додавати smoke-перевірки, документувати SQL-зміни й поступово виносити найризикованішу логіку на серверні RPC.
