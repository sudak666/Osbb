// Згенеровано з src/osbb-completed-work.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const COMPLETED_WORK_ROLES = ["electrician", "janitor", "plumber"];
function completedWorkDefaultDate(year, month, today = /* @__PURE__ */ new Date()) {
  const validToday = today instanceof Date && !Number.isNaN(today.getTime()) ? today : /* @__PURE__ */ new Date();
  const todayYear = validToday.getFullYear(), todayMonth = validToday.getMonth();
  const safeYear = Number.isInteger(year) && Number(year) >= 2e3 && Number(year) <= 2100 ? Number(year) : todayYear;
  const safeMonth = Number.isInteger(month) && Number(month) >= 0 && Number(month) <= 11 ? Number(month) : todayMonth;
  const day = safeYear === todayYear && safeMonth === todayMonth ? validToday.getDate() : 1;
  return `${safeYear}-${String(safeMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function normalizeCompletedWorkEntry(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value;
  const id = typeof row.id === "string" && /^[0-9a-f-]{36}$/i.test(row.id) ? row.id : null;
  const workDate = typeof row.work_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.work_date) ? row.work_date : "";
  const workerRole = typeof row.worker_role === "string" && COMPLETED_WORK_ROLES.includes(row.worker_role) ? row.worker_role : null;
  const description = typeof row.description === "string" ? row.description.trim() : "";
  const note = typeof row.note === "string" ? row.note.trim() : "";
  return id && workDate && workerRole && description && description.length <= 1e3 && note.length <= 500 ? { id, workDate, workerRole, description, note } : null;
}
function completedWorkEntriesFromResponse(value) {
  return Array.isArray(value) ? value.flatMap((entry) => normalizeCompletedWorkEntry(entry) || []) : [];
}
function validateCompletedWorkDraft(value) {
  const workDate = typeof value?.workDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.workDate) ? value.workDate : "";
  const workerRole = typeof value?.workerRole === "string" && COMPLETED_WORK_ROLES.includes(value.workerRole) ? value.workerRole : null;
  const description = String(value?.description ?? "").trim(), note = String(value?.note ?? "").trim();
  if (!workDate) return { error: "Оберіть дату роботи" };
  if (!workerRole) return { error: "Оберіть виконавця" };
  if (!description) return { error: "Опишіть виконану роботу" };
  if (description.length > 1e3) return { error: "Опис має бути до 1000 символів" };
  if (note.length > 500) return { error: "Примітка має бути до 500 символів" };
  const id = value?.id == null || value.id === "" ? null : typeof value.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) ? value.id : void 0;
  if (id === void 0) return { error: "Некоректний ідентифікатор запису" };
  return { value: { id, workDate, workerRole, description, note } };
}
function filterCompletedWork(entries, query, role = "all") {
  const needle = String(query ?? "").trim().toLocaleLowerCase("uk-UA");
  return entries.filter((entry) => (role === "all" || entry.workerRole === role) && (!needle || `${entry.description} ${entry.note}`.toLocaleLowerCase("uk-UA").includes(needle)));
}
export {
  COMPLETED_WORK_ROLES,
  completedWorkDefaultDate,
  completedWorkEntriesFromResponse,
  filterCompletedWork,
  normalizeCompletedWorkEntry,
  validateCompletedWorkDraft
};
