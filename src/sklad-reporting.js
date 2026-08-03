import { itemPriceValue, itemStockValue } from './sklad-pricing.js';

export function calculateInventoryValueSummary(items, filteredItems = items) {
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

export function summarizeInventoryCategories(items) {
    const counts = new Map();
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

export function sortLowStockItems(items, threshold = 3) {
    return items.filter((item) => Number(item.quantity) <= threshold)
        .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0));
}

export function sortUnpricedItems(items) {
    return items.filter((item) => itemPriceValue(item) === 0)
        .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
}

export function buildInventoryExportRows(items, locale = 'uk-UA') {
    return items.map((item, index) => ({
        '№': index + 1, 'Назва товару': item.name, 'Категорія': item.category,
        'Залишок': item.quantity, 'Одиниця': item.unit,
        'Ціна за од., грн': itemPriceValue(item) || '', 'Оцінка залишку, грн': itemStockValue(item) || '',
        'Джерело ціни': item.price_source || '',
        'Дата ціни': item.price_checked_at ? new Date(item.price_checked_at).toLocaleString(locale) : '',
        'Внутрішнє використання': item.is_internal ? 'Так' : 'Ні',
    }));
}

export function buildBalanceExportRows(items) {
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

export function buildIssueExportRows(logs, locale = 'uk-UA') {
    return logs.map((log) => ({
        'Дата': log.issued_at ? new Date(log.issued_at).toLocaleString(locale) : '',
        'Товар': log.item_name, 'К-сть': log.quantity, 'Кому': log.issued_to || '', 'Примітка': log.note || '',
    }));
}
