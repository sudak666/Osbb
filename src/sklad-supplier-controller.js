import { loadStoredSupplierTags, saveStoredSupplierTags } from './sklad-client-state.js';
import { hasSupplierTag, MAX_SUPPLIER_TAGS, mergeSupplierTags, normalizeSupplierTag, supplierTagKey, supplierTagsFromResponse } from './sklad-suppliers.js';

export function createSkladSupplierController({ db, document, window, storage, toast, openModal, closeModal }) {
  let cloudTags = [];
  let cloudAvailable = false;
  let pendingDelete = null;

  const loadTags = () => mergeSupplierTags([cloudTags, loadStoredSupplierTags(storage)]);
  function saveTags(tags) {
    try {
      if (!saveStoredSupplierTags(storage, tags)) throw new Error('supplier tags storage unavailable');
      return true;
    } catch (error) {
      console.warn('supplier tags save failed', error);
      toast('Не вдалося зберегти тег у цьому браузері', 'error');
      return false;
    }
  }
  function sync(targetId, value) {
    const normalized = supplierTagKey(value);
    document.querySelectorAll(`[data-supplier-target="${targetId}"]`).forEach(tag => {
      const selected = supplierTagKey(tag.dataset.supplierPreset) === normalized;
      tag.classList.toggle('active', selected);
      tag.setAttribute('aria-pressed', String(selected));
    });
  }
  function select(button) {
    const targetId = button.dataset.supplierTarget || '';
    const input = document.getElementById(targetId);
    const supplier = String(button.dataset.supplierPreset || '').trim();
    if (!input || !supplier) return;
    input.value = supplier;
    sync(targetId, supplier);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  function render() {
    const tags = loadTags();
    document.querySelectorAll('[data-supplier-tags]').forEach(row => {
      row.querySelectorAll('[data-custom-supplier-tag]').forEach(node => node.remove());
      const targetId = row.querySelector('[data-supplier-target]')?.dataset.supplierTarget;
      if (!targetId) return;
      tags.forEach(tag => {
        const group = document.createElement('span');
        group.className = 'supplier-custom-tag';
        group.dataset.customSupplierTag = tag;
        const choose = document.createElement('button');
        choose.type = 'button'; choose.className = 'supplier-tag';
        choose.dataset.supplierPreset = tag; choose.dataset.supplierTarget = targetId; choose.textContent = tag;
        choose.addEventListener('click', () => select(choose));
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'supplier-tag-remove';
        remove.setAttribute('aria-label', `Видалити тег ${tag}`);
        remove.innerHTML = '<span class="ms" aria-hidden="true">close</span>';
        remove.addEventListener('click', () => requestRemove(tag));
        group.append(choose, remove); row.append(group);
      });
      sync(targetId, document.getElementById(targetId)?.value || '');
    });
  }
  async function loadCloud() {
    const { data, error } = await db.from('inventory_supplier_tags').select('name').order('name').limit(50);
    if (error) { cloudAvailable = false; console.info('Cloud supplier tags are unavailable; local tags remain active.'); render(); return; }
    cloudAvailable = true;
    const local = loadTags();
    const remote = supplierTagsFromResponse(data, 50);
    const missing = local.filter(tag => !hasSupplierTag(remote, tag));
    if (missing.length) {
      const { error: syncError } = await db.from('inventory_supplier_tags').insert(missing.map(name => ({ name })));
      if (syncError) console.warn('supplier tags cloud merge failed', syncError); else remote.push(...missing);
    }
    cloudTags = remote;
    saveTags(loadTags());
    render();
  }
  async function add() {
    const input = document.getElementById('newSupplierTag');
    const tag = normalizeSupplierTag(input?.value);
    if (!tag) return toast('Введіть назву постачальника', 'error');
    const tags = loadTags();
    const known = [...document.querySelectorAll('[data-supplier-preset]')].map(button => button.dataset.supplierPreset);
    if (hasSupplierTag(known, tag)) return toast('Такий тег уже є', 'info');
    if (tags.length >= MAX_SUPPLIER_TAGS) return toast(`Можна зберегти до ${MAX_SUPPLIER_TAGS} власних тегів`, 'info');
    if (!saveTags([...tags, tag])) return;
    if (cloudAvailable) {
      const { error } = await db.from('inventory_supplier_tags').insert([{ name: tag }]);
      if (error) { console.warn('supplier tag cloud save failed', error); toast('Тег збережено на цьому пристрої, синхронізація недоступна', 'info'); }
      else cloudTags = [...new Set([...cloudTags, tag])];
    }
    input.value = ''; render();
    const created = [...document.querySelectorAll('[data-supplier-target="refillSupplierI"][data-supplier-preset]')].find(button => button.dataset.supplierPreset === tag);
    if (created) select(created);
    toast('Тег постачальника додано', 'success');
  }
  function requestRemove(tag) {
    pendingDelete = tag;
    const name = document.getElementById('supplierTagDeleteName');
    if (name) name.textContent = `«${tag}»`;
    openModal('supplierTagDeleteModal');
  }
  async function confirmRemove() {
    const tag = pendingDelete;
    if (!tag) return closeModal('supplierTagDeleteModal');
    if (cloudAvailable) {
      const { error } = await db.from('inventory_supplier_tags').delete().eq('name', tag);
      if (error) return toast('Не вдалося видалити тег: ' + error.message, 'error');
    }
    cloudTags = cloudTags.filter(saved => saved !== tag);
    if (!saveTags(loadTags().filter(saved => saved !== tag))) return;
    pendingDelete = null; closeModal('supplierTagDeleteModal'); render(); toast('Тег видалено', 'success');
  }
  return { add, confirmRemove, loadCloud, render, requestRemove, select, sync };
}
