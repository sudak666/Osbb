import { valuesMatchSearch } from './sklad-domain.ts';

export interface MovementInventoryItem {
    id: string | number;
    category?: string | null;
    unit?: string | null;
}

export interface InventoryLog {
    item_id: string | number;
    item_name?: string | null;
    issued_to?: string | null;
    note?: string | null;
}

export interface InventoryReceipt {
    item_name?: string | null;
    supplier?: string | null;
    note?: string | null;
}

export type MovementKind = 'issue' | 'receipt';

export function adjustedStockAfterMovementEdit(
    currentStock: unknown,
    previousQuantity: unknown,
    nextQuantity: unknown,
    kind: MovementKind,
): number | null {
    const current = Number(currentStock);
    const previous = Number(previousQuantity);
    const next = Number(nextQuantity);
    if (![current, previous, next].every(Number.isFinite) || current < 0 || previous < 0 || next < 0) return null;
    const delta = kind === 'issue' ? previous - next : next - previous;
    const adjusted = Math.round((current + delta) * 100) / 100;
    return adjusted >= 0 ? adjusted : null;
}

export function filterInventoryLogs<T extends InventoryLog>(
    logs: readonly T[],
    items: readonly MovementInventoryItem[],
    query = '',
    category = '',
): T[] {
    const itemsById = new Map(items.map((item) => [String(item.id), item]));
    return logs.filter((log) => {
        const item = itemsById.get(String(log.item_id));
        if (category && item?.category !== category) return false;
        return valuesMatchSearch([log.item_name, log.issued_to, log.note, item?.category, item?.unit], query);
    });
}

export function filterInventoryReceipts<T extends InventoryReceipt>(receipts: readonly T[], query = ''): T[] {
    return receipts.filter((receipt) => valuesMatchSearch(
        [receipt.item_name, receipt.supplier, receipt.note],
        query,
    ));
}
