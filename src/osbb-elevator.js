// Згенеровано з src/osbb-elevator.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
function createElevatorEntry(day, text, createdBy, options = {}) {
  const normalizedText = String(text ?? "").trim();
  if (!normalizedText || normalizedText.length > 1e3) return null;
  const now = options.now ?? /* @__PURE__ */ new Date();
  const numericDay = Number(day);
  const normalizedDay = Number.isInteger(numericDay) && numericDay > 0 ? numericDay : 1;
  const suffix = options.idSuffix ?? Math.random().toString(36).slice(2, 6);
  return {
    id: `e${now.getTime()}${suffix}`,
    day: normalizedDay,
    text: normalizedText,
    createdAt: now.toISOString(),
    createdBy: String(createdBy ?? "").trim().slice(0, 100)
  };
}
function elevatorEntriesFromResponse(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const row = entry;
    if (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(row.id) || !Number.isInteger(row.day) || row.day < 1 || row.day > 31) return [];
    if (typeof row.text !== "string" || !row.text.trim() || row.text.trim().length > 1e3) return [];
    return [{
      id: row.id,
      day: row.day,
      text: row.text.trim(),
      createdAt: typeof row.createdAt === "string" && Number.isFinite(Date.parse(row.createdAt)) ? row.createdAt : "",
      createdBy: typeof row.createdBy === "string" && row.createdBy.trim().length <= 100 ? row.createdBy.trim() : ""
    }];
  });
}
function removeElevatorEntry(entries, id) {
  return entries.filter((entry) => entry.id !== id);
}
function sortElevatorEntries(entries) {
  return [...entries].sort((first, second) => first.day - second.day);
}
export {
  createElevatorEntry,
  elevatorEntriesFromResponse,
  removeElevatorEntry,
  sortElevatorEntries
};
