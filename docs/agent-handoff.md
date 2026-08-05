# Agent handoff — Osbb PWA

Use this file at the start of a new agent session to recover the current project context quickly.

## Repository

- Path: `/workspace/Osbb`
- Main app shell: `index.html`
- OSBB journal module: `osbb/index.html`
- Sklad module: `sklad/index.html`
- Smoke checks: `scripts/smoke-check.mjs`

## Current baseline

Before making changes, run:

```bash
git status --short
git log --oneline -8
node scripts/smoke-check.mjs
```

Поточна гілка містить серію малих рефакторингів великих runtime-модулів. Перед
продовженням орієнтуйтеся на фактичний `git log`, бо PR-и можуть бути squash-нуті.

## What has already been done

### 1. Inline handler cleanup / CSP-readiness

Large parts of `index.html`, `osbb/index.html`, and `sklad/index.html` were moved away from inline `onclick`, `onchange`, `oninput`, and similar event attributes.

The UI now primarily uses `data-*` hooks plus centralized `addEventListener` bindings and delegation helpers, including:

- `bindShellControls`
- `bindOsbbStaticControls`
- `bindOsbbPhotoActions`
- `bindOsbbChatActions`
- `bindJournalEntryActions`
- `bindGarbageEntryActions`
- `bindDispatcherEntryActions`
- `bindSkladStaticControls`
- `bindItemActionDelegation`
- `bindPriceBadgeActions`
- `bindAuditListDelegation`
- `bindLogActionDelegation`
- `bindReceiptActionDelegation`
- `bindNewProductMatchActions`
- `bindPhotoCurrentActions`

Do not reintroduce inline event attributes. If a new dynamic UI action is needed, emit a `data-*` hook and handle it through a binder/delegated listener.

### 2. PIN auth TTL / stale session cleanup

PIN auth no longer relies on an indefinitely valid `sessionStorage.auth = 'ok'` flag.

The shell and embedded modules now use a shared timestamp approach:

- `auth_at`
- `AUTH_TTL_MS`
- `EARLY_AUTH_TTL_MS`
- `setAuthSession()`
- `clearAuthSession()`
- `isAuthSessionValid()`

This applies to:

- `index.html`
- `osbb/index.html`
- `sklad/index.html`

If touching auth, preserve timestamp validation and stale key cleanup. The smoke check has guards for this.

### 3. Escaping and URL sanitization

Rendering has been hardened with shared helpers:

- `escapeHtml()`
- `escapeAttr()`
- `safeExternalUrl()`

Photo URLs, lightbox URLs, external price links, chat text, comments, and several dynamic rows were moved toward escaped/sanitized rendering.

Important rule: user-controlled or Supabase-controlled values should not be inserted into HTML without escaping. External URLs should pass through `safeExternalUrl()` and should only render if they are `http:` or `https:`.

### 4. Accessibility improvements

Many modals/lightbox surfaces now expose dialog semantics and focus behavior:

- `role="dialog"`
- `aria-modal="true"`
- `tabindex="-1"`
- `openModal(...)` focus behavior
- keyboard handlers for custom/action controls

Recent accessibility work added focus traps, `Esc` close paths, opener focus restoration, live regions, tab semantics, `aria-current`/`aria-selected` state sync, and labels for several icon-only controls. Continue auditing any newly added custom controls for keyboard support and stable accessible names.

### 5. Модульна міграція runtime

Великі inline-скрипти вже винесені з HTML у браузерні entrypoint-и:

- `src/osbb-app.js`;
- `src/sklad-app.js`.

Чиста логіка поступово винесена в TypeScript-модулі з browser-runnable JS
fallback і unit-тестами:

- спільні: `app-security`, `auth-session`, `shell-state`, `supabase-api`;
- OSBB: `osbb-attendance`, `osbb-dispatcher`, `osbb-elevator`, `osbb-garbage`,
  `osbb-shifts`, `osbb-staff`, `osbb-tickets`;
- Sklad: `sklad-audit`, `sklad-dates`, `sklad-domain`, `sklad-movements`,
  `sklad-pricing`, `sklad-state`, `sklad-suppliers`.

Межа завантаження масивів `inventory_items`, `inventory_logs` та
`inventory_receipts` типізована в `sklad-state`; некоректна відповідь transport
тепер перетворюється на порожній список замість потрапляння в UI-стан. Товари
також відкидають порожні/надмірні `name` і `unit`, нормалізують короткі
текстові метадані та відкидають некоректні timestamps до запису в `allItems`.
Хмарний список тегів постачальників проходить `supplierTagsFromResponse`, тому
malformed-рядки не потрапляють у локальний кеш і кнопки швидкого вибору.
ID заголовка інвентаризації перевіряється через `auditIdFromInsertResponse` перед
створенням дочірніх рядків; без валідного ID операція завершується з UI-помилкою.
Кількість фактичного залишку в інвентаризації проходить strict `parseAuditQuantity`:
підтримує десяткову кому/крапку, але відкидає відʼємні та змішані рядки.
Останні видачі та історія товару також проходять `inventoryLogsFromResponse`, а
некоректні timestamps рухів відкидаються до форматування дат і HTML-рендерингу.
Одиниця виміру з RPC `issue_item`/`receive_item` проходить
`inventoryUnitFromRpcResponse`; malformed-відповідь використовує одиницю товару.
Збережена staff-сесія OSBB проходить `parseStaffSession`; пошкоджені або невідомі
ролі видаляються із `sessionStorage` до застосування role gating.
Відповіді `list_osbb_staff` і `verify_staff_pin` також перевіряються через
`parseStaffList`/`parseStaffSession` до запису персональної сесії.
Місячні дані Табеля, Диспетчера, Змін і журнал ліфтера нормалізуються у
відповідних typed-модулях перед записом cloud/localStorage-відповідей у runtime.
Налаштування імен графіка змін проходять `workShiftNamesFromResponse`; порожні або
некоректні значення Supabase не замінюють чинні fallback-імена в інтерфейсі.
Той самий boundary-підхід застосовано до журналу сміття й списку фото; календарні
ключі обмежені днями 1–31, а дати змін перевіряються як реальні ISO-дати.
ID щойно доданого фото перевіряється через `photoIdFromInsertResponse`; malformed
insert-відповідь використовує локальний fallback ID замість `undefined` у кеші.
Річна відповідь таблиці `garbage` також проходить `garbageYearRowsFromResponse`:
некоректні `month_key` і JSON payload не потрапляють до локального кешу графіка.
Підсумок баків у річному графіку обчислює `garbageMonthBinsTotal`, тому пошкоджені
локальні записи не обнуляють увесь місяць і не викликають помилку рендерингу.
Ручні `database.types.ts` синхронізовано з актуальними staff/attendance/elevator
таблицями та RPC; повну заміну на generated types усе ще слід робити лише після
звірки з живою схемою Supabase.
`createSupabaseRestClient` має generic-контракти для назв таблиць, Row/Insert/Update
та RPC Args/Returns; browser-runnable JS fallback і transport-поведінка не змінені.
REST query builder підтримує всі фактично використані операції, включно з
`update()` через HTTP `PATCH`; цей шлях покрито transport unit-тестом.
OSBB використовує throwing/raw `db.rpc()` зі спільного REST-wrapper, а Sklad —
нативний Supabase JS `db.rpc()` із `{ data, error }`. Не використовуйте
`db.rpcResult()` у Sklad entrypoint: це helper REST-wrapper-а, а не контракт
браузерного Supabase client.
Якщо база ще без міграції 009, перший прихід із ціною може отримати schema/RPC
помилку `receive_item`; після цього Sklad зберігає локальний fallback-прапорець і
наступні приходи йдуть legacy RPC-шляхом без повторних 404, а ціну товару оновлюють
окремим `inventory_items.update()`. Після застосування 009 можна очистити
`sklad_purchase_price_rpc_unavailable_v1` у localStorage, щоб знову писати історію цін.
Storage `upload()` повертає `{data,error}` і не кидає transport exception, щоб
однаково працювали Sklad callback-flow та OSBB `try`/перевірка `error`.

Кожну нову пару `*.ts`/`*.js` потрібно додавати до:

- `scripts/check-js-fallback-parity.mjs`;
- `package.json` → `test:runtime`;
- відповідного combined reader у `scripts/smoke-check.mjs`.

Не дублюйте вже винесену логіку назад у `osbb-app.js` або `sklad-app.js`.

### 6. Sklad mobile UI polish

Recent Sklad mobile fixes:

- Mobile item cards in the light theme now use solid white surfaces, clearer border/shadow, and cleaner ghost buttons.
- Dark theme mobile cards have an explicit override.
- Mobile modals are constrained to the viewport and scroll internally.
- The price lookup modal now uses:
  - `price-search-row`
  - `price-modal-actions`
  - scrollable `#priceResults`
  - sticky close/action row

This specifically addressed screenshots where the light mobile UI looked messy and the price lookup panel could not be closed because the button was below the mobile viewport.

Кастомні списки Складу позиціонуються через `position: fixed`, узгоджено з
viewport-координатами `getBoundingClientRect()`: відкриття категорії в нижній
формі більше не прокручує сторінку до секції поповнення. Категорія модалки
редагування товару також використовує кастомний округлений список.

## Smoke-check status

`node scripts/smoke-check.mjs` was expanded substantially. It currently guards, among other things:

- critical RPC and SQL references;
- no inline event attributes;
- centralized event binders and required `data-*` hooks;
- auth TTL in shell/journal/sklad;
- URL/photo sanitization;
- dialog semantics;
- dynamic Sklad renderers avoiding inline event attributes;
- Sklad mobile price modal scrollability/closeability.

Актуальний baseline на момент оновлення документа: `139` unit-тестів і `245`
smoke-перевірок. Завжди звіряйте фактичний результат `npm test`, а не покладайтеся
лише на ці числа.

## Що залишилося по міграції

Перший етап декомпозиції завершено в серпні 2026: форми рухів і звітність
Складу, фото та календарні підсумки OSBB винесені в чисті модулі; локальний
REST-wrapper журналу замінено спільним `createSupabaseRestClient`. Наступні
зміни слід починати з пріоритету 2, не повторюючи ці extraction-задачі.

### Пріоритет 1 — завершено

Завершені кандидати:

1. **Sklad форми руху товару** — валідація payload для видачі, приходу та
   редагування; формування patch-об'єктів без DOM і Supabase-викликів.
2. **Sklad статистика й експорт** — підготовка агрегатів/рядків Excel окремо від
   DOM та `XLSX`.
3. **OSBB фото** — побудова списку lightbox, нормалізація метаданих і вибір
   попереднього/наступного фото; мережеві upload/delete лишити в orchestrator.
4. **OSBB календар/диспетчер** — винести підсумки місяця та статус дня, не
   переносячи DOM-render функції одним великим комітом.
5. **Спільний Supabase transport** — поступово замінити локальний REST-wrapper в
   `osbb-app.js`, але лише після тестів сумісності всіх `.from()`/`.rpc()` шляхів.

### Пріоритет 2 — перевести entrypoint-и на TypeScript

- Створити `src/osbb-app.ts` та `src/sklad-app.ts` тільки після подальшого
  зменшення файлів; зараз пряме перейменування створить надто великий і ризиковий
  diff.
- Спочатку типізувати межі стану (`allItems`, `allLogs`, `allReceipts`, місячні
  OSBB-дані) та відповіді Supabase.
- Не видаляти JS fallback, доки GitHub Pages гарантовано використовує Vite build.

### Пріоритет 3 — типи Supabase

- Замінити ручний `src/database.types.ts` на типи, згенеровані з актуальної
  Supabase-схеми.
- Після генерації звірити RPC `issue_item`, `receive_item`, PIN/reset/delete RPC
  та таблиці OSBB; не приймати масовий diff без перевірки живої схеми.

### Пріоритет 4 — тести інтеграції

- Частково додано lightweight DOM-flow smoke unit-тести без нових залежностей:
  Sklad PIN, видача через form submit, прихід/новий товар, редагування рухів,
  delegated controls інвентаризації, OSBB staff/PIN guards та dispatcher add/edit
  routing. Sklad date-поля використовують кастомний rounded picker замість нативного popup. Далі, за
  потреби, перевести ці static-flow guards у справжні DOM-тести з виконанням JS.
- E2E/Playwright відкласти до окремого узгодження, бо це нова залежність.
- Поточні pure unit-тести й smoke guards залишаються обов'язковими при кожному
  наступному extraction PR.

### Супутні задачі, не змішувати з міграцією

- Продовжити аудит `innerHTML` і використовувати `escapeHtml`/`escapeAttr` або DOM
  API для даних із Supabase.
- Візуальні зміни виконувати окремо за `docs/ui-redesign-notes.md` зі screenshot,
  щоб рефакторинг логіки залишався перевірюваним і без непомітних UI-регресій.
- Не додавати framework або нові залежності без окремого погодження.

## Working rules for the next agent

- Do not use `ls -R` or `grep -R`; use `rg` and `find`.
- Before changes: check `git status --short` and run relevant smoke checks.
- After changes: run `node scripts/smoke-check.mjs` and `git diff --check`.
- If the UI visibly changes and a browser is available, capture a screenshot.
- Commit changes on the current branch.
- After committing, create a PR with a clear title/body.
- Keep changes small enough to review safely unless the user explicitly asks for a larger batch.
