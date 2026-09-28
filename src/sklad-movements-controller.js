// Згенеровано з src/sklad-movements-controller.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
import { deleteInventoryResultFromRpcResponse } from "./sklad-state.js";
import { adjustedStockAfterMovementEdit, buildIssueEditPatch, buildIssuePayload, buildReceiptEditPatch, buildReceiptPayload } from "./sklad-movements.js";
import { dateInputToTimestamp, dateToInputValue } from "./sklad-dates.js";
function isTransportError(error) {
  return Boolean(error) && !error.code;
}
const MOVEMENT_ERROR_MESSAGES = {
  item_not_found: "Товар не знайдено — оновіть список.",
  log_not_found: "Запис видачі не знайдено — оновіть журнал.",
  receipt_not_found: "Запис приходу не знайдено — оновіть журнал.",
  invalid_quantity: "Вкажіть коректну кількість.",
  invalid_purchase_price: "Вкажіть коректну ціну закупівлі."
};
function movementErrorMessage(error) {
  if (isTransportError(error)) return "Немає зʼєднання з сервером. Перевірте інтернет і повторіть — дубля не буде.";
  const message = String(error?.message || "");
  const known = Object.keys(MOVEMENT_ERROR_MESSAGES).find((key) => message.includes(key));
  return known ? MOVEMENT_ERROR_MESSAGES[known] : "Помилка сервера. Спробуйте ще раз.";
}
function createSkladMovementsController(options) {
  const {
    db,
    warn = console.warn,
    document,
    getItems = () => [],
    getLogs = () => [],
    getReceipts = () => [],
    openModal = () => {
    },
    closeModal = () => {
    },
    requestDeletePin = () => {
    },
    toast = () => {
    },
    loadItems = async () => {
    },
    loadLogs = async () => {
    },
    loadReceipts = async () => {
    },
    optionalPrice = (value) => value,
    syncSupplierTags = () => {
    },
    setButtonLoading = () => () => {
    },
    refreshSelect = () => {
    },
    inventoryUnit = (_data, fallback) => fallback,
    populateSelects = () => {
    },
    renderLowStock = () => {
    },
    loadRecentIssues = async () => {
    },
    nowDate = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    findItem = (id) => getItems().find((item) => item.id === id),
    createRequestId = () => globalThis.crypto.randomUUID()
  } = options;
  const pendingRequests = /* @__PURE__ */ new Map();
  function requestIdFor(kind, payload) {
    const key = JSON.stringify(payload);
    const current = pendingRequests.get(kind);
    if (current && current.key === key) return current.id;
    const id = createRequestId();
    pendingRequests.set(kind, { key, id });
    return id;
  }
  function settleRequest(kind, error) {
    if (!error || !isTransportError(error)) pendingRequests.delete(kind);
  }
  const state = {
    deletingLogId: null,
    editingLogId: null,
    deletingReceiptId: null,
    editingReceiptId: null
  };
  async function runDelete(name, args) {
    try {
      const { data, error } = await db.rpc(name, args);
      if (error) {
        warn(name + " failed", error);
        return { ok: false, reason: "network" };
      }
      return deleteInventoryResultFromRpcResponse(data);
    } catch (error) {
      warn(name + " failed", error);
      return { ok: false, reason: "network" };
    }
  }
  function setPending(kind, id) {
    if (!Object.hasOwn(state, kind)) return false;
    state[kind] = Number.isFinite(Number(id)) && Number(id) > 0 ? Number(id) : null;
    return true;
  }
  function pending(kind) {
    return Object.hasOwn(state, kind) ? state[kind] : null;
  }
  async function issueItem(itemId, quantity, person, note, occurredAt) {
    const item = findItem(itemId, "видача");
    if (!item) return false;
    const args = { p_item_id: itemId, p_qty: quantity, p_person: person, p_note: note || null, p_issued_at: occurredAt || null };
    const { data, error } = await db.rpc("issue_item", { ...args, p_client_request_id: requestIdFor("issue", args) });
    settleRequest("issue", error);
    if (error) {
      if ((error.message || "").includes("insufficient_stock")) toast(`Недостатньо! Залишок: ${item.quantity} ${item.unit}`, "error");
      else toast(movementErrorMessage(error), "error");
      return false;
    }
    const unit = inventoryUnit(data, item.unit);
    toast(`Видано: ${quantity} ${unit} → ${person}`, "success");
    await loadItems();
    return true;
  }
  async function submitQuickIssue(button, itemId) {
    const payload = buildIssuePayload({ itemId, quantity: document.getElementById("qmQtyI").value, person: document.getElementById("qmPersonI").value });
    if (!payload.ok) return toast(payload.error === "person" ? "Вкажіть кому!" : "Вкажіть кількість!", "error");
    const done = setButtonLoading(button, "Видаю...");
    if (!done) return;
    try {
      const { quantity, person } = payload.value;
      if (await issueItem(payload.value.itemId, quantity, person, "", null)) closeModal("qModal");
    } catch (error) {
      warn("quick issue failed", error);
      toast("Не вдалося виконати видачу. Спробуйте ще раз.", "error");
    } finally {
      done();
    }
  }
  async function submitIssue(button) {
    const payload = buildIssuePayload({
      itemId: document.getElementById("issueItemSel").value,
      quantity: document.getElementById("issueQtyI").value,
      person: document.getElementById("issuePersonI").value,
      note: document.getElementById("issueNoteI").value,
      occurredAt: dateInputToTimestamp(document.getElementById("issueDateI").value)
    });
    if (!payload.ok) {
      const messages = { item: "Оберіть товар!", quantity: "Вкажіть кількість!", person: "Вкажіть кому!" };
      return toast(messages[payload.error] || "Перевірте дані видачі", "error");
    }
    const done = setButtonLoading(button, "Видаю...");
    if (!done) return;
    try {
      const { itemId, quantity, person, note, occurredAt } = payload.value;
      if (!await issueItem(itemId, quantity, person, note, occurredAt)) return;
      ["issueItemSel", "issueQtyI", "issuePersonI", "issueNoteI"].forEach((id) => {
        document.getElementById(id).value = "";
      });
      document.getElementById("issueDateI").value = nowDate();
      refreshSelect(document.getElementById("issueItemSel"));
      document.getElementById("issueInfo").style.display = "none";
      await loadRecentIssues();
    } catch (error) {
      warn("issue submit failed", error);
      toast("Не вдалося виконати видачу. Спробуйте ще раз.", "error");
    } finally {
      done();
    }
  }
  async function submitReceipt(button) {
    const payload = buildReceiptPayload({
      itemId: document.getElementById("refillSel").value,
      quantity: document.getElementById("refillQtyI").value,
      purchasePrice: optionalPrice(document.getElementById("refillPriceI").value),
      supplier: document.getElementById("refillSupplierI").value,
      note: document.getElementById("refillNoteI").value,
      occurredAt: dateInputToTimestamp(document.getElementById("refillDateI").value)
    });
    if (!payload.ok) {
      const messages = { item: "Оберіть товар!", quantity: "Вкажіть кількість!", price: "Вкажіть коректну ціну закупівлі" };
      return toast(messages[payload.error] || "Перевірте дані приходу", "error");
    }
    const { itemId, quantity, purchasePrice, supplier, note, occurredAt } = payload.value;
    const item = findItem(itemId, "прихід");
    if (!item) return;
    const done = setButtonLoading(button, "Поповнюю...");
    if (!done) return;
    try {
      const args = { p_item_id: itemId, p_qty: quantity, p_supplier: supplier || null, p_note: note || null, p_received_at: occurredAt || null, p_price_unit: purchasePrice || null };
      const { data, error } = await db.rpc("receive_item", { ...args, p_client_request_id: requestIdFor("receipt", args) });
      settleRequest("receipt", error);
      if (error) return toast(movementErrorMessage(error), "error");
      const unit = inventoryUnit(data, item.unit);
      toast(`Поповнено +${quantity} ${unit}`, "success");
      ["refillQtyI", "refillPriceI", "refillSupplierI", "refillNoteI", "refillSel"].forEach((id) => {
        document.getElementById(id).value = "";
      });
      syncSupplierTags("refillSupplierI", "");
      document.getElementById("refillDateI").value = nowDate();
      document.getElementById("refillInfo").style.display = "none";
      await loadItems();
      populateSelects();
      renderLowStock();
    } catch (error) {
      warn("receipt submit failed", error);
      toast("Не вдалося зберегти прихід. Спробуйте ще раз.", "error");
    } finally {
      done();
    }
  }
  function openDeleteLog(id) {
    const log = getLogs().find((row) => row.id === id);
    if (!log) return;
    setPending("deletingLogId", id);
    const unit = getItems().find((item) => item.id === log.item_id)?.unit || "";
    document.getElementById("delLogItemName").textContent = `${log.item_name} · ${log.quantity} ${unit} · ${log.issued_to || "—"}`;
    openModal("delLogModal");
  }
  async function confirmDeleteLog() {
    const id = pending("deletingLogId");
    if (!id) return;
    closeModal("delLogModal");
    requestDeletePin("PIN для видалення запису", async (pin) => {
      const result = await runDelete("delete_inventory_log", { p_log_id: id, attempt: pin });
      if (result.ok) {
        toast("Запис видалено, товар повернуто на склад", "success");
        setPending("deletingLogId", null);
        await loadItems();
        await loadLogs();
      }
      return result;
    });
  }
  function openDeleteReceipt(id) {
    const receipt = getReceipts().find((row) => row.id === id);
    if (!receipt) return;
    setPending("deletingReceiptId", id);
    const unit = getItems().find((item) => item.id === receipt.item_id)?.unit || "";
    document.getElementById("delReceiptItemName").textContent = `${receipt.item_name} · +${receipt.quantity} ${unit} · ${receipt.supplier || "—"}`;
    openModal("delReceiptModal");
  }
  async function confirmDeleteReceipt() {
    const id = pending("deletingReceiptId");
    if (!id) return;
    closeModal("delReceiptModal");
    requestDeletePin("PIN для видалення приходу", async (pin) => {
      const result = await runDelete("delete_inventory_receipt", { p_receipt_id: id, attempt: pin });
      if (result.ok) {
        toast("Прихід видалено, залишок скориговано", "success");
        setPending("deletingReceiptId", null);
        await loadItems();
        await loadReceipts();
      }
      return result;
    });
  }
  function openEditLog(id) {
    const log = getLogs().find((row) => row.id === id);
    if (!log) return;
    setPending("editingLogId", id);
    const item = getItems().find((row) => row.id === log.item_id);
    document.getElementById("editLogItemName").textContent = `${log.item_name}${item ? " · поточний залишок: " + item.quantity + " " + item.unit : ""}`;
    document.getElementById("editLogQty").value = log.quantity;
    document.getElementById("editLogDate").value = dateToInputValue(log.issued_at);
    document.getElementById("editLogPerson").value = log.issued_to || "";
    document.getElementById("editLogNote").value = log.note || "";
    openModal("editLogModal");
  }
  async function saveEditLog() {
    const id = pending("editingLogId");
    const log = getLogs().find((row) => row.id === id);
    if (!log) return closeModal("editLogModal");
    const built = buildIssueEditPatch({
      quantity: document.getElementById("editLogQty").value,
      person: document.getElementById("editLogPerson").value,
      note: document.getElementById("editLogNote").value,
      occurredAt: dateInputToTimestamp(document.getElementById("editLogDate").value)
    });
    if (!built.ok) return toast("Введіть коректну кількість", "error");
    const item = getItems().find((row) => row.id === log.item_id);
    if (item && adjustedStockAfterMovementEdit(item.quantity, log.quantity, built.value.quantity, "issue") === null) {
      return toast("Недостатньо товару на складі для такої кількості", "error");
    }
    const { error } = await db.rpc("update_inventory_log", {
      p_log_id: id,
      p_qty: built.value.quantity,
      p_person: built.value.issued_to,
      p_note: built.value.note,
      p_issued_at: built.value.issued_at || null
    });
    if (error) {
      if ((error.message || "").includes("insufficient_stock")) return toast("Недостатньо товару на складі для такої кількості", "error");
      return toast(movementErrorMessage(error), "error");
    }
    toast("Запис оновлено", "success");
    closeModal("editLogModal");
    setPending("editingLogId", null);
    await loadItems();
    await loadLogs();
  }
  function openEditReceipt(id) {
    const receipt = getReceipts().find((row) => row.id === id);
    if (!receipt) return;
    setPending("editingReceiptId", id);
    const item = getItems().find((row) => row.id === receipt.item_id);
    document.getElementById("editReceiptItemName").textContent = `${receipt.item_name}${item ? " · поточний залишок: " + item.quantity + " " + item.unit : ""}`;
    document.getElementById("editReceiptQty").value = receipt.quantity;
    document.getElementById("editReceiptDate").value = dateToInputValue(receipt.received_at);
    document.getElementById("editReceiptPrice").value = receipt.purchase_price_unit || item?.price_unit || "";
    document.getElementById("editReceiptSupplier").value = receipt.supplier || "";
    syncSupplierTags("editReceiptSupplier", receipt.supplier || "");
    document.getElementById("editReceiptNote").value = receipt.note || "";
    openModal("editReceiptModal");
  }
  async function saveEditReceipt() {
    const id = pending("editingReceiptId");
    const receipt = getReceipts().find((row) => row.id === id);
    if (!receipt) return closeModal("editReceiptModal");
    const built = buildReceiptEditPatch({
      quantity: document.getElementById("editReceiptQty").value,
      purchasePrice: optionalPrice(document.getElementById("editReceiptPrice").value),
      supplier: document.getElementById("editReceiptSupplier").value,
      note: document.getElementById("editReceiptNote").value,
      occurredAt: dateInputToTimestamp(document.getElementById("editReceiptDate").value)
    });
    if (!built.ok) return toast(built.error === "price" ? "Введіть коректну ціну закупівлі" : "Введіть коректну кількість", "error");
    const item = getItems().find((row) => row.id === receipt.item_id);
    if (item && adjustedStockAfterMovementEdit(item.quantity, receipt.quantity, built.value.quantity, "receipt") === null) {
      return toast("Це призведе до від'ємного залишку", "error");
    }
    const { error } = await db.rpc("update_inventory_receipt", {
      p_receipt_id: id,
      p_qty: built.value.quantity,
      p_supplier: built.value.supplier,
      p_note: built.value.note,
      p_received_at: built.value.received_at || null,
      p_price_unit: built.value.purchase_price_unit || null
    });
    if (error) {
      if ((error.message || "").includes("negative_stock")) return toast("Це призведе до від'ємного залишку", "error");
      return toast(movementErrorMessage(error), "error");
    }
    toast("Прихід оновлено", "success");
    closeModal("editReceiptModal");
    setPending("editingReceiptId", null);
    await loadItems();
    await loadReceipts();
  }
  return {
    confirmDeleteLog,
    confirmDeleteReceipt,
    issueItem,
    openDeleteLog,
    openDeleteReceipt,
    openEditLog,
    openEditReceipt,
    pending,
    runDelete,
    saveEditLog,
    saveEditReceipt,
    setPending,
    submitIssue,
    submitQuickIssue,
    submitReceipt
  };
}
export {
  createSkladMovementsController,
  isTransportError,
  movementErrorMessage
};
