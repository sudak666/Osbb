// Згенеровано з src/sklad-audit-controller.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
import { escapeHtml } from "./app-security.js";
import { calculateAuditSummary, createAuditData, parseAuditQuantity } from "./sklad-audit.js";
function createSkladAuditController(options) {
  const {
    db,
    document,
    getItems,
    itemMatchesSearch,
    updateResultSummary,
    categoryBadges,
    categoryIcons,
    defaultCategoryIcon,
    toast,
    openModal,
    closeModal,
    loadItems
  } = options;
  let auditData = {};
  let initialized = false;
  let busy = false;
  let startedAt = (/* @__PURE__ */ new Date()).toISOString();
  let baseline = {};
  let request = null;
  const draftKey = "sklad_audit_draft_v1";
  const items = () => getItems();
  function persist() {
    try {
      options.storage?.setItem(draftKey, JSON.stringify({ data: auditData, baseline, startedAt, request, note: document.getElementById("auditNote")?.value || "" }));
    } catch {
      toast("Не вдалося зберегти чернетку на пристрої. Не закривайте вкладку.", "error");
    }
  }
  function reset() {
    auditData = createAuditData(items());
    baseline = {};
    request = null;
    startedAt = (/* @__PURE__ */ new Date()).toISOString();
    const note = document.getElementById("auditNote");
    if (note) note.value = "";
    persist();
    render();
  }
  function updateStats() {
    const current = items();
    const { counted, surplus, shortage, progress } = calculateAuditSummary(current, auditData);
    const stats = document.getElementById("auditStats");
    if (stats) stats.textContent = `Перераховано: ${counted}/${current.length} · ▲ Надлишок: ${surplus} · ▼ Нестача: ${shortage}`;
    const fill = document.getElementById("auditProgressFill");
    const progressBar = document.getElementById("auditProgress");
    if (fill) fill.style.width = progress + "%";
    if (progressBar) progressBar.setAttribute("aria-valuenow", String(progress));
  }
  function render() {
    const current = items();
    const search = document.getElementById("auditSearch")?.value || "";
    const visible = search ? current.filter((item) => itemMatchesSearch(item, search)) : current;
    updateResultSummary("auditResultSummary", visible.length, current.length, search);
    updateStats();
    const list = document.getElementById("auditList");
    if (!list) return;
    if (!visible.length) {
      list.innerHTML = '<div class="empty"><span class="ms ic-16-3">search_off</span> Нічого не знайдено</div>';
      return;
    }
    list.innerHTML = visible.map((item) => {
      const actual = auditData[item.id];
      const counted = actual !== null && actual !== void 0;
      const diff = counted ? actual - item.quantity : null;
      const state = !counted ? "is-pending" : diff > 0 ? "is-surplus" : diff < 0 ? "is-shortage" : "is-match";
      const diffHtml = !counted ? "" : diff > 0 ? `<span class="audit-diff good">▲ +${diff}</span>` : diff < 0 ? `<span class="audit-diff bad">▼ ${diff}</span>` : '<span class="audit-diff good"><span class="ms ic-13-2">check</span> Збігається</span>';
      const category = item.category || "";
      const name = escapeHtml(item.name || "");
      const unit = escapeHtml(item.unit || "");
      return `<div class="audit-item ${state}">
        <div class="audit-item-icon">${categoryIcons[category] || defaultCategoryIcon}</div>
        <div class="audit-item-main"><div class="audit-item-title">${name}</div>
          <div class="audit-item-meta"><span class="badge ${categoryBadges[category] || "bo"} ic-10">${escapeHtml(category || "—")}</span>
          <span>За даними: <b>${escapeHtml(String(item.quantity ?? 0))} ${unit}</b></span>${diffHtml}</div></div>
        <div class="audit-item-control"><div class="audit-input-row">
          <input type="number" id="audit_${item.id}" name="audit_${item.id}" aria-label="Фактичний залишок: ${name}"
            value="${counted ? actual : ""}" placeholder="?" min="0" step="any" class="audit-qty-input" data-audit-input data-item-id="${item.id}">
          <span style="font-size:11px;color:var(--sklad-label3);">${unit}</span></div>
          ${counted ? `<button type="button" class="audit-reset-btn" data-audit-clear data-item-id="${item.id}"><span class="ms ic-12-2">close</span> скинути</button>` : ""}
        </div></div>`;
    }).join("");
  }
  function init() {
    if (!initialized) {
      auditData = createAuditData(items());
      try {
        const saved = JSON.parse(options.storage?.getItem(draftKey) || "null");
        if (saved && saved.data && saved.baseline) {
          for (const [id, value] of Object.entries(saved.data)) {
            const parsed = parseAuditQuantity(value);
            if (parsed !== null && Number.isFinite(saved.baseline[id])) {
              auditData[id] = parsed;
              baseline[id] = saved.baseline[id];
            }
          }
          if (typeof saved.startedAt === "string" && Number.isFinite(Date.parse(saved.startedAt))) startedAt = saved.startedAt;
          if (saved.request && typeof saved.request.key === "string" && typeof saved.request.id === "string") request = saved.request;
          const note = document.getElementById("auditNote");
          if (note) note.value = typeof saved.note === "string" ? saved.note : "";
        }
      } catch {
      }
      initialized = true;
      document.getElementById("auditNote")?.addEventListener?.("input", persist);
    }
    for (const item of items()) if (!(item.id in auditData)) auditData[item.id] = null;
    const date = document.getElementById("auditDate");
    if (date) date.textContent = "Розпочато: " + new Date(startedAt).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    render();
  }
  function input(itemId, value) {
    if (busy) return;
    auditData[itemId] = parseAuditQuantity(value);
    const item = items().find((candidate) => String(candidate.id) === String(itemId));
    if (!item) return updateStats();
    baseline[itemId] = item.quantity;
    if (auditData[itemId] === null) delete baseline[itemId];
    persist();
    const actual = auditData[itemId];
    const counted = actual !== null && actual !== void 0;
    const diff = counted ? actual - item.quantity : null;
    const row = document.getElementById("audit_" + itemId)?.closest?.(".audit-item");
    if (row) {
      row.classList.remove("is-pending", "is-surplus", "is-shortage", "is-match");
      row.classList.add(!counted ? "is-pending" : diff > 0 ? "is-surplus" : diff < 0 ? "is-shortage" : "is-match");
      const meta = row.querySelector(".audit-item-meta");
      meta?.querySelector(".audit-diff")?.remove();
      if (meta && counted) {
        const indicator = document.createElement("span");
        indicator.className = "audit-diff " + (diff < 0 ? "bad" : "good");
        if (diff > 0) indicator.textContent = `▲ +${diff}`;
        else if (diff < 0) indicator.textContent = `▼ ${diff}`;
        else indicator.innerHTML = '<span class="ms ic-13-2">check</span> Збігається';
        meta.appendChild(indicator);
      }
    }
    updateStats();
  }
  function clear(itemId) {
    if (busy) return;
    auditData[itemId] = null;
    delete baseline[itemId];
    persist();
    render();
  }
  function fillCurrent() {
    if (busy) return;
    auditData = createAuditData(items(), true);
    baseline = Object.fromEntries(items().map((item) => [item.id, item.quantity]));
    persist();
    render();
    toast("Підставлено поточні залишки", "success");
  }
  function fillZeros() {
    if (!busy) reset();
  }
  function openConfirm() {
    const summary = calculateAuditSummary(items(), auditData);
    const target = document.getElementById("auditSummary");
    if (target) target.innerHTML = `<div class="audit-summary-grid">
      <div class="audit-summary-tile"><div class="audit-summary-value counted">${summary.counted}</div><div class="audit-summary-label">Перераховано</div></div>
      <div class="audit-summary-tile"><div class="audit-summary-value uncounted">${summary.uncounted}</div><div class="audit-summary-label">Не перераховано</div></div>
      <div class="audit-summary-tile"><div class="audit-summary-value surplus">▲ ${summary.surplus}</div><div class="audit-summary-label">Надлишок</div></div>
      <div class="audit-summary-tile"><div class="audit-summary-value shortage">▼ ${summary.shortage}</div><div class="audit-summary-label">Нестача</div></div></div>
      ${summary.uncounted > 0 ? `<div class="audit-summary-warning"><span class="ms ic-14-2">warning</span> ${summary.uncounted} товарів не будуть оновлені (поле порожнє)</div>` : ""}`;
    openModal("auditModal");
  }
  async function confirm() {
    if (busy) return;
    const current = items();
    const { countedItems } = calculateAuditSummary(current, auditData);
    if (!countedItems.length) return toast("Спочатку перерахуйте хоча б один товар", "error");
    const rows = countedItems.map((item) => ({ item_id: item.id, qty_before: baseline[item.id] ?? item.quantity, qty_actual: auditData[item.id] }));
    const note = document.getElementById("auditNote")?.value.trim() || "";
    const key = JSON.stringify({ rows, note });
    if (request?.key !== key) request = { key, id: (options.createRequestId || (() => crypto.randomUUID()))() };
    persist();
    busy = true;
    const button = document.querySelector?.('[data-sklad-action="audit-confirm-save"]');
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
    try {
      const { data, error } = await db.rpc("complete_inventory_audit", { p_rows: rows, p_note: note || null, p_client_request_id: request.id });
      if (error || !data) {
        const conflict = error?.message?.includes("inventory_changed");
        toast(conflict ? "Залишки змінилися. Чернетку збережено. Оновіть дані й повторно перерахуйте змінені товари." : "Інвентаризацію не підтверджено. Чернетку збережено — спробуйте ще раз.", "error");
        return;
      }
      closeModal("auditModal");
      reset();
      toast("Інвентаризацію збережено. Усі залишки оновлено.", "success");
      try {
        await loadItems();
      } catch {
        toast("Запис збережено, але список не оновився. Натисніть «Оновити».", "error");
      }
    } catch {
      toast("Немає підтвердження сервера. Чернетку збережено — повторіть операцію.", "error");
    } finally {
      busy = false;
      if (button) {
        button.disabled = false;
        button.setAttribute("aria-busy", "false");
      }
    }
  }
  return { clear, confirm, fillCurrent, fillZeros, init, input, openConfirm, render };
}
export {
  createSkladAuditController
};
