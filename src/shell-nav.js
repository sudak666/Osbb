// Згенеровано з src/shell-nav.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const SHELL_SECTIONS = {
  home: { module: null, label: "Головна", icon: "home" },
  "completed-work": { module: "journal", label: "Виконані роботи", icon: "task_alt" },
  garbage: { module: "journal", label: "Сміття", icon: "delete" },
  shifts: { module: "journal", label: "Зміни", icon: "calendar_clock" },
  tabel: { module: "journal", label: "Табель", icon: "schedule" },
  items: { module: "sklad", label: "Запаси", icon: "inventory_2" },
  log: { module: "sklad", label: "Рух товарів", icon: "swap_vert" },
  audit: { module: "sklad", label: "Інвентаризація", icon: "fact_check" },
  stats: { module: "sklad", label: "Статистика", icon: "bar_chart" }
};
const DEFAULT_SECTION = "home";
const MOBILE_PRIMARY_SECTIONS = ["home", "garbage", "tabel", "items"];
function isShellSection(value) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SHELL_SECTIONS, value);
}
function sectionModule(section) {
  return SHELL_SECTIONS[section].module;
}
const MODULE_PAGE_ALIASES = {
  journal: {},
  sklad: { issue: "items", add: "items", receipts: "log" }
};
function sectionForModulePage(module, page) {
  if (typeof page !== "string") return null;
  const aliases = MODULE_PAGE_ALIASES[module];
  if (Object.prototype.hasOwnProperty.call(aliases, page)) return aliases[page] ?? null;
  return isShellSection(page) && SHELL_SECTIONS[page].module === module ? page : null;
}
function isMobilePrimarySection(section) {
  return MOBILE_PRIMARY_SECTIONS.includes(section);
}
const SECTION_FOCUS_TARGETS = {
  "completed-work": ["elevator"]
};
function isSectionFocus(section, focus) {
  return typeof focus === "string" && (SECTION_FOCUS_TARGETS[section] ?? []).includes(focus);
}
function defaultSectionFor(module) {
  return module === "journal" ? "garbage" : "items";
}
export {
  DEFAULT_SECTION,
  MOBILE_PRIMARY_SECTIONS,
  SHELL_SECTIONS,
  defaultSectionFor,
  isMobilePrimarySection,
  isSectionFocus,
  isShellSection,
  sectionForModulePage,
  sectionModule
};
