import { MAX_SUPPLIER_TAGS, mergeSupplierTags } from './sklad-suppliers.ts';

export type SkladTheme = 'theme-light' | 'theme-dark';
export interface SkladClientStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }

export const SUPPLIER_TAGS_STORAGE_KEY = 'sklad_supplier_tags_v1';
export const PURCHASE_PRICE_RPC_UNAVAILABLE_KEY = 'sklad_purchase_price_rpc_unavailable_v1';
export const SKLAD_THEME_STORAGE_KEY = 'selected_theme';

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
