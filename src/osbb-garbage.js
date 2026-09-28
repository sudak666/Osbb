// Згенеровано з src/osbb-garbage.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
function garbageCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : void 0;
}
function garbageTime(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "";
}
function garbageWorker(value) {
  if (typeof value !== "string") return "";
  const worker = value.trim();
  return worker.length <= 100 ? worker : "";
}
function normalizeGarbageMonth(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const month = {};
  for (const [day, entry] of Object.entries(value)) {
    const numericDay = Number(day);
    if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) continue;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const row = entry;
    if (!row.types || typeof row.types !== "object" || Array.isArray(row.types)) {
      month[day] = {
        time: garbageTime(row.time),
        worker: garbageWorker(row.worker),
        count: row.count,
        note: typeof row.note === "string" ? row.note : ""
      };
      continue;
    }
    const sourceTypes = row.types;
    const types = {};
    for (const type of ["plastic", "glass", "bins"]) {
      const count = garbageCount(sourceTypes[type]);
      if (count !== void 0) types[type] = count;
    }
    month[day] = {
      time: garbageTime(row.time),
      worker: garbageWorker(row.worker),
      types
    };
  }
  return month;
}
function garbageMonthKey(year, month) {
  return `${year}-${month}`;
}
function garbageMonthKeyCandidates(year, month) {
  return [.../* @__PURE__ */ new Set([
    garbageMonthKey(year, month),
    `${year}-${String(month).padStart(2, "0")}`
  ])];
}
function garbageYearRowsFromResponse(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const row = entry;
    if (typeof row.month_key !== "string" || !/^\d{4}-(?:\d|0\d|1[01])$/.test(row.month_key)) return [];
    if (typeof row.data !== "object" || row.data === null || Array.isArray(row.data)) return [];
    return [{ month_key: row.month_key, data: normalizeGarbageMonth(row.data) }];
  });
}
function migrateGarbageData(data) {
  if (!data) return { data, migrated: false };
  let migrated = false;
  const output = { ...data };
  for (const [day, row] of Object.entries(output)) {
    if (!row || row.types) continue;
    if (row.count === void 0 && row.note === void 0) continue;
    const count = Number.parseInt(String(row.count ?? ""), 10) || 0;
    const types = {};
    if (count > 0) {
      if (row.note === "plastic") types.plastic = count;
      else if (row.note === "glass") types.glass = count;
      else if (row.note === "both") {
        types.plastic = count;
        types.glass = count;
      } else types.bins = count;
    }
    output[day] = { time: garbageTime(row.time), worker: garbageWorker(row.worker), types };
    migrated = true;
  }
  return { data: output, migrated };
}
function garbageBins(types) {
  return Number.parseInt(String(types?.bins ?? ""), 10) || 0;
}
function garbageMonthBinsTotal(value) {
  const { data } = migrateGarbageData(normalizeGarbageMonth(value));
  return Object.values(data || {}).reduce((total, row) => total + garbageBins(row.types), 0);
}
export {
  garbageBins,
  garbageMonthBinsTotal,
  garbageMonthKey,
  garbageMonthKeyCandidates,
  garbageYearRowsFromResponse,
  migrateGarbageData,
  normalizeGarbageMonth
};
