import { normalizeSearchText } from './sklad-domain.ts';
import type { DeletePinOutcome, RequestDeletePinFn, SetButtonLoadingFn, SupabaseLike, ToastFn } from './controller-types.ts';

interface CrudItem { id: number | string; name: string; category?: string | null; unit?: string | null }

export interface SkladItemCrudControllerOptions {
  db: SupabaseLike;
  document: Document;
  categories: Record<string, unknown>;
  getItems(): readonly CrudItem[];
  findItem(id: unknown, actionLabel: string): CrudItem | null;
  refreshSelect(select: HTMLElement | null): void;
  openModal(id: string): void;
  closeModal(id: string): void;
  setButtonLoading: SetButtonLoadingFn;
  loadItems(): Promise<unknown>;
  populateSelects(): void;
  renderLowStock(): void;
  requestDeletePin: RequestDeletePinFn;
  runDeleteRpc(name: string, args: Record<string, unknown>): Promise<DeletePinOutcome>;
  toast: ToastFn;
}

export function createSkladItemCrudController(options: SkladItemCrudControllerOptions) {
  const { db, document, categories, getItems, findItem, refreshSelect, openModal, closeModal,
    setButtonLoading, loadItems, populateSelects, renderLowStock, requestDeletePin, runDeleteRpc, toast } = options;
  let editingId: number | null = null;
  let deletingId: number | null = null;

  function openEdit(id: number) {
    const item = findItem(id, 'редагування');
    if (!item) return;
    editingId = Number(item.id);
    (document.getElementById('editItemName') as HTMLInputElement).value = item.name || '';
    (document.getElementById('editItemCategory') as HTMLSelectElement).value = categories[item.category as string] ? item.category as string : 'Інше';
    (document.getElementById('editItemUnit') as HTMLInputElement).value = item.unit || 'шт';
    refreshSelect(document.getElementById('editItemCategory'));
    openModal('editItemModal');
  }
  async function saveEdit(button: HTMLButtonElement) {
    const item = findItem(editingId, 'редагування');
    if (!item) return closeModal('editItemModal');
    const name = (document.getElementById('editItemName') as HTMLInputElement).value.trim();
    const category = (document.getElementById('editItemCategory') as HTMLSelectElement).value;
    const unit = (document.getElementById('editItemUnit') as HTMLInputElement).value.trim() || 'шт';
    if (!name) return toast('Введіть назву товару!', 'error');
    if (name.length > 160) return toast('Назва задовга — максимум 160 символів', 'error');
    if (!categories[category]) return toast('Оберіть коректну категорію', 'error');
    if (unit.length > 24) return toast('Одиниця задовга — максимум 24 символи', 'error');
    if (/^\d+([.,]\d+)?$/.test(unit)) return toast('Одиниця має бути словом, а не числом!', 'error');
    const duplicate = getItems().find(candidate => Number(candidate.id) !== Number(item.id) && normalizeSearchText(candidate.name) === normalizeSearchText(name));
    if (duplicate) return toast('Товар з такою назвою вже існує', 'error');
    const done = setButtonLoading(button, 'Зберігаю...');
    if (!done) return;
    try {
      const { error } = await db.from('inventory_items').update({ name, category, unit }).eq('id', item.id);
      if (error) return toast('Не вдалося зберегти: ' + error.message, 'error');
      editingId = null;
      closeModal('editItemModal');
      await loadItems(); populateSelects(); renderLowStock();
      toast('Дані товару оновлено', 'success');
    } catch (error) {
      console.error('item update failed', error);
      toast('Не вдалося оновити товар', 'error');
    } finally { done(); }
  }
  function openDelete(id: number) {
    const item = findItem(id, 'видалення');
    if (!item) return;
    deletingId = id;
    document.getElementById('delItemName')!.textContent = `«${item.name}»`;
    openModal('delModal');
  }
  async function confirmDelete() {
    if (!deletingId) return;
    const id = deletingId;
    closeModal('delModal');
    requestDeletePin('PIN для видалення товару', async pin => {
      const result = await runDeleteRpc('delete_inventory_item', { p_item_id: id, attempt: pin });
      if (result.ok) {
        toast('Товар видалено', 'info'); deletingId = null; await loadItems();
      }
      return result;
    });
  }
  return { confirmDelete, openDelete, openEdit, saveEdit };
}
