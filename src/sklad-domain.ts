import type { PublicTableRow } from './database.types.ts';
import { itemPriceValue } from './sklad-pricing.ts';

export type InventoryItem = Pick<PublicTableRow<'inventory_items'>,
    | 'id'
    | 'name'
    | 'category'
    | 'quantity'
    | 'unit'
    | 'min_quantity'
    | 'is_internal'
    | 'price_unit'
    | 'price_source'
>;

export interface InventoryFilterOptions {
    query?: string;
    category?: string;
    hideInternal?: boolean;
    onlyInternal?: boolean;
}

export type StockFilter = '' | 'all' | 'zero' | 'low' | 'ok';
export type ValueStockFilter = 'all' | 'positive' | 'low' | 'zero' | 'normal';
export type InternalFilter = 'all' | 'balance' | 'internal';
export type PriceFilter = 'all' | 'priced' | 'unpriced';

export interface SkladItemFilterOptions extends InventoryFilterOptions {
    stock?: StockFilter;
    inStockOnly?: boolean;
}

export interface InventoryValueFilterOptions {
    category?: string;
    stock?: ValueStockFilter;
    internal?: InternalFilter;
    price?: PriceFilter;
}

export interface InventoryHeaderStats {
    availableItems: number;
    totalUnits: number;
    estimatedValue: number;
}

export interface InventoryStats {
    totalItems: number;
    externalItems: number;
    internalItems: number;
    lowStockItems: number;
    totalQuantity: number;
    estimatedValue: number;
    categories: string[];
}

export function normalizeSearchText(value: unknown): string {
    return String(value ?? '')
        .toLocaleLowerCase('uk-UA')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function valuesMatchSearch(values: unknown[], query: string): boolean {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;
    const searchableText = normalizeSearchText(values.filter(Boolean).join(' '));
    return normalizedQuery.split(' ').every((part) => searchableText.includes(part));
}

export function isInternalItem(item: Pick<InventoryItem, 'is_internal'>): boolean {
    return item.is_internal === true;
}

export function isLowStockItem(item: Pick<InventoryItem, 'quantity' | 'min_quantity' | 'is_internal'>): boolean {
    if (isInternalItem(item)) return false;
    if (item.min_quantity === null || item.min_quantity === undefined) return false;
    return item.quantity <= item.min_quantity;
}

export function estimatedItemValue(item: Pick<InventoryItem, 'quantity' | 'price_unit'>): number {
    const quantity = Number(item.quantity);
    const price = Number(item.price_unit ?? 0);
    if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) return 0;
    return Math.round(quantity * price * 100) / 100;
}

export function sortItemsByCategoryName<T extends Pick<InventoryItem, 'category' | 'name'>>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => {
        const categoryCompare = normalizeSearchText(a.category || '').localeCompare(normalizeSearchText(b.category || ''), 'uk-UA');
        if (categoryCompare !== 0) return categoryCompare;
        return normalizeSearchText(a.name).localeCompare(normalizeSearchText(b.name), 'uk-UA');
    });
}

export function filterInventoryItems<T extends InventoryItem>(
    items: readonly T[],
    options: InventoryFilterOptions = {}
): T[] {
    const query = options.query || '';
    const category = options.category || '';
    const filtered = items.filter((item) => {
        if (options.onlyInternal && !isInternalItem(item)) return false;
        if (options.hideInternal && isInternalItem(item)) return false;
        if (category && item.category !== category) return false;
        return valuesMatchSearch([item.name, item.category, item.unit, item.price_source], query);
    });
    return sortItemsByCategoryName(filtered);
}

export function filterSkladItems<T extends InventoryItem>(
    items: readonly T[],
    options: SkladItemFilterOptions = {},
): T[] {
    return items.filter((item) => {
        const quantity = Number(item.quantity);
        if (options.category && item.category !== options.category) return false;
        if (options.stock === 'zero' && quantity !== 0) return false;
        if (options.stock === 'low' && !(quantity > 0 && quantity <= 3)) return false;
        if (options.stock === 'ok' && quantity <= 3) return false;
        if (options.inStockOnly && quantity <= 0) return false;
        if (options.hideInternal && isInternalItem(item)) return false;
        if (!options.hideInternal && options.onlyInternal && !isInternalItem(item)) return false;
        return valuesMatchSearch([item.name, item.category, item.unit, item.price_source], options.query || '');
    });
}

export function filterInventoryByValue<T extends InventoryItem>(
    items: readonly T[],
    options: InventoryValueFilterOptions = {},
): T[] {
    return items.filter((item) => {
        const quantity = Number(item.quantity || 0);
        if (options.category && item.category !== options.category) return false;
        if (options.internal === 'balance' && isInternalItem(item)) return false;
        if (options.internal === 'internal' && !isInternalItem(item)) return false;
        if (options.stock === 'positive' && quantity <= 0) return false;
        if (options.stock === 'low' && quantity > 3) return false;
        if (options.stock === 'zero' && quantity !== 0) return false;
        if (options.stock === 'normal' && quantity <= 3) return false;
        if (options.price === 'priced' && itemPriceValue(item) === 0) return false;
        if (options.price === 'unpriced' && itemPriceValue(item) > 0) return false;
        return true;
    });
}

export function calculateInventoryHeaderStats(items: readonly InventoryItem[]): InventoryHeaderStats {
    return items.reduce<InventoryHeaderStats>((stats, item) => {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        if (quantity > 0) stats.availableItems += 1;
        stats.totalUnits += quantity;
        stats.estimatedValue += quantity * itemPriceValue(item);
        return stats;
    }, { availableItems: 0, totalUnits: 0, estimatedValue: 0 });
}

export function calculateInventoryStats(items: readonly InventoryItem[]): InventoryStats {
    const categories = new Set<string>();
    let totalQuantity = 0;
    let estimatedValue = 0;
    let internalItems = 0;
    let lowStockItems = 0;

    for (const item of items) {
        if (item.category) categories.add(item.category);
        totalQuantity += Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0;
        estimatedValue += estimatedItemValue(item);
        if (isInternalItem(item)) internalItems += 1;
        if (isLowStockItem(item)) lowStockItems += 1;
    }

    return {
        totalItems: items.length,
        externalItems: items.length - internalItems,
        internalItems,
        lowStockItems,
        totalQuantity: Math.round(totalQuantity * 100) / 100,
        estimatedValue: Math.round(estimatedValue * 100) / 100,
        categories: [...categories].sort((a, b) => normalizeSearchText(a).localeCompare(normalizeSearchText(b), 'uk-UA')),
    };
}
