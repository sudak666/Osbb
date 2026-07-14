# UI redesign notes — Osbb PWA

This document records the design audit direction and the implementation choices made for future sessions.

## Current design score

**Baseline after the accessibility/security hardening pass: 7/10.**

The app already has strong functional foundations: iOS-inspired shell, glass surfaces, dark mode, keyboard/focus handling, ARIA semantics, escaped renderers and smoke-check guards. The remaining gap is product polish: a consistent token system, cleaner hierarchy, stronger component variants, better spacing, and less visual noise on dense screens.

## Target design direction

Use a **calm premium utility** style:

- iOS Human Interface Guidelines as the base interaction language.
- Linear/Raycast-like clarity for dense operational screens.
- Mostly solid surfaces with selective glass only for shell/topbar/modals.
- Clear distinction between primary, secondary, warning and destructive actions.
- Motion that is subtle, quick and disabled via `prefers-reduced-motion`.

## Implemented in the latest design pass

### Sklad foundational tokens

`sklad/index.html` now has a broader design-token layer:

- semantic accents: `--accent`, `--accent-strong`, `--accent-soft`;
- status colors: `--info`, `--warning`, `--danger`, `--success`;
- surfaces: `--surface-0..3`;
- borders: `--border-subtle`, `--border-strong`;
- typography scale: `--text-xs..--text-display`;
- radius scale: `--radius-xs..--radius-xl`;
- shadow scale: `--shadow-xs..--shadow-lg`;
- motion tokens: `--motion-fast/base/slow`, `--ease-out`, `--ease-spring`.

### Restyled Sklad components

The first implementation pass refreshed:

- body background with layered premium gradients;
- sidebar active/hover states;
- topbar height, title hierarchy and elevation;
- card surfaces with cleaner solid/elevated treatment;
- stat-card depth, active rings and typography;
- inputs with hover/focus states and surface tokens;
- buttons/pills with clearer hierarchy and modern motion;
- modals with updated blur/elevation and softer entrance motion;
- photo thumbnails with cleaner hover/elevation;
- global reduced-motion handling in Sklad.

### Sklad items workflow shell

The next pass started the actual `Товари на складі` screen redesign:

- added an `items-hero` with a product-style headline, contextual copy and clear primary/secondary CTAs;
- kept the alert banner and metric cards, but moved them into a calmer workflow sequence;
- introduced a sticky `items-filter-bar` for stock filters, category pills, search, result summary and reset action;
- added `table-modern` treatment for the desktop inventory table;
- added a smoke-check guard so future sessions keep these layout primitives.

### Sklad insight cards and mobile item cards

The follow-up pass made the items screen calmer and less saturated:

- metric cards now use the `insight-grid` treatment with solid surfaces, subtle top accent lines and reusable `stat-icon` bubbles;
- mobile item cards now use named structure classes (`m-card-head`, `m-card-title`, `m-card-meta`, `m-card-qty`, `m-card-actions`) instead of the previous inline-heavy layout;
- mobile item photos now use the reusable `m-card-photo` class and quantity emphasis is handled through `m-card-qty-value`;
- smoke checks were adjusted to guard the insight-grid shell and the escaped quantity renderer in its new class-based markup.

### Sklad issue workflow form

The `Видача` screen now uses the same calmer workflow language:

- main form card uses `workflow-card`, `workflow-heading`, `workflow-kicker`, `workflow-title`, and `workflow-copy`;
- form fields use `form-stack`, `field-grid`, `info-callout`, `preset-row`, `preset-chip`, and `full-width-action`;
- recent activity uses `side-panel`, `side-panel-title`, and `side-panel-body`;
- smoke checks now guard these workflow form primitives.

### Sklad log list shell

The `Журнал` screen now shares list primitives with the items workflow:

- category filters and search summary use `list-toolbar`, `list-toolbar-row`, `list-search-row`, and `list-summary`;
- desktop journal table now uses the existing `table-modern` shell;
- mobile log rows use `log-mobile-*` structure classes and `icon-action` buttons instead of inline-heavy row markup;
- smoke checks guard the list toolbar/table/mobile-list markers.


### Sklad receipt and audit workflow pass

`Прихід` and `Інвентаризація` now use the same calm workflow/list language as the refreshed items, issue, and log screens:

- receipt search moved into a sticky `receipts-toolbar` with workflow heading/copy and `receipts-search-row`;
- receipts desktop table now uses the shared `table-modern` shell;
- mobile receipt rows use `receipt-mobile-*` structure classes and `icon-action` buttons;
- audit controls moved into a sticky `audit-toolbar` with `audit-search-row`, progress summary, and class-based legend chips;
- dynamic audit rows now use `audit-item`, `audit-item-*`, `audit-qty-input`, and state classes instead of inline layout styles;
- smoke checks guard the receipt/audit workflow primitives.


### OSBB journal header simplification

The OSBB journal header has been split into calmer rows instead of one dense control band:

- `journal-title-row` keeps the app title, network badge, sync badge, and theme selector together;
- `journal-action-row` separates calendar navigation from export/print/reset actions;
- `journal-tabs-row` gives desktop section tabs their own visual row;
- mobile CSS keeps the rows stacked while preserving the existing bottom navigation.


### OSBB static icon/action cleanup

A small follow-up pass started reducing repeated static inline icon/action styling in the journal shell:

- repeated SVG alignment style strings now use `journal-inline-icon`;
- repeated inline action label layout now uses `journal-action-label`;
- journal export/reset buttons now use `journal-action-btn` variants instead of long Tailwind/inline-heavy class stacks;
- smoke checks guard these reusable static classes.


### Sklad manual price modal cleanup

The manual price modal now has a small class-based structure on top of the text-selection fix:

- `manual-price-modal`, `manual-price-title`, `manual-price-form`, `manual-price-note`, and `manual-price-actions` replace the remaining inline layout for that modal;
- the existing selection/focus safeguards remain in place so opening the modal does not leave blue highlighted chrome text;
- smoke checks now cover both the text-selection safeguards and the class-based modal shell.


### Sklad price lookup modal cleanup

The internet price lookup modal now mirrors the class-based manual price modal shell:

- `price-lookup-modal`, `price-lookup-title`, `price-results-panel`, and `price-modal-actions` own the modal layout;
- `price-search-row` is now a real reusable grid class instead of inline grid styles;
- smoke checks guard the class-based price lookup shell while preserving the existing mobile close/scroll behavior.


### Sklad price lookup results cleanup

The dynamic internet price result rows now use reusable classes instead of inline layout styles:

- loading/empty/error states use `price-results-state`;
- found prices render as `price-result-card` with `price-result-main`, `price-result-meta`, `price-result-side`, and `price-result-value`;
- external links keep `safeExternalUrl()` plus `rel="noopener noreferrer"`, while apply actions remain data-driven.


### Sklad item history modal cleanup

The item history modal now follows the same small class-based cleanup pattern:

- title, subtitle, list, empty/loading state, close action, and history rows use `history-modal-*` / `hist-*` classes;
- dynamic history loading/empty rows no longer rely on inline text alignment/color/padding styles;
- smoke checks guard the modal shell and row primitives.


### Sklad barcode scanner modal cleanup

The barcode scanner modal now uses class-based scanner/manual-entry controls:

- title, scanning status, not-found actions, manual barcode entry, and close action use `barcode-modal-*` / `barcode-manual-*` classes;
- manual barcode input/action layout no longer depends on inline flex and sizing styles;
- smoke checks guard the scanner modal shell.

### Sklad QR scanner and chart modal cleanup

The QR scanner and stock chart modals now follow the same modal cleanup path as barcode/history/price dialogs:

- QR title, helper copy, and close action use `qr-modal-*` classes instead of inline title/action styles;
- chart title and close action use `chart-modal-*` classes;
- smoke checks guard both small modal shells so future passes do not reintroduce inline modal chrome.

### Sklad refill item search

The refill form product picker is now searchable using the existing custom select search shell:

- the `refillSel` picker is marked with `data-searchable="1"`;
- its search placeholder is specific to replenishment flow;
- smoke checks guard the searchable refill select marker.

### Sklad product picker search expansion

The searchable product-picker behavior now covers the main long product lists:

- issue, refill, price lookup, and manual price item pickers use the same searchable custom select shell;
- the custom select search input uses a reusable `custom-select-search` class instead of inline sizing styles;
- smoke checks guard the searchable markers for issue/refill/manual price flows.

### Sklad add/refill page shell cleanup

The add/replenishment screen now uses class-based page helpers for the larger form area:

- refill and new-product sections use `add-card`, `add-section-title`, `add-form-stack`, and `add-new-stack`;
- scanner/status/internal-use controls use reusable `add-scanner-btn`, `barcode-add-status`, and `internal-use-toggle` classes;
- the desktop hints and low-stock side cards use `add-help-*` / `add-low-*` classes, guarded by smoke checks.

### Sklad stats page shell cleanup

The statistics page now uses shared class-based panels and grids:

- balance metrics, filter controls, price assessment, and list cards use `stats-*` / `price-assessment-*` classes instead of inline grid/card styles;
- the duplicate `statLow` target was collapsed to a single list card so `renderStats()` has one stable destination;
- smoke checks guard the stats shell classes and the single low-stock target.

### Sklad quick issue and photo modal cleanup

The quick issue and item photo dialogs now use class-based modal chrome:

- quick issue title, stock meta, person presets, and action row use `quick-*` classes;
- photo upload title, current-photo area, file input, status, delete button, and actions use `photo-*` classes;
- smoke checks guard the static quick/photo modal shell markers.

### Sklad confirmation modal cleanup

Delete, delete-log, delete-PIN, and audit confirmation dialogs now share class-based confirmation shells:

- danger confirmation dialogs use `confirm-*` classes for title, body copy, target text, and action rows;
- the delete PIN dialog uses `delete-pin-*` classes and keeps alert semantics on `delPinErr`;
- the audit confirmation dialog uses `audit-confirm-*` classes, and smoke checks guard the confirmation shells plus the PIN keypad sequence.

### Sklad edit movement modal cleanup

Issue-log and receipt edit dialogs now share a class-based edit shell:

- edit titles, subtitles, form stacks, helper notes, and actions use `edit-movement-*` classes;
- receipt delete reuses the shared `confirm-*` confirmation shell;
- smoke checks guard the edit shell markers and the corrected receipt-note wrapper.

### Sklad lightbox and photo preview cleanup

The item photo lightbox and current-photo preview now use class-based image shells:

- lightbox delete button and image use `lightbox-delete-btn` / `lightbox-img`;
- the photo modal preview image and empty state use `photo-current-img` / `photo-empty-state`;
- smoke checks guard the static lightbox shell and dynamic preview class strings.

### Sklad topbar action cleanup

The Sklad topbar now uses class-based title/action helpers instead of inline button/title styles:

- page title and dynamically inserted title icons use `topbar-title` / `topbar-title-icon`;
- chart, price, scanner, receipts, refresh, theme, and Excel actions use `topbar-actions`, `topbar-icon-btn`, `topbar-refresh`, and `topbar-excel-icon`;
- smoke checks guard both the static markup and the dynamic title icon class assignment.

### Sklad price badge renderer cleanup

The item price badge renderer now uses class-based markup for both priced and unpriced states:

- the manual price button uses `price-badge-btn`;
- priced rows use `price-badge-btn has-price`, `price-badge-value`, and `price-badge-source`;
- smoke checks guard the dynamic price badge renderer classes.

### Sklad items table/card cleanup

The desktop items table and mobile item cards now use class-based cells instead of inline color/layout styles:

- index, name, unit, and quantity-unit cells use `table-idx-cell`, `table-name-cell`, `table-unit-cell`, `table-qty-unit`;
- the desktop row action wrapper uses `table-row-actions`;
- the "internal use" badge (desktop table + mobile card) uses `badge-internal` instead of a hardcoded hex background/color;
- smoke checks guard the class-based cells and flag regressions back to the old inline strings.

### OSBB journal sync-status/joke-icon cleanup

The journal's `setSyncStatus`/`gSetStatus` renderers and the dispatcher joke-message array repeated the same inline-flex/vertical-align style strings dozens of times:

- `journal-status-icon-row` / `journal-status-icon-row-tight` replace the repeated `style="display:inline-flex;align-items:center;gap:5px/4px;"` wrapper on every sync-status icon+label span (44 + 5 call sites across `osbb/index.html`);
- `journal-joke-icon` replaces the repeated `vertical-align:-2px` inline style on the 10 dispatcher joke-message icons;
- `journal-daytype-icon` replaces the one-off day-type icon inline style;
- smoke checks guard the new classes and flag regressions back to the old inline strings.

### Sklad log/receipts table cell cleanup

`renderLog()` and `renderReceipts()` shared near-identical inline-styled `<td>` cells for date, item name, quantity, person/supplier, and note columns:

- `log-date-cell`, `log-name-cell`, `log-cat-badge`, `log-person-cell`, `log-note-cell` replace the per-cell inline color/size styles in both renderers;
- `log-qty-out` (indigo, issue log) / `log-qty-in` (green, receipts) plus a shared `log-unit-suffix` replace the inline quantity/unit styling;
- the row action wrapper now reuses the existing `table-row-actions` class instead of a duplicate inline `display:flex;gap:6px`;
- smoke checks guard the new classes and flag regressions back to the old inline strings.

### Sklad audit finish-summary cleanup

`openAuditConfirm()`'s 2x2 stat grid (counted/uncounted/surplus/shortage) built every tile from inline grid/color/padding styles:

- `audit-summary-grid`, `audit-summary-tile`, `audit-summary-value` (with `counted`/`uncounted`/`surplus`/`shortage` color modifiers), `audit-summary-label`, and `audit-summary-warning` replace the inline styles;
- smoke checks guard the new classes and flag regressions back to the old inline strings.

### OSBB journal task-toggle dot cleanup

The day-card and table task checkboxes (per-role task dots) built their `border`/`background` colors inline from `isChecked` on every render:

- `task-check-dot` holds the static shape/transition properties, `is-checked` toggles the checked-state border/background color;
- smoke checks guard the class-based markup and flag regressions back to the old inline ternary style string.

### OSBB garbage yearly chart bar cleanup

The yearly garbage chart rebuilt each bar's full `height`/`width`/`border-radius`/gradient as one inline style string on every render:

- `g-chart-bar` holds the static width/radius/default gradient, `is-current` swaps in the current-month gradient, and only the per-bar `height` stays inline (it's genuinely per-instance data);
- the bar column wrapper now uses the existing Tailwind `flex-1` utility instead of an inline `style="flex:1"`;
- smoke checks guard the new classes and flag regressions back to the old inline ternary.

## Next implementation priorities

### 1. Sklad items screen redesign

Continue after this items/issue/log redesign pass:

- Tighten the hero copy/CTA labels after real-device review and decide whether topbar secondary actions should move into an overflow.
- Consider moving topbar secondary actions into a compact overflow on mobile if real-device review still feels crowded.
- Review `Прихід` and `Інвентаризація` on real devices now that their workflow shells have been refreshed.
- The `#a5b4fc` muted-text color and small icon `font-size`/`vertical-align` spans are still inline in many places across items/log/receipts renderers (not just the items table) — promoting them to a shared token/class is a bigger, separate pass, not scoped to one screen.

### 2. OSBB journal follow-up

- Review the simplified journal header on real devices, especially the title/status row and export actions on narrow screens.
- Continue reducing remaining inline utility-heavy markup in journal sections only in small guarded passes, prioritizing one static shell/list area at a time.

### 3. Component extraction

After the visual direction stabilizes, begin small extraction PRs:

- `styles/tokens.css`;
- `styles/components.css`;
- `styles/sklad.css`;
- later, lightweight JS modules for shared UI helpers.

Do not perform a large rewrite until smoke checks cover the extracted files.

## Guardrails for future sessions

- Do not remove existing accessibility/focus/escaping smoke checks.
- If adding dynamic HTML, escape user/Supabase values with `escapeHtml()` / `escapeAttr()`.
- If adding external links, sanitize via `safeExternalUrl()` and use `rel="noopener noreferrer"` for `_blank`.
- All non-submit buttons should keep `type="button"`.
- Keep icon-only controls labelled.
- Respect `prefers-reduced-motion` when adding animations.
- If a browser is available and visual changes are made, capture a screenshot.
