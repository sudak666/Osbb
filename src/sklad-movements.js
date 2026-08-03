import { valuesMatchSearch } from './sklad-domain.js';

export function adjustedStockAfterMovementEdit(currentStock, previousQuantity, nextQuantity, kind) {
    const current = Number(currentStock);
    const previous = Number(previousQuantity);
    const next = Number(nextQuantity);
    if (![current, previous, next].every(Number.isFinite) || current < 0 || previous < 0 || next < 0) return null;
    const delta = kind === 'issue' ? previous - next : next - previous;
    const adjusted = Math.round((current + delta) * 100) / 100;
    return adjusted >= 0 ? adjusted : null;
}

export function filterInventoryLogs(logs, items, query = '', category = '') {
    const itemsById = new Map(items.map((item) => [String(item.id), item]));
    return logs.filter((log) => {
        const item = itemsById.get(String(log.item_id));
        if (category && item?.category !== category) return false;
        return valuesMatchSearch([log.item_name, log.issued_to, log.note, item?.category, item?.unit], query);
    });
}

export function filterInventoryReceipts(receipts, query = '') {
    return receipts.filter((receipt) => valuesMatchSearch(
        [receipt.item_name, receipt.supplier, receipt.note],
        query,
    ));
}
