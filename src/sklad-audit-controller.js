import { escapeHtml } from './app-security.js';
import { calculateAuditSummary, createAuditData, parseAuditQuantity } from './sklad-audit.js';
import { numericIdFromInsertResponse } from './supabase-api.js';

export function createSkladAuditController(options) {
  const { db, document, getItems, itemMatchesSearch, updateResultSummary, categoryBadges,
    categoryIcons, defaultCategoryIcon, toast, openModal, closeModal, loadItems } = options;
  let auditData = {};
  const items = () => getItems();

  function updateStats() {
    const current = items();
    const { counted, surplus, shortage, progress } = calculateAuditSummary(current, auditData);
    const stats = document.getElementById('auditStats');
    if (stats) stats.textContent = `Перераховано: ${counted}/${current.length} · ▲ Надлишок: ${surplus} · ▼ Нестача: ${shortage}`;
    const fill = document.getElementById('auditProgressFill');
    const progressBar = document.getElementById('auditProgress');
    if (fill) fill.style.width = progress + '%';
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(progress));
  }

  function render() {
    const current = items();
    const search = document.getElementById('auditSearch')?.value || '';
    const visible = search ? current.filter(item => itemMatchesSearch(item, search)) : current;
    updateResultSummary('auditResultSummary', visible.length, current.length, search);
    updateStats();
    const list = document.getElementById('auditList');
    if (!list) return;
    if (!visible.length) {
      list.innerHTML = '<div class="empty"><span class="ms ic-16-3">search_off</span> Нічого не знайдено</div>';
      return;
    }
    list.innerHTML = visible.map(item => {
      const actual = auditData[item.id];
      const counted = actual !== null;
      const diff = counted ? actual - item.quantity : null;
      const state = !counted ? 'is-pending' : diff > 0 ? 'is-surplus' : diff < 0 ? 'is-shortage' : 'is-match';
      const diffHtml = !counted ? '' : diff > 0
        ? `<span class="audit-diff good">▲ +${diff}</span>`
        : diff < 0 ? `<span class="audit-diff bad">▼ ${diff}</span>`
          : '<span class="audit-diff good"><span class="ms ic-13-2">check</span> Збігається</span>';
      const category = item.category || '';
      const name = escapeHtml(item.name || '');
      const unit = escapeHtml(item.unit || '');
      return `<div class="audit-item ${state}">
        <div class="audit-item-icon">${categoryIcons[category] || defaultCategoryIcon}</div>
        <div class="audit-item-main"><div class="audit-item-title">${name}</div>
          <div class="audit-item-meta"><span class="badge ${categoryBadges[category] || 'bo'} ic-10">${escapeHtml(category || '—')}</span>
          <span>За даними: <b>${escapeHtml(String(item.quantity ?? 0))} ${unit}</b></span>${diffHtml}</div></div>
        <div class="audit-item-control"><div class="audit-input-row">
          <input type="number" id="audit_${item.id}" name="audit_${item.id}" aria-label="Фактичний залишок: ${name}"
            value="${counted ? actual : ''}" placeholder="?" min="0" step="any" class="audit-qty-input" data-audit-input data-item-id="${item.id}">
          <span style="font-size:11px;color:var(--sklad-label3);">${unit}</span></div>
          ${counted ? `<button type="button" class="audit-reset-btn" data-audit-clear data-item-id="${item.id}"><span class="ms ic-12-2">close</span> скинути</button>` : ''}
        </div></div>`;
    }).join('');
  }

  function init() {
    auditData = createAuditData(items());
    const date = document.getElementById('auditDate');
    if (date) date.textContent = 'Розпочато: ' + new Date().toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const search = document.getElementById('auditSearch');
    if (search) search.value = '';
    render();
  }

  function input(itemId, value) {
    auditData[itemId] = parseAuditQuantity(value);
    const item = items().find(candidate => String(candidate.id) === String(itemId));
    if (!item) return updateStats();
    const actual = auditData[itemId];
    const counted = actual !== null;
    const diff = counted ? actual - item.quantity : null;
    const row = document.getElementById('audit_' + itemId)?.closest?.('.audit-item');
    if (row) {
      row.classList.remove('is-pending', 'is-surplus', 'is-shortage', 'is-match');
      row.classList.add(!counted ? 'is-pending' : diff > 0 ? 'is-surplus' : diff < 0 ? 'is-shortage' : 'is-match');
      const meta = row.querySelector('.audit-item-meta');
      meta?.querySelector('.audit-diff')?.remove();
      if (meta && counted) {
        const indicator = document.createElement('span');
        indicator.className = 'audit-diff ' + (diff < 0 ? 'bad' : 'good');
        if (diff > 0) indicator.textContent = `▲ +${diff}`;
        else if (diff < 0) indicator.textContent = `▼ ${diff}`;
        else indicator.innerHTML = '<span class="ms ic-13-2">check</span> Збігається';
        meta.appendChild(indicator);
      }
    }
    updateStats();
  }
  function clear(itemId) { auditData[itemId] = null; render(); }
  function fillCurrent() { auditData = createAuditData(items(), true); render(); toast('Підставлено поточні залишки', 'success'); }
  function fillZeros() { auditData = createAuditData(items()); render(); }

  function openConfirm() {
    const summary = calculateAuditSummary(items(), auditData);
    const target = document.getElementById('auditSummary');
    if (target) target.innerHTML = `<div class="audit-summary-grid">
      <div class="audit-summary-tile"><div class="audit-summary-value counted">${summary.counted}</div><div class="audit-summary-label">Перераховано</div></div>
      <div class="audit-summary-tile"><div class="audit-summary-value uncounted">${summary.uncounted}</div><div class="audit-summary-label">Не перераховано</div></div>
      <div class="audit-summary-tile"><div class="audit-summary-value surplus">▲ ${summary.surplus}</div><div class="audit-summary-label">Надлишок</div></div>
      <div class="audit-summary-tile"><div class="audit-summary-value shortage">▼ ${summary.shortage}</div><div class="audit-summary-label">Нестача</div></div></div>
      ${summary.uncounted > 0 ? `<div class="audit-summary-warning"><span class="ms ic-14-2">warning</span> ${summary.uncounted} товарів не будуть оновлені (поле порожнє)</div>` : ''}`;
    openModal('auditModal');
  }

  async function confirm() {
    const current = items();
    const note = document.getElementById('auditNote')?.value.trim() || '';
    const { countedItems, differenceItems } = calculateAuditSummary(current, auditData);
    const { data: row, error } = await db.from('inventory_audits').insert([{ note: note || null, total_items: countedItems.length, items_with_diff: differenceItems.length }]).select().single();
    if (error) return toast('Помилка збереження: ' + error.message, 'error');
    const auditId = numericIdFromInsertResponse(row);
    if (auditId === null) return toast('Помилка збереження: сервер не повернув ID інвентаризації', 'error');
    const rows = countedItems.map(item => ({ audit_id: auditId, item_id: item.id, item_name: item.name, category: item.category || '', unit: item.unit || '', qty_before: item.quantity, qty_actual: auditData[item.id] }));
    const { error: rowsError } = await db.from('inventory_audit_items').insert(rows);
    if (rowsError) return toast('Помилка збереження рядків: ' + rowsError.message, 'error');
    let updateErrors = 0;
    for (const item of differenceItems) {
      const result = await db.from('inventory_items').update({ quantity: auditData[item.id] }).eq('id', item.id);
      if (result.error) updateErrors++;
    }
    closeModal('auditModal');
    await loadItems();
    toast(`Інвентаризацію завершено! Оновлено ${differenceItems.length} позицій${updateErrors ? ', помилок: ' + updateErrors : ''}`, 'success');
    init();
  }

  return { clear, confirm, fillCurrent, fillZeros, init, input, openConfirm, render };
}
