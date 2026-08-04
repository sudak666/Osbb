import type { PublicTableRow } from './database.types.ts';

export type InventoryItemRow = PublicTableRow<'inventory_items'>;
export type InventoryLogRow = PublicTableRow<'inventory_logs'>;
export type InventoryReceiptRow = PublicTableRow<'inventory_receipts'>;

type UnknownRow = Record<string, unknown>;

function rows(value: unknown): UnknownRow[] {
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is UnknownRow => typeof row === 'object' && row !== null && !Array.isArray(row));
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function nullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
    return isFiniteNumber(value) ? value : null;
}

function isTimestamp(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value));
}

export function inventoryUnitFromRpcResponse(value: unknown, fallback: string): string {
    if (!Array.isArray(value) || value.length === 0) return fallback;
    const row = value[0];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return fallback;
    const unit = (row as Record<string, unknown>).unit;
    if (typeof unit !== 'string') return fallback;
    const normalized = unit.trim();
    return normalized && normalized.length <= 50 ? normalized : fallback;
}

export function inventoryItemsFromResponse(value: unknown): InventoryItemRow[] {
    return rows(value).flatMap((row) => {
        if (!isFiniteNumber(row.id) || typeof row.name !== 'string' || !isFiniteNumber(row.quantity) || typeof row.unit !== 'string') return [];
        return [{
            id: row.id,
            name: row.name,
            category: nullableString(row.category),
            quantity: row.quantity,
            unit: row.unit,
            min_quantity: nullableNumber(row.min_quantity),
            photo_url: nullableString(row.photo_url),
            created_at: nullableString(row.created_at),
            updated_at: nullableString(row.updated_at),
            is_internal: row.is_internal === true,
            price_unit: nullableNumber(row.price_unit),
            price_source: nullableString(row.price_source),
            price_url: nullableString(row.price_url),
            price_checked_at: nullableString(row.price_checked_at),
            price_confidence: row.price_confidence === 'manual' || row.price_confidence === 'internet'
                || row.price_confidence === 'low' || row.price_confidence === 'medium' || row.price_confidence === 'high'
                ? row.price_confidence
                : null,
        }];
    });
}

export function inventoryLogsFromResponse(value: unknown): InventoryLogRow[] {
    return rows(value).flatMap((row) => {
        if (!isFiniteNumber(row.id) || typeof row.item_name !== 'string' || !isFiniteNumber(row.quantity) || !isTimestamp(row.issued_at)) return [];
        return [{
            id: row.id,
            item_id: nullableNumber(row.item_id),
            item_name: row.item_name,
            quantity: row.quantity,
            issued_to: nullableString(row.issued_to),
            note: nullableString(row.note),
            issued_at: row.issued_at,
        }];
    });
}

export function inventoryReceiptsFromResponse(value: unknown): InventoryReceiptRow[] {
    return rows(value).flatMap((row) => {
        if (!isFiniteNumber(row.id) || typeof row.item_name !== 'string' || !isFiniteNumber(row.quantity) || !isTimestamp(row.received_at)) return [];
        return [{
            id: row.id,
            item_id: nullableNumber(row.item_id),
            item_name: row.item_name,
            quantity: row.quantity,
            purchase_price_unit: nullableNumber(row.purchase_price_unit),
            supplier: nullableString(row.supplier),
            note: nullableString(row.note),
            received_at: row.received_at,
        }];
    });
}
