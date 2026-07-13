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

## Next implementation priorities

### 1. Sklad items screen redesign

Do next after this foundational pass:

- Add a page hero for `Товари на складі` with title, sync state and one primary CTA.
- Move secondary actions into a compact action group or overflow.
- Rework stat cards into a calmer `insight-grid`.
- Make search + filters a sticky filter bar on desktop and a compact stacked section on mobile.
- Simplify mobile item cards: title/category/qty/primary CTA visible; secondary actions in menu.

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
