import { deleteInventoryResultFromRpcResponse } from './sklad-state.ts';
import type { DeleteInventoryResult } from './sklad-state.ts';
import { adjustedStockAfterMovementEdit, buildIssueEditPatch, buildIssuePayload, buildReceiptEditPatch, buildReceiptPayload } from './sklad-movements.ts';
import { dateInputToTimestamp, dateToInputValue } from './sklad-dates.ts';
import type { RequestDeletePinFn, SetButtonLoadingFn, SupabaseLike, ToastFn, WarnFn } from './controller-types.ts';

export type MovementPendingKey = 'deletingLogId' | 'editingLogId' | 'deletingReceiptId' | 'editingReceiptId';

interface MovementItem { id: number; name?: string; quantity: number; unit: string; price_unit?: number | string | null }
interface MovementLogRow { id: number; item_id: number; item_name: string; quantity: number; issued_to?: string | null; note?: string | null; issued_at?: string | null }
interface MovementReceiptRow { id: number; item_id: number; item_name: string; quantity: number; supplier?: string | null; note?: string | null; received_at?: string | null; purchase_price_unit?: number | string | null }
type RpcError = { code?: string; message?: string } | null | undefined;

export interface SkladMovementsControllerOptions {
  db: SupabaseLike;
  document: Document;
  warn?: WarnFn;
  getItems?: () => MovementItem[];
  getLogs?: () => MovementLogRow[];
  getReceipts?: () => MovementReceiptRow[];
  openModal?: (id: string) => void;
  closeModal?: (id: string) => void;
  requestDeletePin?: RequestDeletePinFn;
  toast?: ToastFn;
  loadItems?: () => Promise<unknown>;
  loadLogs?: () => Promise<unknown>;
  loadReceipts?: () => Promise<unknown>;
  optionalPrice?: (value: string) => unknown;
  syncSupplierTags?: (targetId: string, value: string) => void;
  setButtonLoading?: SetButtonLoadingFn;
  refreshSelect?: (select: HTMLElement | null) => void;
  inventoryUnit?: (data: unknown, fallback: string) => string;
  populateSelects?: () => void;
  renderLowStock?: () => void;
  loadRecentIssues?: () => Promise<unknown>;
  nowDate?: () => string;
  findItem?: (id: number, action?: string) => MovementItem | null | undefined;
  createRequestId?: () => string;
}

// Помилки fetch у supabase-js приходять без SQLSTATE-коду; серверні — з кодом.
export function isTransportError(error: unknown): boolean {
  return Boolean(error) && !(error as { code?: string }).code;
}

const MOVEMENT_ERROR_MESSAGES: Record<string, string> = {
  item_not_found: 'Товар не знайдено — оновіть список.',
  log_not_found: 'Запис видачі не знайдено — оновіть журнал.',
  receipt_not_found: 'Запис приходу не знайдено — оновіть журнал.',
  invalid_quantity: 'Вкажіть коректну кількість.',
  invalid_purchase_price: 'Вкажіть коректну ціну закупівлі.',
};

export function movementErrorMessage(error: unknown): string {
  if (isTransportError(error)) return 'Немає зʼєднання з сервером. Перевірте інтернет і повторіть — дубля не буде.';
  const message = String((error as { message?: string } | null | undefined)?.message || '');
  const known = Object.keys(MOVEMENT_ERROR_MESSAGES).find(key => message.includes(key));
  return known ? MOVEMENT_ERROR_MESSAGES[known] : 'Помилка сервера. Спробуйте ще раз.';
}

export function createSkladMovementsController(options: SkladMovementsControllerOptions) {
  const { db, warn = console.warn, document, getItems = () => [], getLogs = () => [], getReceipts = () => [],
    openModal = () => {}, closeModal = () => {}, requestDeletePin = () => {}, toast = () => {},
    loadItems = async () => {}, loadLogs = async () => {}, loadReceipts = async () => {}, optionalPrice = value => value,
    syncSupplierTags = () => {}, setButtonLoading = () => () => {}, refreshSelect = () => {}, inventoryUnit = (_data, fallback) => fallback,
    populateSelects = () => {}, renderLowStock = () => {}, loadRecentIssues = async () => {},
    nowDate = () => new Date().toISOString().slice(0, 10), findItem = id => getItems().find(item => item.id === id),
    createRequestId = () => globalThis.crypto.randomUUID() } = options;
  // Ідемпотентність видачі/приходу: той самий id повторюється, доки операція з
  // тими самими даними не завершиться відповіддю сервера (після мережевого збою
  // повторне натискання не спише/не додасть товар удруге — див. міграцію 029).
  const pendingRequests = new Map<string, { key: string; id: string }>();
  function requestIdFor(kind: string, payload: unknown) {
    const key = JSON.stringify(payload);
    const current = pendingRequests.get(kind);
    if (current && current.key === key) return current.id;
    const id = createRequestId();
    pendingRequests.set(kind, { key, id });
    return id;
  }
  function settleRequest(kind: string, error: RpcError) {
    if (!error || !isTransportError(error)) pendingRequests.delete(kind);
  }

  const state: Record<MovementPendingKey, number | null> = {
    deletingLogId: null,
    editingLogId: null,
    deletingReceiptId: null,
    editingReceiptId: null,
  };

  async function runDelete(name: string, args: Record<string, unknown>): Promise<DeleteInventoryResult | { ok: false; reason: 'network' }> {
    try {
      const { data, error } = await db.rpc(name, args);
      if (error) {
        warn(name + ' failed', error);
        return { ok: false, reason: 'network' };
      }
      return deleteInventoryResultFromRpcResponse(data);
    } catch (error) {
      warn(name + ' failed', error);
      return { ok: false, reason: 'network' };
    }
  }

  function setPending(kind: MovementPendingKey, id: unknown) {
    if (!Object.hasOwn(state, kind)) return false;
    state[kind] = Number.isFinite(Number(id)) && Number(id) > 0 ? Number(id) : null;
    return true;
  }

  function pending(kind: MovementPendingKey) {
    return Object.hasOwn(state, kind) ? state[kind] : null;
  }

  async function issueItem(itemId: number, quantity: number, person: string, note?: string | null, occurredAt?: string | null) {
    const item = findItem(itemId, 'видача');
    if (!item) return false;
    const args = { p_item_id: itemId, p_qty: quantity, p_person: person, p_note: note || null, p_issued_at: occurredAt || null };
    const { data, error } = await db.rpc('issue_item', { ...args, p_client_request_id: requestIdFor('issue', args) });
    settleRequest('issue', error);
    if (error) {
      if ((error.message || '').includes('insufficient_stock')) toast(`Недостатньо! Залишок: ${item.quantity} ${item.unit}`, 'error');
      else toast(movementErrorMessage(error), 'error');
      return false;
    }
    const unit = inventoryUnit(data, item.unit);
    toast(`Видано: ${quantity} ${unit} → ${person}`, 'success');
    await loadItems();
    return true;
  }

  async function submitQuickIssue(button: HTMLElement | null, itemId: number | null) {
    const payload = buildIssuePayload({ itemId, quantity: (document.getElementById('qmQtyI') as HTMLInputElement).value, person: (document.getElementById('qmPersonI') as HTMLInputElement).value });
    if (!payload.ok) return toast(payload.error === 'person' ? 'Вкажіть кому!' : 'Вкажіть кількість!', 'error');
    const done = setButtonLoading(button, 'Видаю...');
    if (!done) return;
    try {
      const { quantity, person } = payload.value;
      if (await issueItem(payload.value.itemId, quantity, person, '', null)) closeModal('qModal');
    } catch (error) {
      warn('quick issue failed', error);
      toast('Не вдалося виконати видачу. Спробуйте ще раз.', 'error');
    } finally { done(); }
  }

  async function submitIssue(button?: HTMLElement | null) {
    const payload = buildIssuePayload({
      itemId: (document.getElementById('issueItemSel') as HTMLInputElement).value, quantity: (document.getElementById('issueQtyI') as HTMLInputElement).value,
      person: (document.getElementById('issuePersonI') as HTMLInputElement).value, note: (document.getElementById('issueNoteI') as HTMLInputElement).value,
      occurredAt: dateInputToTimestamp((document.getElementById('issueDateI') as HTMLInputElement).value),
    });
    if (!payload.ok) {
      const messages: Record<string, string> = { item: 'Оберіть товар!', quantity: 'Вкажіть кількість!', person: 'Вкажіть кому!' };
      return toast(messages[payload.error] || 'Перевірте дані видачі', 'error');
    }
    const done = setButtonLoading(button, 'Видаю...');
    if (!done) return;
    try {
      const { itemId, quantity, person, note, occurredAt } = payload.value;
      if (!await issueItem(itemId, quantity, person, note, occurredAt)) return;
      ['issueItemSel', 'issueQtyI', 'issuePersonI', 'issueNoteI'].forEach(id => { (document.getElementById(id) as HTMLInputElement).value = ''; });
      (document.getElementById('issueDateI') as HTMLInputElement).value = nowDate();
      refreshSelect(document.getElementById('issueItemSel'));
      document.getElementById('issueInfo')!.style.display = 'none';
      await loadRecentIssues();
    } catch (error) {
      warn('issue submit failed', error);
      toast('Не вдалося виконати видачу. Спробуйте ще раз.', 'error');
    } finally { done(); }
  }

  async function submitReceipt(button?: HTMLElement | null) {
    const payload = buildReceiptPayload({
      itemId: (document.getElementById('refillSel') as HTMLInputElement).value, quantity: (document.getElementById('refillQtyI') as HTMLInputElement).value,
      purchasePrice: optionalPrice((document.getElementById('refillPriceI') as HTMLInputElement).value), supplier: (document.getElementById('refillSupplierI') as HTMLInputElement).value,
      note: (document.getElementById('refillNoteI') as HTMLInputElement).value, occurredAt: dateInputToTimestamp((document.getElementById('refillDateI') as HTMLInputElement).value),
    });
    if (!payload.ok) {
      const messages: Record<string, string> = { item: 'Оберіть товар!', quantity: 'Вкажіть кількість!', price: 'Вкажіть коректну ціну закупівлі' };
      return toast(messages[payload.error] || 'Перевірте дані приходу', 'error');
    }
    const { itemId, quantity, purchasePrice, supplier, note, occurredAt } = payload.value;
    const item = findItem(itemId, 'прихід');
    if (!item) return;
    const done = setButtonLoading(button, 'Поповнюю...');
    if (!done) return;
    try {
      const args = { p_item_id: itemId, p_qty: quantity, p_supplier: supplier || null, p_note: note || null, p_received_at: occurredAt || null, p_price_unit: purchasePrice || null };
      const { data, error } = await db.rpc('receive_item', { ...args, p_client_request_id: requestIdFor('receipt', args) });
      settleRequest('receipt', error);
      if (error) return toast(movementErrorMessage(error), 'error');
      const unit = inventoryUnit(data, item.unit);
      toast(`Поповнено +${quantity} ${unit}`, 'success');
      ['refillQtyI', 'refillPriceI', 'refillSupplierI', 'refillNoteI', 'refillSel'].forEach(id => { (document.getElementById(id) as HTMLInputElement).value = ''; });
      syncSupplierTags('refillSupplierI', '');
      (document.getElementById('refillDateI') as HTMLInputElement).value = nowDate();
      document.getElementById('refillInfo')!.style.display = 'none';
      await loadItems(); populateSelects(); renderLowStock();
    } catch (error) {
      warn('receipt submit failed', error);
      toast('Не вдалося зберегти прихід. Спробуйте ще раз.', 'error');
    } finally { done(); }
  }

  function openDeleteLog(id: number) {
    const log = getLogs().find(row => row.id === id);
    if (!log) return;
    setPending('deletingLogId', id);
    const unit = getItems().find(item => item.id === log.item_id)?.unit || '';
    document.getElementById('delLogItemName')!.textContent = `${log.item_name} · ${log.quantity} ${unit} · ${log.issued_to || '—'}`;
    openModal('delLogModal');
  }
  async function confirmDeleteLog() {
    const id = pending('deletingLogId');
    if (!id) return;
    closeModal('delLogModal');
    requestDeletePin('PIN для видалення запису', async pin => {
      const result = await runDelete('delete_inventory_log', { p_log_id: id, attempt: pin });
      if (result.ok) { toast('Запис видалено, товар повернуто на склад', 'success'); setPending('deletingLogId', null); await loadItems(); await loadLogs(); }
      return result;
    });
  }
  function openDeleteReceipt(id: number) {
    const receipt = getReceipts().find(row => row.id === id);
    if (!receipt) return;
    setPending('deletingReceiptId', id);
    const unit = getItems().find(item => item.id === receipt.item_id)?.unit || '';
    document.getElementById('delReceiptItemName')!.textContent = `${receipt.item_name} · +${receipt.quantity} ${unit} · ${receipt.supplier || '—'}`;
    openModal('delReceiptModal');
  }
  async function confirmDeleteReceipt() {
    const id = pending('deletingReceiptId');
    if (!id) return;
    closeModal('delReceiptModal');
    requestDeletePin('PIN для видалення приходу', async pin => {
      const result = await runDelete('delete_inventory_receipt', { p_receipt_id: id, attempt: pin });
      if (result.ok) { toast('Прихід видалено, залишок скориговано', 'success'); setPending('deletingReceiptId', null); await loadItems(); await loadReceipts(); }
      return result;
    });
  }

  function openEditLog(id: number) {
    const log = getLogs().find(row => row.id === id);
    if (!log) return;
    setPending('editingLogId', id);
    const item = getItems().find(row => row.id === log.item_id);
    document.getElementById('editLogItemName')!.textContent = `${log.item_name}${item ? ' · поточний залишок: ' + item.quantity + ' ' + item.unit : ''}`;
    (document.getElementById('editLogQty') as HTMLInputElement).value = log.quantity as unknown as string;
    (document.getElementById('editLogDate') as HTMLInputElement).value = dateToInputValue(log.issued_at);
    (document.getElementById('editLogPerson') as HTMLInputElement).value = log.issued_to || '';
    (document.getElementById('editLogNote') as HTMLInputElement).value = log.note || '';
    openModal('editLogModal');
  }
  async function saveEditLog() {
    const id = pending('editingLogId');
    const log = getLogs().find(row => row.id === id);
    if (!log) return closeModal('editLogModal');
    const built = buildIssueEditPatch({ quantity: (document.getElementById('editLogQty') as HTMLInputElement).value, person: (document.getElementById('editLogPerson') as HTMLInputElement).value,
      note: (document.getElementById('editLogNote') as HTMLInputElement).value, occurredAt: dateInputToTimestamp((document.getElementById('editLogDate') as HTMLInputElement).value) });
    if (!built.ok) return toast('Введіть коректну кількість', 'error');
    const item = getItems().find(row => row.id === log.item_id);
    if (item && adjustedStockAfterMovementEdit(item.quantity, log.quantity, built.value.quantity, 'issue') === null) {
      return toast('Недостатньо товару на складі для такої кількості', 'error');
    }
    const { error } = await db.rpc('update_inventory_log', {
      p_log_id: id, p_qty: built.value.quantity, p_person: built.value.issued_to, p_note: built.value.note, p_issued_at: built.value.issued_at || null,
    });
    if (error) {
      if ((error.message || '').includes('insufficient_stock')) return toast('Недостатньо товару на складі для такої кількості', 'error');
      return toast(movementErrorMessage(error), 'error');
    }
    toast('Запис оновлено', 'success'); closeModal('editLogModal'); setPending('editingLogId', null); await loadItems(); await loadLogs();
  }
  function openEditReceipt(id: number) {
    const receipt = getReceipts().find(row => row.id === id);
    if (!receipt) return;
    setPending('editingReceiptId', id);
    const item = getItems().find(row => row.id === receipt.item_id);
    document.getElementById('editReceiptItemName')!.textContent = `${receipt.item_name}${item ? ' · поточний залишок: ' + item.quantity + ' ' + item.unit : ''}`;
    (document.getElementById('editReceiptQty') as HTMLInputElement).value = receipt.quantity as unknown as string;
    (document.getElementById('editReceiptDate') as HTMLInputElement).value = dateToInputValue(receipt.received_at);
    (document.getElementById('editReceiptPrice') as HTMLInputElement).value = (receipt.purchase_price_unit || item?.price_unit || '') as string;
    (document.getElementById('editReceiptSupplier') as HTMLInputElement).value = receipt.supplier || '';
    syncSupplierTags('editReceiptSupplier', receipt.supplier || '');
    (document.getElementById('editReceiptNote') as HTMLInputElement).value = receipt.note || '';
    openModal('editReceiptModal');
  }
  async function saveEditReceipt() {
    const id = pending('editingReceiptId');
    const receipt = getReceipts().find(row => row.id === id);
    if (!receipt) return closeModal('editReceiptModal');
    const built = buildReceiptEditPatch({ quantity: (document.getElementById('editReceiptQty') as HTMLInputElement).value, purchasePrice: optionalPrice((document.getElementById('editReceiptPrice') as HTMLInputElement).value),
      supplier: (document.getElementById('editReceiptSupplier') as HTMLInputElement).value, note: (document.getElementById('editReceiptNote') as HTMLInputElement).value,
      occurredAt: dateInputToTimestamp((document.getElementById('editReceiptDate') as HTMLInputElement).value) });
    if (!built.ok) return toast(built.error === 'price' ? 'Введіть коректну ціну закупівлі' : 'Введіть коректну кількість', 'error');
    const item = getItems().find(row => row.id === receipt.item_id);
    if (item && adjustedStockAfterMovementEdit(item.quantity, receipt.quantity, built.value.quantity, 'receipt') === null) {
      return toast("Це призведе до від'ємного залишку", 'error');
    }
    const { error } = await db.rpc('update_inventory_receipt', {
      p_receipt_id: id, p_qty: built.value.quantity, p_supplier: built.value.supplier, p_note: built.value.note,
      p_received_at: built.value.received_at || null, p_price_unit: built.value.purchase_price_unit || null,
    });
    if (error) {
      if ((error.message || '').includes('negative_stock')) return toast("Це призведе до від'ємного залишку", 'error');
      return toast(movementErrorMessage(error), 'error');
    }
    toast('Прихід оновлено', 'success'); closeModal('editReceiptModal'); setPending('editingReceiptId', null); await loadItems(); await loadReceipts();
  }

  return { confirmDeleteLog, confirmDeleteReceipt, issueItem, openDeleteLog, openDeleteReceipt, openEditLog, openEditReceipt, pending, runDelete,
    saveEditLog, saveEditReceipt, setPending, submitIssue, submitQuickIssue, submitReceipt };
}
