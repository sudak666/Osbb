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

## Next implementation priorities

### 1. Sklad items screen redesign

Continue after this items/issue/log redesign pass:

- Tighten the hero copy/CTA labels after real-device review and decide whether topbar secondary actions should move into an overflow.
- Continue removing remaining inline styles from items filters/table actions and issue preset chips after the visual direction is accepted.
- Consider moving topbar secondary actions into a compact overflow on mobile if real-device review still feels crowded.
- Apply the same calm hierarchy pass to `Прихід` and `Інвентаризація` screens.

### 2. OSBB journal header simplification

The journal header still has too many controls in one visual row. Split it into:

- title/status row;
- calendar/action row;
- tab row.

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
