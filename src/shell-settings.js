// Згенеровано з src/shell-settings.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const THEME_KEY = "selected_theme";
const PIN_KEY = "osbb_pin_enabled";
const AUTO_LOCK_KEY = "osbb_auto_lock_enabled";
const normalizeShellTheme = (value) => value === "theme-dark" ? "theme-dark" : "theme-light";
function createShellSettings(deps) {
  const doc = deps.document;
  const win = deps.window;
  const read = (key) => {
    try {
      return win.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      win.localStorage?.setItem(key, value);
    } catch {
    }
  };
  const flag = (key) => read(key) !== "0";
  function applyTheme(value) {
    const theme = normalizeShellTheme(value);
    doc.body.classList.remove("theme-light", "theme-dark");
    doc.body.classList.add(theme);
    doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "theme-dark" ? "#121214" : "#f4f7fb");
    return theme;
  }
  function setChecked(selector, checked, disabled = false) {
    doc.querySelectorAll(selector).forEach((input) => {
      input.checked = checked;
      input.disabled = disabled;
      input.closest(".shell-switch-row")?.classList.toggle("is-disabled", disabled);
    });
  }
  function sync() {
    const pinOn = flag(PIN_KEY);
    setChecked("[data-shell-theme]", normalizeShellTheme(read(THEME_KEY)) === "theme-dark");
    setChecked("[data-shell-pin]", pinOn);
    setChecked("[data-shell-auto-lock]", pinOn && flag(AUTO_LOCK_KEY), !pinOn);
    doc.querySelectorAll("[data-shell-lock]").forEach((button) => {
      button.hidden = !pinOn;
    });
  }
  function popover() {
    return doc.getElementById("shell-settings");
  }
  function isPopoverOpen() {
    const el = popover();
    return Boolean(el && !el.hidden);
  }
  function setPopoverOpen(open) {
    const el = popover();
    if (!el) return;
    el.hidden = !open;
    doc.querySelectorAll("[data-shell-settings]").forEach((button) => {
      button.setAttribute("aria-expanded", String(open));
      button.classList.toggle("active", open);
    });
    if (open) el.querySelector("input")?.focus();
  }
  function bind() {
    doc.querySelectorAll("[data-shell-theme]").forEach((input) => {
      input.addEventListener("change", () => {
        const theme = applyTheme(input.checked ? "theme-dark" : "theme-light");
        write(THEME_KEY, theme);
        sync();
      });
    });
    doc.querySelectorAll("[data-shell-pin]").forEach((input) => {
      input.addEventListener("change", () => {
        write(PIN_KEY, input.checked ? "1" : "0");
        if (!input.checked) write(AUTO_LOCK_KEY, "0");
        sync();
        deps.onSecurityChanged?.();
      });
    });
    doc.querySelectorAll("[data-shell-auto-lock]").forEach((input) => {
      input.addEventListener("change", () => {
        write(AUTO_LOCK_KEY, input.checked ? "1" : "0");
        sync();
        deps.onSecurityChanged?.();
      });
    });
    doc.querySelectorAll("[data-shell-settings]").forEach((button) => {
      button.addEventListener("click", () => setPopoverOpen(!isPopoverOpen()));
    });
    doc.querySelectorAll("[data-shell-settings-close]").forEach((button) => {
      button.addEventListener("click", () => setPopoverOpen(false));
    });
    doc.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !isPopoverOpen()) return;
      setPopoverOpen(false);
      doc.querySelector("[data-shell-settings]")?.focus();
    });
    doc.addEventListener("pointerdown", (event) => {
      if (!isPopoverOpen()) return;
      const target = event.target;
      if (target?.closest("#shell-settings, [data-shell-settings]")) return;
      setPopoverOpen(false);
    });
    win.addEventListener("storage", (event) => {
      if (event.key === THEME_KEY) applyTheme(event.newValue);
      if (event.key === THEME_KEY || event.key === PIN_KEY || event.key === AUTO_LOCK_KEY || event.key === null) sync();
      if (event.key === PIN_KEY || event.key === AUTO_LOCK_KEY) deps.onSecurityChanged?.();
    });
    sync();
  }
  return { bind, sync, applyTheme, setPopoverOpen };
}
export {
  AUTO_LOCK_KEY,
  PIN_KEY,
  THEME_KEY,
  createShellSettings,
  normalizeShellTheme
};
