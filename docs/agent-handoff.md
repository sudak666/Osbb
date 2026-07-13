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

Expected recent work at the time this handoff was written:

- `6c45dc0 Polish Sklad mobile light UI and price modal`
- `78690a6 Centralize DOM event bindings, add auth TTL, sanitize external URLs and improve accessibility`

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
- `bindPriceResultActions`
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

### 5. Sklad mobile UI polish

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

Latest known expected result: `132 smoke checks passed` after the accessibility/focus/escaping/mobile-topbar/menu hardening, Sklad foundational UI token pass, items-screen hero/filter redesign shell, and calmer insight/mobile item card pass.

## Suggested next work

### Priority 1 — Continue Sklad visual redesign

- Read `docs/ui-redesign-notes.md` before making visual changes.
- Build on the new Sklad design tokens (`--surface-*`, `--shadow-*`, `--radius-*`, `--motion-*`).
- Continue the Sklad redesign: refine the new hero/filter/insight-card shell, reduce remaining inline styles, and apply the same calm hierarchy to Issue/Log/Receipt screens.
- Ensure primary vs secondary actions are visually clear.
- Check bottom nav overlap with modals, cards, long lists, and mobile item overflow menus.

### Priority 2 — Accessibility follow-up audit

- Keep focus trap / `Esc` / opener-return behavior intact when adding new modals or lightboxes.
- Check newly added icon-only buttons for stable `aria-label`.
- Prefer semantic controls over custom clickable elements; if custom controls are needed, preserve keyboard support.
- Add smoke checks for new accessibility invariants where practical.

### Priority 3 — Safer rendering pass

- Continue auditing `innerHTML` renderers.
- Prefer `escapeHtml`/`escapeAttr` or DOM APIs (`textContent`, `setAttribute`) for user-controlled data.
- Add smoke guards when converting risky renderers.

### Priority 4 — Start reducing monoliths carefully

Only after the UX/security hardening is stable:

- begin extracting CSS/JS in small PRs;
- avoid large rewrites;
- keep existing behavior covered by smoke checks.

## Working rules for the next agent

- Do not use `ls -R` or `grep -R`; use `rg` and `find`.
- Before changes: check `git status --short` and run relevant smoke checks.
- After changes: run `node scripts/smoke-check.mjs` and `git diff --check`.
- If the UI visibly changes and a browser is available, capture a screenshot.
- Commit changes on the current branch.
- After committing, create a PR with a clear title/body.
- Keep changes small enough to review safely unless the user explicitly asks for a larger batch.
