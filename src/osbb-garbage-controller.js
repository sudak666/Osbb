// Згенеровано з src/osbb-garbage-controller.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
import { garbageMonthBinsTotal, garbageMonthKey, garbageMonthKeyCandidates, garbageYearRowsFromResponse, migrateGarbageData, normalizeGarbageMonth } from "./osbb-garbage.js";
function createOsbbGarbageController(options) {
  const {
    document,
    storage,
    isPreview,
    getMonth,
    getCurrentTab,
    readOffline,
    writeOffline,
    removeOffline,
    fetchMonth,
    upsertMonth,
    saveDay,
    fetchYear,
    resetMonth,
    requestResetPin,
    render,
    now = () => /* @__PURE__ */ new Date(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    warn = console.error
  } = options;
  let data = {}, loaded = false, saveTimer = null, saving = null;
  const monthKey = (year = getMonth().year, month = getMonth().month) => garbageMonthKey(year, month);
  const offlineKey = (year = getMonth().year, month = getMonth().month) => `garbage_${year}_${month}`;
  const migrate = (value) => migrateGarbageData(normalizeGarbageMonth(value));
  function setStatus(type, text) {
    const element = document.getElementById("g-sync-status");
    if (!element) return;
    const classes = { loading: "is-loading", ok: "is-ok", error: "is-error" };
    element.className = `journal-status-chip ${classes[type] || classes.ok}`;
    element.innerHTML = text;
  }
  function saveOffline() {
    writeOffline(storage, offlineKey(), data);
  }
  function loadOffline() {
    return readOffline(storage, offlineKey());
  }
  const dirtyKey = (year = getMonth().year, month = getMonth().month) => `garbage_dirty_${year}_${month}`;
  function loadDirty() {
    const value = readOffline(storage, dirtyKey());
    return new Set(Array.isArray(value) ? value.filter((day) => /^(0?[1-9]|[12]\d|3[01])$/.test(String(day))).map(String) : []);
  }
  function saveDirty(days) {
    if (days.size) writeOffline(storage, dirtyKey(), [...days]);
    else removeOffline(storage, dirtyKey());
  }
  function markDirty(day) {
    const days = loadDirty();
    days.add(String(day));
    saveDirty(days);
  }
  async function findMonth(year = getMonth().year, month = getMonth().month) {
    for (const key of garbageMonthKeyCandidates(year, month)) {
      const response = await fetchMonth(key);
      if (!response.error && response.data) return { data: response.data, monthKey: key };
      if (response.error && response.error.code !== "PGRST116") throw response.error;
    }
    return { data: null, monthKey: monthKey(year, month) };
  }
  async function saveWholeMonth() {
    if (isPreview) return;
    const { error } = await upsertMonth({ month_key: monthKey(), data });
    if (error) throw error;
  }
  const hasContent = (row) => Boolean(row && (row.time || row.worker || Object.keys(row.types || {}).length || row.count || row.note));
  async function syncDay(day, keepalive) {
    const row = hasContent(data[day]) ? data[day] : null;
    const { error } = await saveDay({ p_month_key: monthKey(), p_day: day, p_row: row }, { keepalive });
    if (error) throw error;
    const remaining = loadDirty();
    remaining.delete(day);
    saveDirty(remaining);
  }
  async function syncDirtyDays({ keepalive = false } = {}) {
    const days = [...loadDirty()];
    if (keepalive) {
      await Promise.all(days.map((day) => syncDay(day, true)));
      return;
    }
    for (const day of days) await syncDay(day, false);
  }
  async function saveCloud(options2 = {}) {
    if (isPreview) {
      setStatus("ok", '<span class="status-label">Превʼю</span>');
      return;
    }
    if (saving) {
      await saving.catch(() => {
      });
      if (!loadDirty().size) return;
    }
    saving = syncDirtyDays(options2);
    try {
      await saving;
      setStatus("ok", '<span class="status-label">Збережено</span>');
    } catch (error) {
      warn("garbage save error:", error);
      setStatus("error", `<span class="status-label">${globalThis.navigator?.onLine === false ? "Офлайн — збережеться пізніше" : "Помилка"}</span>`);
    } finally {
      saving = null;
    }
  }
  function scheduleSave(day) {
    markDirty(day);
    setStatus("loading", '<span class="status-label">Зберігаю...</span>');
    saveOffline();
    clearTimer(saveTimer);
    saveTimer = setTimer(() => {
      saveTimer = null;
      saveCloud();
    }, 1200);
  }
  function flush({ keepalive = true } = {}) {
    if (saveTimer !== null) {
      clearTimer(saveTimer);
      saveTimer = null;
    }
    if (isPreview || !loadDirty().size) return Promise.resolve();
    return saveCloud({ keepalive });
  }
  function applyDirtyDays(base, offline) {
    const merged = { ...base || {} };
    for (const day of loadDirty()) {
      if (offline && offline[day]) merged[day] = offline[day];
      else delete merged[day];
    }
    return merged;
  }
  async function init() {
    setStatus("loading", '<span class="status-label">Завантаження...</span>');
    const offlineMigration = migrate(loadOffline());
    const offline = offlineMigration.data;
    if (offline) {
      data = offline;
      render();
    }
    if (isPreview) {
      data = offline || {};
      loaded = true;
      setStatus("ok", '<span class="status-label">Превʼю</span>');
      render();
      return;
    }
    try {
      const response = await findMonth();
      const cloudMigration = migrate(response.data?.data);
      data = applyDirtyDays(cloudMigration.data || (response.data ? {} : offline) || {}, offline);
      saveOffline();
      if (cloudMigration.migrated) await saveWholeMonth();
      if (loadDirty().size) await saveCloud();
      else setStatus("ok", '<span class="status-label">Синхронізовано</span>');
    } catch (error) {
      warn("garbage load error:", error);
      data = offline || {};
      setStatus("error", `<span class="status-label">${offline ? "Офлайн" : "Немає даних"}</span>`);
    }
    loaded = true;
    render();
  }
  function updateRow(day, field, value) {
    data[day] ||= { time: "", worker: "", types: {} };
    data[day].types ||= {};
    data[day][field] = value;
    scheduleSave(day);
    render();
  }
  function updateType(day, type, value) {
    data[day] ||= { time: "", worker: "", types: {} };
    data[day].types ||= {};
    const count = Number.parseInt(value, 10) || 0;
    if (count > 0) data[day].types[type] = count;
    else delete data[day].types[type];
    if (count > 0 && !data[day].time) {
      const date = now();
      data[day].time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }
    scheduleSave(day);
    render();
  }
  async function loadYear(year) {
    if (isPreview) return;
    try {
      const { data: rowsValue, error } = await fetchYear();
      if (error) throw error;
      const rows = garbageYearRowsFromResponse(rowsValue);
      for (let month = 0; month < 12; month++) {
        const row = garbageMonthKeyCandidates(year, month).map((key2) => rows.find((item) => item.month_key === key2)).find(Boolean);
        const key = offlineKey(year, month);
        if (!row?.data) {
          removeOffline(storage, key);
          continue;
        }
        writeOffline(storage, key, migrate(row.data).data || {});
      }
    } catch (error) {
      warn("garbage yearly chart load error:", error);
    }
  }
  async function initDashboard() {
    const offlineMigration = migrate(loadOffline());
    const offline = offlineMigration.data;
    if (offline && !loaded) data = offline;
    if (getCurrentTab() === "garbage") return;
    if (isPreview) {
      if (!loaded) data = offline || {};
      return;
    }
    try {
      const response = await findMonth();
      const cloud = migrate(response.data?.data);
      data = applyDirtyDays(cloud.data || (response.data ? {} : offline) || {}, offline);
      saveOffline();
      if (cloud.migrated) await saveWholeMonth();
      if (loadDirty().size) await saveCloud();
    } catch (error) {
      warn("garbage dashboard load error:", error);
      data = offline || {};
    }
    await loadYear(getMonth().year);
  }
  function monthlyTotals(year = getMonth().year) {
    const current = getMonth();
    return Array.from({ length: 12 }, (_, month) => month === current.month ? garbageMonthBinsTotal(data) : garbageMonthBinsTotal(readOffline(storage, offlineKey(year, month))));
  }
  function clearMonth() {
    requestResetPin(async (pin) => {
      if (!isPreview) {
        let reset = false;
        try {
          reset = await resetMonth({ table_name: "garbage", p_month_key: monthKey(), attempt: pin }) === true;
        } catch (error) {
          warn("garbage reset error:", error);
        }
        if (!reset) {
          setStatus("error", '<span class="status-label">Не скинуто — спробуйте ще раз</span>');
          return;
        }
      }
      if (saveTimer !== null) {
        clearTimer(saveTimer);
        saveTimer = null;
      }
      data = {};
      saveOffline();
      saveDirty(/* @__PURE__ */ new Set());
      setStatus("ok", '<span class="status-label">Скинуто</span>');
      render();
    });
  }
  return { clearMonth, findMonth, flush, getData: () => data, init, initDashboard, isLoaded: () => loaded, loadYear, monthlyTotals, resetLoaded: () => {
    loaded = false;
  }, saveCloud, setStatus, updateRow, updateType };
}
export {
  createOsbbGarbageController
};
