# Osbb

PWA-застосунок для ОСББ "Микитська Слобода". Репозиторій містить статичну оболонку, журнал чергувань і модуль складу, які працюють із Supabase та можуть встановлюватися як мобільний web app.

> **Липень 2026**: журнал ОСББ і Склад об'єднані в один спільний Supabase-проєкт (`vkwkyhjjjmcpmiakxohw`). Окремий проєкт журналу видалено після перевірки. Нижче в тексті всі згадки "проєкту складу" стосуються цієї єдиної бази — окремої бази журналу більше не існує.

## Структура

| Шлях | Призначення |
| --- | --- |
| `index.html` | Головна shell-оболонка з PIN-входом, вкладками та iframe-завантаженням модулів; підключає TypeScript entrypoint `src/shell.ts` через Vite. |
| `osbb/index.html` | Журнал ОСББ: чергування, сміття, диспетчер, фото, чат і локальний офлайн-кеш. |
| `sklad/index.html` | Склад: товари, видача, приходи, інвентаризація, фото, QR, графіки та Excel-експорт. |
| `src/shell.ts` | TypeScript-логіка головної shell-оболонки: PIN-вхід, TTL сесії, перемикання iframe-вкладок, idle-lock і service worker registration. |
| `package.json`, `tsconfig.json`, `vite.config.ts` | Мінімальна Vite + TypeScript інфраструктура для поступової міграції shell-оболонки. |
| `manifest.json`, `sw.js` | PWA manifest і service worker для shell-оболонки. |
| `osbb/sw.js`, `sklad/sw.js` | Service worker-и вкладених модулів. |
| `supabase/*.sql` | **Історичний архів** — схема окремого проєкту журналу до злиття (див. `supabase/README.md`). Для нового розгортання не потрібні. |
| `sklad/supabase/*.sql` | Актуальні SQL-міграції єдиного проєкту, пронумеровані в порядку виконання (`001_...` → `005_merge_osbb_journal.sql`). |
| `sklad/supabase/functions/notify-telegram` | Supabase Edge Function, що шле Telegram-сповіщення при додаванні/приході/видачі товару зі складу. |
| `sklad/supabase/functions/fetch-item-prices` | Supabase Edge Function для пошуку орієнтовних цін товарів складу в інтернеті без розкриття API-ключів у фронтенді. |

## Як працює авторизація

- PIN для входу не зберігається у фронтенді відкритим текстом.
- Клієнт викликає Supabase RPC-функції для перевірки PIN.
- Після успішного входу стан сесії зберігається в `sessionStorage` як `auth=ok` у межах поточної вкладки/сесії браузера.
- SQL-скрипти містять прикладові PIN-и для першого налаштування — перед production-використанням їх потрібно замінити у Supabase Dashboard.

## Supabase

Один спільний проєкт (`vkwkyhjjjmcpmiakxohw`) для журналу й складу. Перед деплоєм перевірте, що в ньому створені таблиці, RPC-функції, RLS-політики та Storage bucket-и, які використовуються фронтендом.

Основні сутності, які видно з коду:

- журнал: `schedule`, `photos`, `garbage`, `dispatcher`, `chat`, `osbb_app_auth`, `osbb_app_pin_attempts`, `osbb_telegram_config`;
- склад: `inventory_items`, `inventory_logs`, `inventory_receipts`, `inventory_audits`, `inventory_audit_items`, `app_auth`, `app_pin_attempts`, `telegram_config`;
- RPC: `verify_lock_pin`, `verify_reset_pin`, `reset_month`, `verify_pin`, `delete_inventory_item`, `delete_inventory_log`, `delete_inventory_receipt`, `delete_chat_message`, `delete_photo`;
- Storage bucket: `photos` (фото складу без префіксу, фото чергувань журналу — під `osbb-duty/`).

Журнал і склад мають окремі `app_auth`-таблиці (`osbb_app_auth` — два PIN, вхід+скидання; `app_auth` складу — один PIN) — це не помилка, а свідоме рішення: два незалежні PIN-контури, а не єдина авторизація.

## Порядок виконання SQL у Supabase

Для нового розгортання виконайте файли з `sklad/supabase/` **по порядку номерів** (`001_...` → `008_...`) — кожен наступний може залежати від попереднього:

1. `001_setup_pin_auth.sql` — PIN входу та server-side lockout для складу.
2. `002_receipts_table.sql` — таблиця `inventory_receipts`. На вже налаштованому проєкті це no-op (`if not exists`).
3. `003_add_internal_use_flag.sql` — додає поле `is_internal` до `inventory_items`. Без нього кнопка "Додати товар" впаде з помилкою.
4. `004_add_price_tracking.sql` — опційні поля ціни (`price_unit`, джерело, URL, час перевірки) в `inventory_items`.
5. `005_merge_osbb_journal.sql` — увесь журнал ОСББ (`schedule`/`garbage`/`dispatcher`/`chat`/`photos` + PIN-и + RPC + тригер сповіщень чату) в тому ж проєкті.
6. `006_atomic_stock_issue_receive.sql` — атомарні RPC `issue_item`/`receive_item` для видачі/приходу складу.
7. `007_enable_realtime.sql` — вмикає Supabase Realtime (`postgres_changes`) на робочих таблицях журналу й складу.
8. `008_document_undocumented_functions.sql` — документує RPC (`delete_inventory_item`/-`log`/-`receipt`) і Telegram-тригери (`trg_notify_low_stock`/-`log`/-`receipt`), які вже існували в живій базі без SQL-файлу; прибирає мертву таблицю `inventory` (не плутати з `inventory_items`) і переносить розширення `pg_net` зі схеми `public` у `extensions`.

`supabase/*.sql` (без номерів у назві директорії — лише файли всередині пронумеровані) — **історичний архів**, для нового розгортання не потрібен, див. `supabase/README.md`.

Перед production-використанням замініть прикладові PIN-и у SQL-файлах на реальні значення. Після виконання SQL перевірте PIN-вхід (обидва контури — журнал і склад), скидання місяця, видалення фото/чату та видалення складських записів.

## Товари для внутрішнього використання (хознужди)

У Складі товар можна позначити як "внутрішнє використання" (хознужди) — прапорцем при створенні (сторінка "Додати") або значком-перемикачем у списку товарів. Такі товари лишаються на складі й доступні для видачі, але:

- виключаються з підрахунку "позицій на балансі" на сторінці "Статистика";
- позначаються бейджем 🏠 у списку товарів;
- можуть бути приховані кнопкою-перемикачем "Без внутрішніх" (або показані окремо кнопкою "Тільки внутрішні") на сторінці "Товари";
- потрапляють в окремий лист "Баланс" в Excel-експорті з підсумками "на балансі" / "внутрішнє використання".

Застосунок підтримує опційний облік орієнтовної вартості товарів: після виконання `sklad/supabase/004_add_price_tracking.sql` можна вручну задати ціну за одиницю або підтягнути варіанти з інтернету через Edge Function `fetch-item-prices`. До підтвердження адміністратором ціни вважаються довідковими, бо інтернет-пошук може знайти не ту одиницю виміру або не той товар.

## Інтернет-оцінка цін складу

Ціни стосуються лише таблиці `inventory_items` (модуль Склад) в єдиному Supabase-проєкті `vkwkyhjjjmcpmiakxohw`. Журнальні таблиці (`schedule`/`garbage`/`dispatcher`/`chat`/`photos`) цих полів не мають і SQL для цін на них не впливає.

Налаштування:

```bash
supabase functions deploy fetch-item-prices --project-ref vkwkyhjjjmcpmiakxohw --no-verify-jwt
supabase secrets set SERPAPI_KEY=ваш_serpapi_key --project-ref vkwkyhjjjmcpmiakxohw
# опційно, якщо використовується інший провайдер:
supabase secrets set SHOPAPIS_KEY=ваш_shopapis_key --project-ref vkwkyhjjjmcpmiakxohw
```

Фронтенд викликає Edge Function, отримує кілька варіантів цін і записує в `inventory_items` лише ту ціну, яку користувач натиснув "Взяти" або ввів вручну. API-ключі не потрапляють у `sklad/index.html`.

## Telegram-сповіщення про рух товару (Склад)

`sklad/index.html` викликає Supabase Edge Function `notify-telegram` при додаванні нового товару, приході (поповненні) та видачі. Токен бота ніколи не потрапляє в клієнтський код — він зберігається як секрет на сервері. Після змін у `sklad/supabase/functions/notify-telegram/index.ts` функцію потрібно повторно задеплоїти, інакше GitHub Pages продовжить звертатись до старої серверної версії.

Налаштування (один раз, у проєкті складу `vkwkyhjjjmcpmiakxohw`):

```bash
supabase functions deploy notify-telegram --project-ref vkwkyhjjjmcpmiakxohw --no-verify-jwt
supabase secrets set TELEGRAM_BOT_TOKEN=ваш_токен_від_BotFather --project-ref vkwkyhjjjmcpmiakxohw
supabase secrets set TELEGRAM_CHAT_ID=ваш_chat_id --project-ref vkwkyhjjjmcpmiakxohw
```

`--no-verify-jwt` потрібен тому, що клієнт авторизується новим форматом ключів Supabase (`sb_publishable_...`), який не є JWT. Після деплою перевірте, що додавання/прихід/видача товару в Складі надсилають повідомлення у ваш Telegram-чат.

Той самий бот (токен у таблиці `telegram_config`) шле і сповіщення про повідомлення в чаті журналу — але в інший Telegram-чат: `chat_id` для журналу зберігається окремо, в `osbb_telegram_config` (див. `sklad/supabase/005_merge_osbb_journal.sql`), не в `telegram_config`.

Швидка перевірка після деплою з Windows PowerShell:

```powershell
npx.cmd supabase@latest secrets list --project-ref vkwkyhjjjmcpmiakxohw

curl.exe -i -X POST "https://vkwkyhjjjmcpmiakxohw.supabase.co/functions/v1/notify-telegram" `
  -H "Content-Type: text/plain;charset=UTF-8" `
  --data-raw "Test Telegram zi skladu OSBB"
```

У списку secrets мають бути `TELEGRAM_BOT_TOKEN` і `TELEGRAM_CHAT_ID`. Успішний тест повертає `{"ok":true}` і надсилає повідомлення в Telegram.

## Автоматичні smoke-перевірки

У репозиторії є легкий smoke-check без залежностей, який перевіряє наявність критичних RPC, PIN-flow, iframe-завантаження модулів і scoped service-worker cleanup. Після старту міграції shell-оболонки на Vite + TypeScript частина перевірок читає і `index.html`, і `src/shell.ts`:

```bash
node scripts/smoke-check.mjs
```

Для нового TypeScript-шару shell-оболонки також доступні npm-скрипти:

```bash
npm install
npm run typecheck
npm run build
```

## Можливий професійний перепис

Проєкт почав поступовий перехід на сучасний production-стек із shell-оболонки: її runtime-логіку винесено в `src/shell.ts`, а Vite + TypeScript додані як build-шар. Повний перенос журналу й складу все ще не є точковим рефакторингом поточних HTML-файлів, а окремим етапом перепису. Поточна архітектура навмисно проста: статичні сторінки без збірки, спільний PIN і ручне виконання SQL-файлів. Для масштабу одного будинку це зменшує вартість підтримки, але має зрозумілі межі.

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
