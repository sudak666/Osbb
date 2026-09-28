// Згенеровано з src/osbb-client-state.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const OSBB_THEME_STORAGE_KEY = "selected_theme";
function normalizeOsbbTheme(value) {
  return value === "theme-dark" ? "theme-dark" : "theme-light";
}
function loadOsbbTheme(storage) {
  try {
    return normalizeOsbbTheme(storage.getItem(OSBB_THEME_STORAGE_KEY));
  } catch {
    return "theme-light";
  }
}
function saveOsbbTheme(storage, theme) {
  const normalized = normalizeOsbbTheme(theme);
  try {
    storage.setItem(OSBB_THEME_STORAGE_KEY, normalized);
  } catch {
  }
  return normalized;
}
function nextOsbbTheme(theme) {
  return normalizeOsbbTheme(theme) === "theme-dark" ? "theme-light" : "theme-dark";
}
function formatTimeMaskValue(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  const hours = Number(digits.slice(0, 2)) > 23 ? "23" : digits.slice(0, 2);
  const rawMinutes = digits.slice(2, 4);
  const minutes = rawMinutes.length === 2 && Number(rawMinutes) > 59 ? "59" : rawMinutes;
  return `${hours}:${minutes}`;
}
function isCompleteTimeValue(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? ""));
}
function shouldApplyRealtimeRefresh(currentTab, targetTab, activeTagName) {
  if (typeof currentTab !== "string" || currentTab !== targetTab) return false;
  const tagName = typeof activeTagName === "string" ? activeTagName.toUpperCase() : "";
  return tagName !== "INPUT" && tagName !== "TEXTAREA";
}
export {
  OSBB_THEME_STORAGE_KEY,
  formatTimeMaskValue,
  isCompleteTimeValue,
  loadOsbbTheme,
  nextOsbbTheme,
  normalizeOsbbTheme,
  saveOsbbTheme,
  shouldApplyRealtimeRefresh
};
