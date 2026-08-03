import { itemPriceValue, itemStockValue } from './sklad-pricing.ts';

export interface ReportingItem {
    name?: string | null;
    category?: string | null;
    quantity?: number | null;
    unit?: string | null;
    is_internal?: boolean | null;
    price_unit?: number | null;
    price_source?: string | null;
    price_checked_at?: string | null;
}

export interface ReportingLog {
    issued_at?: string | null;
    item_name?: string | null;
    quantity?: number | null;
    issued_to?: string | null;
    note?: string | null;
}

export interface InventoryValueSummary {
    balanceItems: number;
    internalItems: number;
    pricedItems: number;
    balanceValue: number;
    filteredValue: number;
    filteredItems: number;
    filteredPriced: number;
    filteredInStock: number;
    filteredInternal: number;
}

export interface CategorySummary {
    category: string;
    count: number;
    percentage: number;
}

export function calculateInventoryValueSummary(
    items: readonly ReportingItem[],
    filteredItems: readonly ReportingItem[] = items,
): InventoryValueSummary {
    const internalItems = items.filter((item) => item.is_internal === true).length;
    return {
        balanceItems: items.length - internalItems,
        internalItems,
        pricedItems: items.filter((item) => itemPriceValue(item) > 0).length,
        balanceValue: items.filter((item) => item.is_internal !== true).reduce((sum, item) => sum + itemStockValue(item), 0),
        filteredValue: filteredItems.reduce((sum, item) => sum + itemStockValue(item), 0),
        filteredItems: filteredItems.length,
        filteredPriced: filteredItems.filter((item) => itemPriceValue(item) > 0).length,
        filteredInStock: filteredItems.filter((item) => Number(item.quantity || 0) > 0).length,
        filteredInternal: filteredItems.filter((item) => item.is_internal === true).length,
    };
}

export function summarizeInventoryCategories(items: readonly ReportingItem[]): CategorySummary[] {
    const counts = new Map<string, number>();
    for (const item of items) {
        const category = String(item.category || '');
        counts.set(category, (counts.get(category) || 0) + 1);
    }
    return [...counts].map(([category, count]) => ({
        category,
        count,
        percentage: items.length ? Math.round(count / items.length * 100) : 0,
    }));
}

export function sortLowStockItems<T extends ReportingItem>(items: readonly T[], threshold = 3): T[] {
    return items.filter((item) => Number(item.quantity) <= threshold)
        .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0));
}

export function sortUnpricedItems<T extends ReportingItem>(items: readonly T[]): T[] {
    return items.filter((item) => itemPriceValue(item) === 0)
        .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
}

export function buildInventoryExportRows(items: readonly ReportingItem[], locale = 'uk-UA'): Record<string, unknown>[] {
    return items.map((item, index) => ({
        '№': index + 1,
        'Назва товару': item.name,
        'Категорія': item.category,
        'Залишок': item.quantity,
        'Одиниця': item.unit,
        'Ціна за од., грн': itemPriceValue(item) || '',
        'Оцінка залишку, грн': itemStockValue(item) || '',
        'Джерело ціни': item.price_source || '',
        'Дата ціни': item.price_checked_at ? new Date(item.price_checked_at).toLocaleString(locale) : '',
        'Внутрішнє використання': item.is_internal ? 'Так' : 'Ні',
    }));
}

export function buildBalanceExportRows(items: readonly ReportingItem[]): Record<string, string | number>[] {
    const summary = calculateInventoryValueSummary(items);
    const internalValue = items.filter((item) => item.is_internal === true).reduce((sum, item) => sum + itemStockValue(item), 0);
    return [
        { 'Показник': 'Позицій на балансі (без внутрішнього використання)', 'Значення': summary.balanceItems },
        { 'Показник': 'Позицій внутрішнього використання (хознужди)', 'Значення': summary.internalItems },
        { 'Показник': 'Всього позицій', 'Значення': items.length },
        { 'Показник': 'Орієнтовна вартість залишку на балансі, грн', 'Значення': summary.balanceValue },
        { 'Показник': 'Орієнтовна вартість внутрішнього використання, грн', 'Значення': internalValue },
        { 'Показник': 'Товарів з ціною', 'Значення': summary.pricedItems },
    ];
}

export function buildIssueExportRows(logs: readonly ReportingLog[], locale = 'uk-UA'): Record<string, unknown>[] {
    return logs.map((log) => ({
        'Дата': log.issued_at ? new Date(log.issued_at).toLocaleString(locale) : '',
        'Товар': log.item_name,
        'К-сть': log.quantity,
        'Кому': log.issued_to || '',
        'Примітка': log.note || '',
    }));
}
