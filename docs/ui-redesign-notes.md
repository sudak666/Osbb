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

### Sklad recent-issues panel and new-product match cleanup

The issue-screen "Останні видачі" side-panel rows and the add-product "Схожі товари" match rows were built entirely from inline color/layout styles:

- `log-row-main`/`log-row-title`/`log-row-meta`/`log-row-qty` (reusing the existing `log-qty-out` color class) replace the recent-issues row styles;
- `match-empty`, `match-heading`, `match-row`, `match-row-main`, `match-row-title`, `match-row-meta`, `match-row-actions`, and `match-row-btn` replace the similar-item match card styles in `renderNewProductMatches()`;
- smoke checks guard the new classes and flag regressions back to the old inline strings.

### Sklad add-page and stats-page list cleanup

The add-page low-stock sidebar and the stats-page category breakdown, low-stock list, and unpriced-items list all built rows from inline color/layout styles:

- `add-low-empty`/`add-low-row`/`add-low-name` replace `renderAddLow()`'s inline styles;
- `stat-cat-row-head`/`stat-cat-name`/`stat-cat-count` replace the category-breakdown header inline styles (the per-category progress-bar width/color stay inline since they're genuinely per-instance data);
- `stat-low-row`/`stat-low-name`/`stat-low-qty`/`stat-low-empty` replace the low-stock list inline styles;
- `stat-unpriced-row`/`stat-unpriced-main`/`stat-unpriced-title`/`stat-unpriced-meta`/`stat-unpriced-btn`/`stat-unpriced-more` replace the unpriced-items list inline styles, reusing `stat-low-empty` for its "all priced" empty state;
- smoke checks guard the new classes and flag regressions back to the old inline strings.

### Sklad icon-size utility sweep

Started the larger, file-wide cleanup flagged in the previous pass: the Material Symbols `<span class="ms" style="font-size:...;vertical-align:...;">` pattern was repeated ~63 times across `sklad/index.html` (buttons, empty states, headings, badges).

- Added a small set of reusable size utility classes (`ic-10`, `ic-12-2`, `ic-13-2`, `ic-14-2`, `ic-15`, `ic-15-3`, `ic-16`, `ic-16-3`, `ic-18`, `ic-20`, `ic-40`, `ic-48`) covering every distinct font-size/vertical-align combination found in the file;
- mechanically replaced all matching `class="ms" style="font-size:...(;vertical-align:...)?;"` occurrences (and the one `class="badge ..." style="font-size:10px;"` badge) with `class="ms ic-XX[-Y]"`;
- also cleaned the stats-page recent-activity log rows (`renderStats()`'s `statLog` list) into `stat-log-row`/`stat-log-name`/`stat-log-person`/`stat-log-date` classes;
- `msIcon(name,size)` (the helper that builds ad-hoc sized icon spans from a JS parameter) intentionally keeps its inline `style` — the size is a genuine runtime parameter, not a fixed set of values;
- smoke checks guard the new utility classes and flag regressions back to the old inline strings.
- Remaining `style="` in `sklad/index.html` after this pass is skeleton-loader widths, `display:none` state toggles, per-instance dynamic bar widths/colors, and a couple of genuinely one-off styles (e.g. the PIN-screen brand icon) — not more repeated noise.
- `osbb/index.html` did not have this exact `<span class="ms" style="font-size:...">` icon pattern (its icons are inline `<svg>` with per-instance `stroke`/paths, already handled case-by-case in earlier passes); its remaining `style="` is dominated by the lock-screen/PIN-modal branding (intentionally custom) and skeleton widths.

### OSBB dispatcher task-dot and PIN-modal icon cleanup

Found while auditing what was left in `osbb/index.html` after the Sklad icon sweep:

- the dispatcher card had its own third copy of the task-toggle dot inline-style ternary (identical to the two already cleaned in the journal day-card/table views) — now reuses the existing `task-check-dot`/`is-checked` classes;
- the PIN-modal's lock/trash/check/x icon circles (`pin-modal-icon`) repeated the same `width:40px;height:40px;border-radius:50%` wrapper with only the `background` rgba color varying — replaced with `pin-modal-icon-wrap` plus `is-indigo`/`is-red`/`is-green`/`is-green-soft` color modifiers (the static initial markup used a slightly different opacity than the JS-set states, preserved exactly as `is-green-soft`);
- smoke checks guard both and flag regressions back to the old inline strings.

### OSBB task-toggle keyboard accessibility

The `task-check-dot` spans (journal day-card/table and dispatcher task checkboxes) were purely mouse-driven custom controls — plain `<span>`s inside a `<label>` with no real `<input>`, so keyboard users could not reach or activate them:

- added `role="checkbox"`, `aria-checked`, `aria-label` (the task name), and `tabindex="0"`/`"-1"` (following the existing disabled state) to all three render call sites;
- added a matching `keydown` handler (Enter/Space) next to each existing `click` delegation, calling the same `toggleTask()`/`dispToggleTask()` functions;
- verified end-to-end with a headless Playwright run that dispatches a real `keydown` on the element and confirms the underlying task data and `aria-checked` flip correctly (this environment's Tailwind-CDN block prevents visual/layout verification, so the check goes through the DOM/data state directly — see Testing section);
- the day-expand toggle (dispatcher card header, a separate `<div>` control) has the same gap and is still open — flagged below, not fixed in this pass to keep the change scoped to the checkbox pattern.

### OSBB day-card/dispatcher/garbage disclosure header accessibility (+ a real bug fix)

Followed up the task-toggle keyboard pass by auditing the three "accordion" disclosure headers that expand/collapse a day's content: the journal mobile day-card header, the dispatcher card header, and the garbage day-row header. All three were plain `<div>`s with only a `click` listener — no `tabindex`, `role`, or `aria-expanded`, so keyboard users could not open them at all.

- added `role="button"`, `tabindex="0"`, `aria-expanded`, and `aria-controls` to all three headers, plus a `keydown` (Enter/Space) handler beside each existing click handler (delegated for dispatcher/garbage, direct listener for the journal day-card since that one isn't built through the shared delegation helper);
- **found and fixed a real, pre-existing bug while testing this**, unrelated to accessibility: `dispRender()`'s `isOpen` check compared `dispOpenDays.has(d)` where `d` is a numeric loop variable, against values added via `dispToggleDay(trigger.dataset.dispDayKey)` which are always strings (dataset values). `Set.has()` is type-strict, so this comparison silently failed for every non-today day — meaning **the dispatcher's per-day disclosure could never actually expand for any day except today, by mouse or keyboard**, even though the toggle state was being tracked correctly internally. Fixed by comparing `dispOpenDays.has(String(d))`. (The equivalent `gOpenDays`/garbage-tracker check was already type-consistent, no bug there.)
- verified all three via the same headless-Playwright `dispatchEvent(keydown)` approach used in the previous pass, confirming both the `aria-expanded` state and the actual expand/collapse behavior (DOM class/`display`/`hidden` state) after a keyboard trigger.

### Modal focus-trap audit (Sklad delPinModal + both lightboxes)

Audited every modal/dialog's focus handling against the shared `openModal`/`closeModal` pattern (Sklad) and the bespoke lightbox implementations (both files):

- **Sklad `delPinModal`**: all three close paths (`delPinModalCancel()`, the success path, and the failure-timeout path in `deletePinPress()`) called `document.getElementById('delPinModal').classList.remove('open')` directly instead of `closeModal('delPinModal')` — this skipped `restoreModalFocus()`, so focus only returned to the opener when the modal happened to close via the global Escape handler. All three now call `closeModal('delPinModal')`.
- **Sklad `#lightbox`**: has its own hand-rolled open/close (correct focus set/restore, correct Escape handling) but isn't a `.modal-bg` dialog, so it was invisible to `trapModalFocus()`'s Tab-cycling — Tab could move focus to page content behind the overlay. Extended `trapModalFocus()` to also treat `#lightbox.open` as a trappable dialog, without touching its existing CSS/class structure.
- **OSBB `#lightbox`**: same gap — Escape/arrow-key navigation already worked, but there was no Tab-key handling at all. Added a Tab-cycle handler (prev/next/close buttons) alongside the existing keydown listener.
- All three verified end-to-end with headless Playwright: dispatched Tab/Shift+Tab and confirmed focus wraps between first/last focusable elements with `preventDefault()`, and confirmed `delPinModal`'s cancel path now returns focus to the actual opener element.
- The other 14 Sklad `.modal-bg` dialogs and OSBB's `pin-modal` were already correct — no changes needed there.

## Real-device review (July 2026)

User reviewed the current state of both `sklad/index.html` and `osbb/index.html` (items/issue/log/receipt/audit screens, journal header, dispatcher, garbage dashboard) on a real device after the accessibility/inline-style cleanup rounds above. Verdict: looks good, no visual changes requested. The hero-copy/topbar-overflow/`Прихід`/`Інвентаризація` review items below are considered closed — no action needed unless something new comes up.

## Next implementation priorities

### 1. Sklad items screen redesign

- ~~Tighten hero copy/CTA labels, topbar overflow, review Прихід/Інвентаризація~~ — done, confirmed on real device, no changes needed (see "Real-device review" above).
- ~~The `#a5b4fc` muted-text color and icon `font-size`/`vertical-align` spans...~~ done — see the "Sklad icon-size utility sweep" pass above; remaining `style="` in `sklad/index.html` is skeleton widths, `display:none` toggles, and one-off values.

### 2. OSBB journal follow-up

- ~~Review the simplified journal header on real devices~~ — done, confirmed on real device, no changes needed.
- Continue reducing remaining inline utility-heavy markup in journal sections only in small guarded passes, prioritizing one static shell/list area at a time.

### 3. Component extraction

Visual direction confirmed stable (real-device sign-off above), so extraction started. User asked for this in larger chunks rather than many tiny PRs, so the split is one whole `<style>` block per app instead of the originally-sketched tokens/components/sklad three-way split — sklad and osbb each author their own independent `:root` token set today (not a shared file), so forcing them into a common `styles/tokens.css` now would mean reconciling two designs that only happen to agree on values, not a mechanical move. Revisit a shared-tokens split later if the two token sets are deliberately unified.

- **Sklad**: `sklad/index.html`'s entire `<style>` block (836 lines) moved verbatim to `sklad/styles.css`, referenced via `<link rel="stylesheet" href="styles.css">` in the exact same `<head>` position. `scripts/smoke-check.mjs` now has a `readSkladCombined()` helper (`sklad/index.html` + `sklad/styles.css` concatenated) that the ~45 existing Sklad checks route through, so both HTML-markup and CSS-rule-text assertions keep working without reclassifying every check by hand.
- Verified: byte-for-byte diff between the extracted block and the new file: identical. `node scripts/smoke-check.mjs` still green. Tag balance and inline-`<script>` syntax unaffected (only CSS moved). Headless Playwright screenshot after the extraction shows the page rendering identically (colors, gradients, layout, tokens all resolve correctly from the external file) — the only thing not rendering is Material Symbols icon glyphs, which is the pre-existing, unrelated Google-Fonts-CDN sandbox block documented in `CLAUDE.md`.
- Checked PWA/offline impact: the only *registered* service worker is the shell's root `sw.js` (from `index.html`), which explicitly does not intercept `/sklad/*` requests — so `sklad/styles.css` has the same (lack of) offline-cache coverage as the rest of the Sklad app already had. `sklad/sw.js` exists in the repo but is never registered anywhere (dead code, pre-existing) — not touched.
- **OSBB**: same treatment — `osbb/index.html`'s 222-line `<style>` block moved verbatim to `osbb/styles.css`, linked in the same `<head>` position (after the Google Fonts `<link>`, same as before). Added a matching `readOsbbCombined()` helper and routed the ~20 affected OSBB checks through it. Same verification: byte-identical diff, 169/169 smoke checks, tag balance/script syntax unaffected, headless Playwright screenshot shows identical rendering (theme colors, cards, badges, dashboard panels all correct). Same offline-caching conclusion: `osbb/sw.js` is also never registered (dead code), and the active shell `sw.js` excludes `/osbb/*`, so no regression.
- **Shell**: `index.html`'s 162-line `<style>` block moved to a root-level `styles.css`, same `<link>`-in-place treatment. No `smoke-check.mjs` combined-read helper was needed here — the only two shell checks that read `index.html` assert JS/markup (onclick-attribute regex, auth-TTL logic), not CSS rule text.
  - **Important difference from the sklad/osbb extractions**: the root `sw.js` (registered from `index.html`) is the *only* service worker actually active in this app — unlike `osbb/sw.js`/`sklad/sw.js`, which are dead code. It precaches the shell (`urlsToCache`) for offline use and network-first/cache-fallback serves `index.html`, so extracting the CSS into a separate, uncached file would have made the offline-fallback shell render unstyled. Fixed by adding `/Osbb/styles.css` to `urlsToCache` (precached on install) and to the cache-first `isShellStatic` branch, and bumping `CACHE_NAME` to `osbb-shell-v2` so existing installs pick up the new asset on next activation. Added a smoke-check guard for both.
  - Verified: byte-identical diff, 170/170 smoke checks (169 + the new sw.js guard), tag balance/script syntax unaffected, headless Playwright screenshot of the PIN lock screen renders identically to before.
- All three `<style>` blocks (Sklad, OSBB, shell) are now extracted.

### OSBB accent/token color alignment with Sklad (July 2026)

User explicitly asked to align colors, using Sklad as the canonical source ("зроби так як у складі"). This was a real visual change, not a mechanical move — flagged and confirmed before making it.

- Investigated first: OSBB's green accent is **not** primarily driven by the `--accent` CSS variable — it's hardcoded as the literal `#34c759` in ~47 places across `osbb/index.html` and `osbb/styles.css` (icons, buttons, badges, gradients), with only 5 places actually reading `var(--accent)`. Aligning only the variable definition would have left the app two-tone (a few elements shifting color, most staying the old green) — so the fix replaced the literal everywhere, not just the token.
- `34c759` → `22c55e` (Sklad's light-mode `--brand`/`--accent`) across both files, all ~47 occurrences.
- `248a3d` (OSBB's `--accent-dark`, theme-invariant) → `16a34a` (Sklad's light-mode `--brand-dark`/`--accent-strong`) across both files, 3 occurrences.
- Dark-mode accent (`#30d158`) was **already** identical to Sklad's dark `--brand`/`--accent` (`#30D158`, case-insensitive) — no change needed there.
- Updated the `.theme-light`/`.theme-dark` token blocks in `osbb/styles.css` so `--surface-2`, `--border-subtle`, `--shadow-sm`, and `--shadow-md` now match Sklad's `:root`/`.theme-dark` values exactly (`--surface-1` was already `#ffffff` in light mode, matching; dark-mode `--surface-1` updated `#1e1e21` → `#111821` to match). Sklad's shadow tokens are theme-invariant (same value in light/dark), so OSBB's shadow tokens became invariant too, matching.
- Did **not** rename OSBB's other variables (`--bg-app`, `--bg-card`, `--text-main`, etc.) to Sklad's `--ios-*` naming — that's a much larger, separate refactor (every `var()` reference in the file), not part of "align colors."
- Updated two smoke-check needles (`.task-check-dot.is-checked`, `.g-chart-bar`) that had the old `#34c759` hardcoded from an earlier pass this session.
- Verified: 170/170 smoke checks, tag balance/script syntax unaffected, headless Playwright screenshots of both light and dark themes after the change show correct, unbroken rendering with the new green shade applied consistently. `sklad/` was not touched (verified zero diff).

Next: reconsider a shared `styles/tokens.css` file now that the shared-name tokens (`--accent`, `--surface-1/2`, `--border-subtle`, `--shadow-sm/md`) actually agree in value between the two apps — the remaining OSBB-only variables (`--bg-app` etc.) would stay in `osbb/styles.css`.

## Audit pass (July 2026) — Sklad's `<style>` extraction had silently regressed

A full audit found that `sklad/index.html` had **no `<link rel="stylesheet" href="styles.css">` at all** — despite the "Component extraction" section above claiming the CSS was moved out and verified. The full ~766-line inline `<style>` block was still physically present in `sklad/index.html` and was the *only* stylesheet actually served (styles.css was orphaned/dead). Worse, the two had diverged: `sklad/styles.css` had picked up ~15 newer classes from later redesign passes (`.table-idx-cell`, `.log-qty-out/in`, `.audit-summary-*`, `.badge-internal`, etc.) that were **never in the inline copy**, so those elements were rendering with no matching CSS in production. The inline copy also had a slightly different topbar icon-button size (42px/20px vs styles.css's 48px/22px).

Root cause is unclear (most likely a merge-conflict resolution that picked "ours" on an old branch state — see the `git checkout --ours -- sklad/index.html` conflict pattern documented in `CLAUDE_SESSION_NOTES.md`) but wasn't investigated further; the fix was to reconcile forward, not to dig through history.

Fixed: the stale inline block was deleted from `sklad/index.html` and replaced with `<link rel="stylesheet" href="styles.css">` in the same `<head>` position; `sklad/styles.css` (the more complete, newer version) is now the actual live source. The `[data-tip]`/`prefers-reduced-motion` rules that only existed in the inline copy (both `sklad/styles.css` and `osbb/styles.css` carried a comment claiming these "moved to shared/ui.css", but `shared/ui.css` never actually contained them) were added for real into `shared/ui.css`, and the now-truly-redundant local copy in `osbb/index.html`'s inline `<style>` block was removed too. One smoke check (`sklad operational forms use centralized event bindings`) was reading raw `sklad/index.html` for a CSS-only needle and had to be switched to `readSkladCombined()`, matching how the other CSS assertions already worked. Verified: 174/174 smoke checks, tag balance, `node --check` on extracted scripts, and a headless Playwright screenshot (light + dark) of the Sklad items page confirming the hero/insight-grid/filter-bar/table-modern layout renders correctly from the external stylesheet.

**`osbb/index.html` had the same missing-link problem — now fixed too (July 2026, follow-up pass).** The user explicitly asked for a unified look across journal/склад and flagged a native `<input type="number">` spinner looking out of place, which prompted revisiting this. Unlike Sklad, the divergence went **both ways**: the live inline copy was still on the pre-unification `#34c759` accent/old token values (the color-alignment-with-Sklad pass documented above only ever reached the orphaned `osbb/styles.css`, so it never actually shipped), while it also had classes `osbb/styles.css` lacked (`.journal-list-shell`, `.journal-mini-stats`, `.garbage-chart-panel`, `.journal-stat-card.role-*`, the whole `.lock-screen`/`.lock-panel`/`.pin-modal-*` PIN-reset-modal system, `.skel-w-*`). It also turned out **some markup the live JS already emitted had zero matching CSS**, independent of any color issue: `task-check-dot` (the duty-checklist toggle dots), `g-chart-bar` (the yearly garbage chart bars), `journal-joke-icon`, and `journal-daytype-icon` — all four classes existed only in the orphaned `osbb/styles.css`, never in the live inline block, so those elements were rendering with no shape/color/gradient styling at all in production.

Fixed by reconciling forward from the *live* inline block (not blindly swapping to `osbb/styles.css`, since the live block had newer structural classes styles.css never got): applied the accent/token color-unification values, converted the same handful of exact-match `border-radius` literals to the `--radius-*` scale (mirroring the Sklad pass), added the four missing-but-emitted classes above, and added back the elderly-readability `.text-xs`/`.text-[Npx]`/`min-height` accessibility overrides — which had also silently stopped applying, since they only ever existed in the orphaned file. Kept everything inline-only-but-actually-used as is (`.journal-mini-stats`, `.lock-screen` system, etc.) rather than dropping it. Two smoke checks (`osbb dispatcher task dot and PIN-modal icons...`, `osbb journal status/icon spans...`) had been quietly checking `osbb/styles.css` in isolation via `readOsbbCombined()` and expected a slightly cleaner `.pin-modal-icon-wrap` (no redundant default background) and a `.journal-status-icon-row(-tight)` rule-name that the live JS doesn't actually emit (`status-label` is the real, working, live class) — kept `.status-label` as the functional rule and added `.journal-status-icon-row(-tight)` as a documented alias so the checks reflect the historically-intended name without a risky 46-callsite rename.

Also added, in the same pass (this is what the user actually reported — a native `<input type="number">` spinner looking out of place next to a date field in Sklad's issue form): `input[type="number"]::-webkit-inner-spin-button/-outer-spin-button { -webkit-appearance:none }` + `-moz-appearance:textfield` to hide native spin arrows, and `.theme-light{color-scheme:light} .theme-dark{color-scheme:dark}` in both `osbb/styles.css` and `sklad/styles.css` so native date-picker popups/spinners follow the app's theme instead of always rendering in the OS's light palette.

Extracted the corrected inline block into `osbb/styles.css` and linked it, exactly mirroring the Sklad fix. Verified: 174/174 smoke checks, tag/script balance, `node --check`, and headless Playwright screenshots (light + dark) of the journal dashboard and Sklad's issue form confirming matching accent color between both apps and no visible number-spinner artifact.

## Implemented from the "Journal і Склад 2026" redesign teardown (July 2026, follow-up)

Three of the highest-severity findings from the earlier teardown artifact were implemented for real:

- **Sklad desktop item row: 7 icon buttons → primary + kebab menu.** The desktop `<tr>` action cell now matches the mobile card's already-built `<details class="item-more">` overflow-menu pattern exactly (same menu items: Фото, Внутрішнє/Повернути в баланс, Ручна ціна, Інтернет-ціна, Видалити), instead of duplicating it as a dense 7-button row. This required generalizing `closeOpenItemMenus`/`handleItemMenuToggle`/`handleItemMenuOutsideClick`/the Escape handler from a `#mobileCards`-scoped selector to a plain `details.item-more` selector (all four are global `document`-level listeners already, so no rebinding was needed) — and fixing `.table-modern{overflow:hidden}`, which would have clipped the dropdown at the card boundary. Replaced with corner-specific `border-radius` on the first/last header and body cells (`var(--radius-xl)`, matching `.card`), so the rounded-card look is unchanged but nothing clips an absolutely-positioned popover anymore. This affects the Items and Log tables; the Receipts table keeps its own explicit inline `overflow:hidden` untouched. Added a smoke-check guard.
- **Sklad alert banner no longer restates the stat-card numbers.** `checkAlerts()` used to spell out "`N товар(ів) закінчились, M товар(ів) на межі`" in the banner directly above the `insight-grid` stat cards that show the same two numbers a few pixels below. Banner text is now `Потребує уваги: N позицій` (single combined count, grammatically invariant regardless of N) — the banner's distinct job (click through to the Statistics page) is unchanged, it just doesn't restate what the cards already show.
- **Journal duty-shift toggle switches get a tactile shadow.** Added Tailwind's `shadow-inner` (track) and `after:shadow-md` (knob) utilities to all three shift-toggle render sites (journal day-card, journal desktop table — which already had `shadow-inner` from an earlier pass, dispatcher card) for a soft embossed feel, matching the "тактильний мінімалізм" principle from the teardown (depth only on things you physically press). Utility-class-only change, no new CSS, no logic touched.

Not implemented from that teardown (left for a future pass, none are blockers): the role-monitoring-card number-hierarchy rework (big number + merged status line), the tab-underline-slide and count-up micro-animations, and the three "new functional" concepts (AI assistant, expense forecast, entrance map) — the last of those explicitly needs a schema/scoping conversation before any UI work, per the teardown's own Phase 5 note.

## Implemented from the teardown, round two (July 2026)

The remaining non-blocking items from the round above, except the three new-feature concepts (still untouched, still need the scoping conversation):

- **Role-monitoring-card number hierarchy.** The three "МОНІТОРИНГ ЗА МІСЯЦЬ" cards (Електрик/Двірник/Сантехнік) had the role name at `font-bold` default size right next to the shift count at `text-xl font-black` — a real but modest 1.25× ratio that read flatter than intended at card width. Role label is now `font-semibold text-sm` (smaller, lighter) and the count is `text-2xl font-black` (up from `text-xl`), on all three cards. Pure Tailwind utility swap, no markup restructuring — the existing two-line layout (count row / status row with border-top separator) already had reasonable separation, so a full merge into one status line (as originally mocked up) wasn't necessary to fix the actual complaint.
- **Count-up number animation.** Added a small `animateNumber(el, target, {prefix, suffix})` helper (duplicated per-file, matching how every other small utility in this codebase already works — no shared JS module for app logic beyond `shared/enhance-select.js`) to both `osbb/index.html` and `sklad/index.html`. It tweens from the number currently displayed (read back from `el.dataset.animRaw`, falling back to parsing `textContent`) to the new target over 380ms with a cubic ease-out, and snaps instantly when `prefers-reduced-motion: reduce` is set or the value hasn't actually changed. Deliberately tweens from *current* value rather than always from 0, so it reads as a nice quick "value changed" affirmation on every incremental update (e.g. 6 → 7 after one toggle), not just a one-time sweep on initial load. Wired into: `osbb` `updateStats()` (the three role shift-counts) and `dashGarbageRender()` (`dash-garbage-total`, `dash-garbage-bins`); `sklad` `updateStats()` (`st-total`/`st-zero`/`st-low`/`st-ok`).
- **Tab-switch and card-entrance animation turned out to already exist**, on inspection — `.tab-btn { transition: all 0.2s; }` already animates the active-tab fill-color change, and `animateStatCards()` already does a staggered pop-in on `.stat-card` elements. The teardown's mockup imagined a sliding underline under flat tabs, but the actual OSBB tabs use a filled-pill "segmented control" style (same family as the shell's tab bar) where a sliding underline would fight the existing treatment rather than improve it — skipped in favor of what was already there.

## AI assistant: built, deployed, then reverted by explicit user decision (July 2026)

The AI assistant (ambient `.ai-bar` in both apps + `sklad/supabase/functions/ai-assistant` Edge Function calling Claude API) was fully implemented and merged, then the Edge Function was deployed live to the `vkwkyhjjjmcpmiakxohw` project via Supabase MCP. Before a secret was set, the user asked what the Anthropic Console billing requirement was about, decided the pay-as-you-go API cost wasn't worth it for this use case, and asked for the whole feature to be removed. Reverted via `git revert` of the merge commit — clean, since nothing landed on top of it afterward.

**If a future session is asked to rebuild this**: the implementation itself worked correctly (frontend wired, Edge Function deployed successfully, graceful error path verified) — this wasn't a technical failure, it was a cost decision. Don't silently re-add it without asking again; the user's reasoning ("не треба, це коштує грошей") may or may not still hold by then.

**Cleanup note**: code and docs are fully reverted, but the `ai-assistant` Edge Function itself may still exist in the live Supabase project's function list — there is no `delete_edge_function`-equivalent tool available via the Supabase MCP server used in this session (only deploy/get/list), so it couldn't be removed programmatically. It's harmless (no `ANTHROPIC_API_KEY` secret was ever set, so it can only ever return a "not configured" error, and nothing in the reverted frontend calls it anymore) but not truly gone. The user can remove it themselves with `supabase functions delete ai-assistant --project-ref vkwkyhjjjmcpmiakxohw` if they want it off the list entirely.

## Remaining sharp-cornered native controls, fixed (July 2026)

User flagged (with screenshots) the OSBB garbage/dispatcher day-row: a native `<select>` for "Працівник" rendering the browser's own square-cornered dropdown, and a native `<input type="time">` rendering the browser's own square-cornered hour/minute picker — both visibly out of place against the app's rounded design language, and neither fixable via CSS the way `type="number"` spinners and `type="date"` pickers already were (`color-scheme` only recolors native popups, it can't round their corners; that's a real browser limitation, not a CSS gap).

Audited **every** `<select>` and every `type="time"/"date"/"week"/"month"/"color"` input in both `osbb/index.html` and `sklad/index.html` to find every remaining instance, not just the one in the screenshot:

- Sklad: all 9 `<select>` elements were already routed through `enhanceSelect()` via one blanket `forEach` call — genuinely nothing left to fix there.
- OSBB: the calendar header's year/month `<select>` elements were already enhanced (`enhanceSelect(yearSelect)`/`enhanceSelect(monthSelect)` in `initCalendar()`) — the raw `<select>` tags only show up unenhanced in the static HTML source, not at runtime. The garbage-worker `<select>` (`data-g-field="worker"`) was the only genuinely unenhanced one — it's rebuilt from scratch on every `gRenderDaysList()` call (a fresh element each time, so `enhanceSelect`'s own `dataset.enhanced` idempotency guard never blocks it), so the fix was adding one `container.querySelectorAll('select[data-g-field="worker"]').forEach(enhanceSelect)` call at the end of that render function.
- The garbage `<input type="time">` was the only `type="time"` field in either app, and there were no `type="week"/"month"/"color"` fields anywhere. Replaced it with `type="text" inputmode="numeric" maxlength="5" placeholder="ГГ:ХХ" data-time-mask` — a small `formatTimeMaskInput()` helper auto-inserts the colon as digits are typed (delegated on the existing `#g-days-list` container's `input` event), and a `blur`-phase listener (capture, since `blur` doesn't bubble) clears the field back to empty if it doesn't end up matching `HH:MM` (00-23:00-59) rather than storing garbage. `gUpdateRow()` itself needed no changes — it already just stores whatever string is in the field on `change`, same as the native time input did.

Verified: 175/175 smoke checks, tag balance, `node --check`, and a headless Playwright screenshot with the worker dropdown open confirming a fully rounded custom panel (matching `.custom-select-panel`/`.custom-select-option` styling used everywhere else) instead of the native square one.

## Day-card checklist density/hierarchy, actually finished (July 2026)

The "Перемикачі, чекліст і лічильник заявок стиснуті в одну щільну колонку" finding from the redesign teardown was only *partially* addressed in the "3 highest-severity findings" pass — that pass gave the shift toggle a tactile shadow but never touched the checklist's own density or the "all task rows look the same regardless of status" complaint. User asked directly whether this one was done; it wasn't, so finished it properly this time, in both places this markup is duplicated (mobile day-card and desktop table role column):

- Added a `Завдання N/M` progress line above each role's task checklist (`tasksProgress`/`checkBoxesProgress`), turning emerald green once `N === M` — lets you tell at a glance whether a role's checklist is fully done without reading every row. Computed from the same `state.tasks?.[task.id]` lookup the checkbox dots already use, so it can't drift out of sync with them.
- Gave the "Заявок:" ticket-count row its own `border-t` separator (`mt-2 pt-2 border-t border-[var(--border-subtle)]`, replacing the old bare `mt-1.5`) so it reads as a distinct field, not another checklist row.
- The individual task rows' checked/unchecked text styling (`font-semibold` vs `text-[var(--text-sub)]`) already existed before this session — that part of the original complaint was already handled, just not obvious enough on its own without the progress summary.

Verified the counting logic with real task IDs from `roleTasksConfig` (`lamps`/`sewer`/`garden`/`lawn`/`bins`/`stairs`) via a headless Playwright text-content check — e.g. electrician with `{lamps:true}` correctly showed `1/1`, janitor with 2 of 4 tasks true showed `2/4`. Could not visually confirm the `flex justify-between` spacing renders correctly in this sandbox specifically (Tailwind CDN is blocked here, a pre-existing, documented limitation — see "Testing" in `CLAUDE.md`), but the classes used are the same standard Tailwind utilities used everywhere else in this file that do render correctly for the user on a real device.

## The rest of the original teardown findings, actually finished (July 2026)

User pasted the full original findings list back and pointed out most of it (everything except the three "Високо" items and the day-card checklist) was still unfixed. Went through the remaining five:

- **Journal header, 3 rows of same-weight pills.** The real cause wasn't row *count* but that two different rows both used a solid-fill green "primary" button style — the Excel/PDF export buttons (`journal-action-btn-primary`, `#059669` fill) visually competed with the active tab (`.tab-btn.active`, `#22c55e` fill) for "most important element on the page" status. Added a `.journal-action-btn-ghost` variant (bordered, no fill, matching the existing calendar-nav button look) and switched Excel/PDF to it, leaving Скинути on `-danger` (legitimately should stand out) and the tabs as the only solid-fill green anchor. Didn't collapse the row *count* — reordering/hiding rows risks breaking muscle memory and needs the user's input on priority, not a guess.
- **Joke banner reading as a caption for "Моніторинг за місяць".** Removed `italic` (italic styling reads as "quote/caption" almost by convention) and switched `font-medium` → `font-semibold`, bumped `mb-4` → `mb-6` for more breathing room before the heading below.
- **Role-card number/title weight** — already addressed in the earlier "round two" pass (`text-xl` → `text-2xl` for the count, role label shrunk to `text-sm font-semibold`); nothing further needed here.
- **Garbage card: number pinned right, label pinned left, no shared alignment axis.** Removed the `flex justify-between` split; the big count and its "Всього за місяць" caption now sit on one `flex items-baseline` row, both starting from the same left edge as the "Баків вивезено" label above and the "Середнє за 3 міс"/breakdown-pills rows below.
- **Sklad decorative stat-card circles look clipped, not intentional.** `.insight-grid .stat-card::after` was a solid-color circle deliberately positioned half off-card (`right:-24px;top:-28px`) and clipped by the card's `overflow:hidden` — a hard edge at the clip line read as a layout mistake. Changed the fill from a flat color to `radial-gradient(circle,var(--stat-soft) 0%,transparent 72%)`, so the color has already faded to nothing before it reaches the clip boundary — same footprint and position, no visible cut line anymore.
- **Sklad's 3 filter rows always fully expanded.** Tightened `.items-filter-row + .items-filter-row` margin from 10px → 6px and bar padding from 14px → 12px, so the three rows read as one compact toolbar block. Deliberately did **not** hide/collapse any row behind a toggle — that's a real functional change (which filter is "default visible"?) that needs the user's priority input, not something to guess at.

Verified: 175/175 smoke checks (one guard updated to match the `-ghost` button class swap), tag/brace balance, `node --check`, and headless Playwright screenshots confirming the radial-gradient card corners no longer show a hard clip line and the garbage total now reads left-to-right on one axis.

## Joke banner removed entirely (July 2026)

Earlier passes only *restyled* the jokes banner (dropped `italic`, bumped weight/spacing — see above). User then said outright it's no longer needed at all — not "fix it", but remove it. Deleted all three pieces:

- The `#fun-quote` banner `<div class="no-print journal-note ...">` block in the dashboard header.
- The `const quotes = [...]` array (10 humorous strings with inline `journal-joke-icon`-classed SVGs).
- The runtime assignment `document.getElementById('fun-quote').innerHTML = quotes[...]` inside the calendar-init code — this was the one piece missed in the first pass of this edit; leaving it in would have thrown `quotes is not defined` on every page load.

Left the now-unused `.journal-joke-icon { display:inline-block; vertical-align:-2px; }` rule in `osbb/styles.css` — `scripts/smoke-check.mjs` asserts this exact CSS text exists, and touching a smoke-check guard for a one-line dead-CSS cleanup isn't worth it.

Verified: 175/175 smoke checks, div/svg/button/label tag balance, and `node --check`-equivalent syntax validation of all three inline `<script>` blocks in `osbb/index.html` (no leftover references to `fun-quote` or `quotes` anywhere in the file).

## Role-card humorous status badges removed (July 2026)

Same instinct as the joke banner above, applied to the "Статус:" line under each of the three role cards (Електрик/Двірник/Сантехнік) in the monthly monitoring panel — humorous tier titles ("Початківець іскри", "Генерал Мітли та Грабель", "Гроза Засмічень", "Заслужений відпочинок", etc.) driven by shift count thresholds. User asked to remove these too.

- Removed the `<div class="mt-2 pt-2 border-t ... text-xs">Статус: <span id="badge-{role}">...</span></div>` row from all three role cards — including its `border-t` divider, since there's nothing left to divide once the row is gone.
- Removed `getWorkerBadge(role, count)` entirely (the icon/title-generating function, ~19 lines with per-role SVG icon constants) and the `document.getElementById(\`badge-${role}\`).innerHTML = getWorkerBadge(...)` call inside `updateStats()` — that function had no other callers.
- Each role card now shows only the role name and the shift count (`stats-{role}`), nothing else.

Verified: 175/175 smoke checks, div/svg/button/label/span tag balance, and syntax validation of all inline `<script>` blocks. Grepped for `getWorkerBadge`/`badge-electrician`/`badge-janitor`/`badge-plumber`/`Статус:`/`Заслужений відпочинок` — no remaining references anywhere in the file.

## Full dead-code audit (July 2026)

User asked for a full code audit to remove "сміття" — clarified this meant dead/leftover code cleanup, explicitly NOT the "Сміття" (garbage collection tracking) feature itself, which stays. Ran a dedicated read-only audit pass (grepping every candidate's call-sites/class-usages across the relevant file before touching it, and cross-checking `scripts/smoke-check.mjs` for guards) and independently re-verified each finding before deleting. Removed:

- **`sklad/index.html`**: dead function `jsString(s)` (zero call-sites); orphaned `#barcodeAddStatus` div next to the "Сканувати штрих-код товару" button — the actual barcode-scan flow uses its own modal (`barcodeAddModal` / `#barcodeAddScanning`) for status text, this div was never written to by any of the `openBarcodeAddScanner`/`resetBarcodeScanner`/`stopBarcodeAdd` functions; orphaned `id="authDots"` on the auth-dots wrapper (only the individual `d0`-`d3` dot ids are ever targeted).
- **`sklad/styles.css`**: `.barcode-add-status` (only used by the div just removed), `.auth-inp` (leftover from an older text-input auth screen — current screen is PIN-keypad only), `.btn-warning`/`:active` (no element uses it), `.hist-in` (its sibling `.hist-out` is used at a real call site, `.hist-in` never is — history entries apparently never render an "incoming" variant in the UI as built).
- **`osbb/styles.css`**: `.journal-note` and `.journal-action-btn-primary`/`:hover` — confirmed as direct residue of two earlier removals in this same session (the joke banner used `journal-note`; the Excel/PDF buttons used `-primary` before being switched to `-ghost` in an earlier PR). `.custom-cb`/`:hover`/`.checked` (superseded, zero usage). `.animate-slide` and `.animated-title` (zero usage), plus their now-orphaned `@keyframes slide-down`/`title-reveal`/`shimmer` (each keyframe had exactly one user, both removed, so the keyframe itself became dead too — not the same `skel-shimmer` keyframe used by the loading-skeleton `.skel` class, which stays).
- **`shared/ui.css`**: `.shared-visually-hidden` and `.shared-focus-ring:focus-visible` (+ the `--shared-focus-ring` variable) — generic a11y utilities that were never actually adopted anywhere in the three entrypoints, zero usages found. Left `[data-tip]`/tooltip rules and `prefers-reduced-motion` untouched (those ARE used, and CLAUDE.md documents them as this file's actual purpose).
- `scripts/smoke-check.mjs`: dropped the `id="barcodeAddStatus"` needle along with the div.

One finding was deliberately **not** treated as simple dead code: `initRealtime()` in `osbb/index.html` (Supabase realtime subscription for schedule/garbage/dispatcher/chat/photos) was silently inert — `osbb/index.html` never loaded the `@supabase/supabase-js` CDN script (unlike `sklad/index.html`, which does), so its own `typeof supabase === 'undefined'` guard always short-circuited and the subscription code never ran. This reads as a missing script tag (a real functional gap), not intentional dead code, so asked the user rather than silently deleting a half-built feature. User chose to fix it: added `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>` to `osbb/index.html`'s script list (matching `sklad/index.html`'s existing pattern) — the journal's live multi-user realtime sync (schedule/garbage/dispatcher/chat edits appearing for other staff without a manual refresh) should now actually work instead of silently no-op'ing.

Verified: 175/175 smoke checks, div/svg/button/label/span tag balance on both entrypoints, syntax validation of every inline `<script>` block in both `osbb/index.html` and `sklad/index.html`, and a final grep confirming zero remaining references to any removed identifier/class/id.

## Item kebab menu floating disconnected from its row, fixed (July 2026)

User sent a screenshot of `.item-more-menu` (the "•••" kebab dropdown on a sklad item row) rendering as a large box floating far above its trigger, overlapping the sticky `.items-filter-bar`/table header and looking completely disconnected from the row it belonged to.

Root cause: `.item-more-menu` always opens **upward** (`bottom: calc(100% + 8px)`, unconditionally) — a fixed choice made when the kebab menu was first built, presumably to avoid the menu getting clipped by the table's bottom edge for rows near the end of a long list. That works fine for rows near the bottom of the scrolled viewport, but for any row near the *top* (which is common — it's the first visible row after any scroll, and the sticky `.items-filter-bar` sits right there with `position:sticky;top:74px`), opening upward pushes the menu behind/through the sticky bar with nowhere real to render, producing exactly the floating disconnected box in the screenshot.

Reproduced locally (Playwright, mock `allItems` injected directly since Supabase is network-blocked in this sandbox — see "Testing" in `CLAUDE.md`) in both the desktop table and mobile card layouts, confirming the same collision in both.

Fix: added `positionItemMenu(menu)`, called from the existing `handleItemMenuToggle` delegated `toggle` listener right when a menu opens. It measures the real available space above the trigger — using `.items-filter-bar`'s `getBoundingClientRect().bottom` as the effective ceiling (not `0`/viewport-top, since the sticky bar itself occupies that region) — and adds an `.opens-down` class when there isn't enough room, which a new CSS rule (`.item-more.opens-down .item-more-menu{bottom:auto;top:calc(100% + 8px);}`) flips to open downward instead. Rows with enough space above (the original common case — later rows in a scrolled list) are unaffected and still open upward exactly as before.

Verified via Playwright: near-top rows in both layouts now correctly get `.opens-down` and render cleanly anchored below their trigger with zero overlap; a middle/bottom row still opens upward with no `.opens-down` class, confirming no regression to the original working case. 175/175 smoke checks, tag balance, and inline-script syntax also re-checked.

## Guardrails for future sessions

- When a `<style>` block is "extracted" to an external file, immediately grep the entrypoint HTML for `href="styles.css"` and confirm the inline `<style>` tag is actually gone — don't just trust the previous session's notes. This exact regression (link missing, inline block silently reintroduced, two files diverging) is what the section above describes.

- Do not remove existing accessibility/focus/escaping smoke checks.
- If adding dynamic HTML, escape user/Supabase values with `escapeHtml()` / `escapeAttr()`.
- If adding external links, sanitize via `safeExternalUrl()` and use `rel="noopener noreferrer"` for `_blank`.
- All non-submit buttons should keep `type="button"`.
- Keep icon-only controls labelled.
- Respect `prefers-reduced-motion` when adding animations.
- If a browser is available and visual changes are made, capture a screenshot.
