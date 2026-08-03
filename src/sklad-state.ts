import type { PublicTableRow } from './database.types.ts';

export type InventoryItemRow = PublicTableRow<'inventory_items'>;
export type InventoryLogRow = PublicTableRow<'inventory_logs'>;
export type InventoryReceiptRow = PublicTableRow<'inventory_receipts'>;

function tableRows<T extends Record<string, unknown>>(value: unknown): T[] {
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is T => typeof row === 'object' && row !== null && !Array.isArray(row));
}

export function inventoryItemsFromResponse(value: unknown): InventoryItemRow[] {
    return tableRows<InventoryItemRow>(value);
}

export function inventoryLogsFromResponse(value: unknown): InventoryLogRow[] {
    return tableRows<InventoryLogRow>(value);
}

export function inventoryReceiptsFromResponse(value: unknown): InventoryReceiptRow[] {
    return tableRows<InventoryReceiptRow>(value);
}
