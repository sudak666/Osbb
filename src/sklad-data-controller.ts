import { escapeHtml } from './app-security.js';
import {
  inventoryItemsFromResponse,
  inventoryLogsFromResponse,
  inventoryReceiptsFromResponse,
} from './sklad-state.js';

type AsyncLoader = () => Promise<unknown>;
type QueryResult = { data?: unknown; error?: { message: string } | null };
type Query = PromiseLike<QueryResult> & {
  select(value: string): Query;
  order(field: string, options?: { ascending: boolean }): Query;
  limit(value: number): Promise<QueryResult>;
};
type RealtimeChannel = {
  on(event: string, filter: Record<string, string>, callback: () => void): RealtimeChannel;
  subscribe(): unknown;
};
type Database = {
  from(table: string): Query;
  channel(name: string): RealtimeChannel;
};

export type SkladDataControllerOptions = {
  db: Database;
  document: Document;
  window: Window;
  toast(message: string, type?: string): void;
  iconHtml(name: string, size?: string): string;
  skeletonRows(columns?: number, rows?: number): string;
  skeletonStack(rows?: number): string;
  onItems(items: ReturnType<typeof inventoryItemsFromResponse>): void;
  onLogs(logs: ReturnType<typeof inventoryLogsFromResponse>): void;
  onReceipts(receipts: ReturnType<typeof inventoryReceiptsFromResponse>): void;
  loadSupplierTags: AsyncLoader;
};

export function createSkladDataController(options: SkladDataControllerOptions) {
  const { db, document, window, toast, iconHtml, skeletonRows, skeletonStack, onItems, onLogs, onReceipts, loadSupplierTags } = options;
  let refreshBusy = false;
  const setRefreshStatus = (state: 'ready' | 'syncing', message: string) => {
    const status = document.getElementById('lastUpdate');
    if (status) {
      status.classList.add('is-visible');
      status.classList.toggle('is-syncing', state === 'syncing');
      status.innerHTML = iconHtml(state === 'syncing' ? 'sync' : 'check_circle', '13px') + ' ' + escapeHtml(message);
    }
    const button = document.getElementById('refreshBtn') as HTMLButtonElement | null;
    if (button) { button.disabled = state === 'syncing'; button.setAttribute('aria-busy', state === 'syncing' ? 'true' : 'false'); }
  };
  const markDataUpdated = () => setRefreshStatus('ready', 'Оновлено ' + new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }));
  const loadItems = async () => {
    const { data, error } = await db.from('inventory_items').select('*').order('category').order('name').limit(500);
    if (error) { toast('Товари не завантажились: ' + error.message, 'error'); throw error; }
    onItems(inventoryItemsFromResponse(data)); markDataUpdated();
  };
  const loadLogs = async () => {
    const { data, error } = await db.from('inventory_logs').select('*').order('issued_at', { ascending: false }).limit(100);
    if (error) { toast('Журнал не завантажився: ' + error.message, 'error'); throw error; }
    onLogs(inventoryLogsFromResponse(data));
  };
  const loadReceipts = async () => {
    const table = document.getElementById('recTable'); const mobile = document.getElementById('recMobileList');
    if (table) table.innerHTML = skeletonRows(7, 3); if (mobile) mobile.innerHTML = skeletonStack(3);
    const { data, error } = await db.from('inventory_receipts').select('*').order('received_at', { ascending: false }).limit(200);
    if (error) {
      const message = iconHtml('warning') + ' ' + escapeHtml(error.message);
      if (table) table.innerHTML = `<tr><td colspan="7"><div class="empty">${message}</div></td></tr>`;
      if (mobile) mobile.innerHTML = `<div class="empty" style="padding:32px 16px;text-align:center;color:#c2410c;font-size:13px;">${message}<br><br><small style="color:var(--sklad-gray)">Виконайте SQL-скрипт 002_receipts_table.sql в Supabase SQL Editor</small></div>`;
      toast('Прихід: ' + error.message, 'error'); return;
    }
    onReceipts(inventoryReceiptsFromResponse(data));
  };
  const refreshAll = async () => {
    if (refreshBusy) return false; refreshBusy = true; setRefreshStatus('syncing', 'Оновлюю...');
    try { await loadItems(); await loadLogs(); await loadReceipts(); markDataUpdated(); toast('Дані оновлено', 'success'); return true; }
    catch (error) { console.warn('refreshAll failed:', error); setRefreshStatus('ready', 'Помилка оновлення'); return false; }
    finally { refreshBusy = false; const button = document.getElementById('refreshBtn') as HTMLButtonElement | null; if (button) { button.disabled = false; button.setAttribute('aria-busy', 'false'); } }
  };
  const realtimeSafeReload = (loader: AsyncLoader) => { const active = document.activeElement; if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return; loader().catch(error => console.warn('realtime reload failed:', error)); };
  const initRealtime = () => { try { db.channel('sklad-live').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => realtimeSafeReload(loadItems)).on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_logs' }, () => realtimeSafeReload(loadLogs)).on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_receipts' }, () => realtimeSafeReload(loadReceipts)).on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_supplier_tags' }, () => realtimeSafeReload(loadSupplierTags)).subscribe(); } catch (error) { console.warn('sklad realtime init failed:', error); } };
  const initPullToRefresh = () => {
    const indicator = document.getElementById('pullRefresh'); const label = document.getElementById('pullRefreshLabel');
    if (!indicator || !label || !window.matchMedia('(max-width: 768px)').matches) return;
    const threshold = 72; let startX = 0; let startY = 0; let distance = 0; let tracking = false;
    const reset = () => { tracking = false; distance = 0; indicator.classList.remove('is-visible', 'is-ready', 'is-refreshing'); indicator.style.removeProperty('--pull-distance'); indicator.style.removeProperty('--pull-rotation'); label.textContent = ''; };
    document.addEventListener('touchstart', event => { if (event.touches.length !== 1 || window.scrollY > 0 || refreshBusy || document.querySelector('.modal-bg.open,.lightbox.open')) return; const touch = event.touches[0]; startX = touch.clientX; startY = touch.clientY; distance = 0; tracking = true; }, { passive: true });
    document.addEventListener('touchmove', event => { if (!tracking || event.touches.length !== 1) return; const touch = event.touches[0]; const deltaX = touch.clientX - startX; const deltaY = touch.clientY - startY; if (deltaY <= 0 || (Math.abs(deltaX) > Math.abs(deltaY) && distance < 8)) return reset(); if (event.cancelable) event.preventDefault(); distance = Math.min(112, deltaY * .55); const ready = distance >= threshold; indicator.style.setProperty('--pull-distance', `${distance}px`); indicator.style.setProperty('--pull-rotation', `${Math.min(distance, threshold) * 3}deg`); indicator.classList.add('is-visible'); indicator.classList.toggle('is-ready', ready); label.textContent = ready ? 'Відпустіть для оновлення' : 'Потягніть для оновлення'; }, { passive: false });
    document.addEventListener('touchend', async () => { if (!tracking) return; const shouldRefresh = distance >= threshold; tracking = false; if (!shouldRefresh) return reset(); indicator.classList.remove('is-ready'); indicator.classList.add('is-refreshing'); indicator.style.setProperty('--pull-distance', `${threshold}px`); label.textContent = 'Оновлення даних…'; label.textContent = await refreshAll() ? 'Дані оновлено' : 'Не вдалося оновити'; window.setTimeout(reset, 600); }, { passive: true });
    document.addEventListener('touchcancel', reset, { passive: true });
  };
  return { initPullToRefresh, initRealtime, loadItems, loadLogs, loadReceipts, markDataUpdated, refreshAll, setRefreshStatus };
}
