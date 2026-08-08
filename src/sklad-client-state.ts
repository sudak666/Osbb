import { MAX_SUPPLIER_TAGS, mergeSupplierTags } from './sklad-suppliers.ts';

export type SkladTheme = 'theme-light' | 'theme-dark';
export interface SkladClientStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }

export const SUPPLIER_TAGS_STORAGE_KEY = 'sklad_supplier_tags_v1';
export const PURCHASE_PRICE_RPC_UNAVAILABLE_KEY = 'sklad_purchase_price_rpc_unavailable_v1';
export const SKLAD_THEME_STORAGE_KEY = 'sklad_theme';

export function loadPurchasePriceRpcAvailable(storage: SkladClientStorage): boolean {
    try { return storage.getItem(PURCHASE_PRICE_RPC_UNAVAILABLE_KEY) !== '1'; } catch { return true; }
}
export function markPurchasePriceRpcUnavailable(storage: SkladClientStorage): boolean {
    try { storage.setItem(PURCHASE_PRICE_RPC_UNAVAILABLE_KEY, '1'); return true; } catch { return false; }
}
export function loadStoredSupplierTags(storage: SkladClientStorage): string[] {
    try {
        const raw = storage.getItem(SUPPLIER_TAGS_STORAGE_KEY);
        return mergeSupplierTags([raw ? JSON.parse(raw) : []], MAX_SUPPLIER_TAGS);
    } catch { return []; }
}
export function saveStoredSupplierTags(storage: SkladClientStorage, values: readonly unknown[]): boolean {
    try {
        storage.setItem(SUPPLIER_TAGS_STORAGE_KEY, JSON.stringify(mergeSupplierTags([values], MAX_SUPPLIER_TAGS)));
        return true;
    } catch { return false; }
}
export function nextSkladTheme(current: unknown): SkladTheme {
    return current === 'theme-dark' ? 'theme-light' : 'theme-dark';
}
export function saveSkladTheme(storage: SkladClientStorage, theme: SkladTheme): boolean {
    if (theme !== 'theme-light' && theme !== 'theme-dark') return false;
    try { storage.setItem(SKLAD_THEME_STORAGE_KEY, theme); return true; } catch { return false; }
}
