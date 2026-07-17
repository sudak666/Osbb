# Osbb

PWA-застосунок для ОСББ "Микитська Слобода". Репозиторій містить статичну оболонку, журнал чергувань і модуль складу, які працюють із Supabase та можуть встановлюватися як мобільний web app.

> **Липень 2026**: журнал ОСББ і Склад об'єднані в один спільний Supabase-проєкт (`vkwkyhjjjmcpmiakxohw`). Окремий проєкт журналу видалено після перевірки. Нижче в тексті всі згадки "проєкту складу" стосуються цієї єдиної бази — окремої бази журналу більше не існує.

## Структура

| Шлях | Призначення |
| --- | --- |
| `index.html` | Головна shell-оболонка з PIN-входом, вкладками та iframe-завантаженням модулів. |
| `osbb/index.html` | Журнал ОСББ: чергування, сміття, диспетчер, фото, чат і локальний офлайн-кеш. |
| `sklad/index.html` | Склад: товари, видача, приходи, інвентаризація, фото, QR, графіки та Excel-експорт. |
| `manifest.json`, `sw.js` | PWA manifest і service worker для shell-оболонки. |
| `osbb/sw.js`, `sklad/sw.js` | Service worker-и вкладених модулів. |
| `supabase/*.sql` | **Історичний архів** — схема окремого проєкту журналу до злиття (див. `supabase/README.md`). Для нового розгортання не потрібні. |
| `sklad/supabase/*.sql` | Актуальні SQL-міграції єдиного проєкту, пронумеровані в порядку виконання (`001_...` → `005_merge_osbb_journal.sql`). |
| `sklad/supabase/functions/notify-telegram` | Supabase Edge Function, що шле Telegram-сповіщення при додаванні/приході/видачі товару зі складу. |
| `sklad/supabase/functions/fetch-item-prices` | Supabase Edge Function для пошуку орієнтовних цін товарів складу в інтернеті без розкриття API-ключів у фронтенді. |
| `sklad/supabase/functions/ai-assistant` | Supabase Edge Function — ШІ-асистент журналу та складу (Claude API), відповідає на запитання простою мовою на основі поточних даних. Read-only, нічого не пише в базу. |

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

Для нового розгортання виконайте файли з `sklad/supabase/` **по порядку номерів** (`001_...` → `005_...`) — кожен наступний може залежати від попереднього:

1. `001_setup_pin_auth.sql` — PIN входу та server-side lockout для складу.
2. `002_receipts_table.sql` — таблиця `inventory_receipts`. На вже налаштованому проєкті це no-op (`if not exists`).
3. `003_add_internal_use_flag.sql` — додає поле `is_internal` до `inventory_items`. Без нього кнопка "Додати товар" впаде з помилкою.
4. `004_add_price_tracking.sql` — опційні поля ціни (`price_unit`, джерело, URL, час перевірки) в `inventory_items`.
5. `005_merge_osbb_journal.sql` — увесь журнал ОСББ (`schedule`/`garbage`/`dispatcher`/`chat`/`photos` + PIN-и + RPC + тригер сповіщень чату) в тому ж проєкті.

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

## ШІ-асистент журналу та складу

І `osbb/index.html`, і `sklad/index.html` мають рядок швидкого запиту ("Запитайте про журнал: «хто чергує завтра?»…" / "…про склад: «що закінчується?»…") — не окремий чат-екран, а ambient-поле над основним контентом сторінки. Питання йде в спільну Edge Function `ai-assistant`, яка сама читає актуальні дані (`schedule`/`dispatcher`/`garbage` для журналу, `inventory_items` для складу) сервісним ключем і передає їх як контекст у Claude API (Anthropic), повертаючи готову відповідь українською.

Це **read-only** інструмент: асистент лише відповідає на запитання, нічого не пише в базу і не створює заявки/записи. Дії з побічними ефектами (наприклад, "створи заявку голосом") — свідомо окрема, значно ризикованіша задача на майбутнє, не частина цього проходу.

Налаштування (один раз, у єдиному проєкті `vkwkyhjjjmcpmiakxohw`):

```bash
supabase functions deploy ai-assistant --project-ref vkwkyhjjjmcpmiakxohw --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-ваш_ключ_з_console.anthropic.com --project-ref vkwkyhjjjmcpmiakxohw
```

`SUPABASE_URL` і `SUPABASE_SERVICE_ROLE_KEY` Supabase підставляє в кожну Edge Function автоматично — окремо задавати не треба. `--no-verify-jwt` потрібен з тієї ж причини, що й для інших функцій: клієнт авторизується новим форматом ключів Supabase (`sb_publishable_...`), який не є JWT.

**До деплою і без секрету `ANTHROPIC_API_KEY` рядок запиту в застосунку лишається видимим, але при спробі запитати покаже зрозумілу помилку** ("AI assistant is not configured..."), а не мовчки провалиться — фронтенд не падає без бекенду.

## Автоматичні smoke-перевірки

У репозиторії є легкий smoke-check без залежностей, який перевіряє наявність критичних RPC, PIN-flow, iframe-завантаження модулів і scoped service-worker cleanup:

```bash
node scripts/smoke-check.mjs
