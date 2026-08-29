import { MAX_SUPPLIER_TAGS, mergeSupplierTags } from './sklad-suppliers.js';

export const SUPPLIER_TAGS_STORAGE_KEY = 'sklad_supplier_tags_v1';
export const PURCHASE_PRICE_RPC_UNAVAILABLE_KEY = 'sklad_purchase_price_rpc_unavailable_v1';
export const SKLAD_THEME_STORAGE_KEY = 'selected_theme';

export function loadPurchasePriceRpcAvailable(storage) {
    try { return storage.getItem(PURCHASE_PRICE_RPC_UNAVAILABLE_KEY) !== '1'; } catch { return true; }
}
export function markPurchasePriceRpcUnavailable(storage) {
    try { storage.setItem(PURCHASE_PRICE_RPC_UNAVAILABLE_KEY, '1'); return true; } catch { return false; }
}
export function loadStoredSupplierTags(storage) {
    try {
        const raw = storage.getItem(SUPPLIER_TAGS_STORAGE_KEY);
        return mergeSupplierTags([raw ? JSON.parse(raw) : []], MAX_SUPPLIER_TAGS);
    } catch { return []; }
}
export function saveStoredSupplierTags(storage, values) {
    try {
        storage.setItem(SUPPLIER_TAGS_STORAGE_KEY, JSON.stringify(mergeSupplierTags([values], MAX_SUPPLIER_TAGS)));
        return true;
    } catch { return false; }
}
export function nextSkladTheme(current) {
    return current === 'theme-dark' ? 'theme-light' : 'theme-dark';
}
export function saveSkladTheme(storage, theme) {
    if (theme !== 'theme-light' && theme !== 'theme-dark') return false;
    try { storage.setItem(SKLAD_THEME_STORAGE_KEY, theme); return true; } catch { return false; }
}
