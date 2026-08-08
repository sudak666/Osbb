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

export type MovementPayloadError = 'item' | 'quantity' | 'person' | 'price';

export type MovementPayloadResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: MovementPayloadError };

export interface IssuePayload {
    itemId: number;
    quantity: number;
    person: string;
    note: string | null;
    occurredAt: string | null;
}

export interface ReceiptPayload {
    itemId: number;
    quantity: number;
    purchasePrice: number | null;
    supplier: string | null;
    note: string | null;
    occurredAt: string | null;
}

export interface IssueEditPatch {
    quantity: number;
    issued_to: string | null;
    note: string | null;
    issued_at?: string;
}

export interface ReceiptEditPatch {
    quantity: number;
    purchase_price_unit: number | null;
    supplier: string | null;
    note: string | null;
    received_at?: string;
}

function trimmedOrNull(value: unknown, maxLength = 1000): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized && normalized.length <= maxLength ? normalized : null;
}

function validAmount(value: unknown, allowZero = false): number | null {
    const amount = Number(value);
    return Number.isFinite(amount) && amount <= 1_000_000_000 && (allowZero ? amount >= 0 : amount > 0) ? amount : null;
}

function validTimestamp(value: unknown): string | null {
    return typeof value === 'string' && value.length <= 100 && Number.isFinite(Date.parse(value)) ? value : null;
}

export function buildIssuePayload(input: {
    itemId: unknown;
    quantity: unknown;
    person: unknown;
    note?: unknown;
    occurredAt?: string | null;
}): MovementPayloadResult<IssuePayload> {
    const itemId = Number(input.itemId);
    const quantity = validAmount(input.quantity);
    const person = trimmedOrNull(input.person, 200);
    if (!Number.isInteger(itemId) || itemId <= 0) return { ok: false, error: 'item' };
    if (quantity === null) return { ok: false, error: 'quantity' };
    if (!person) return { ok: false, error: 'person' };
    return {
        ok: true,
        value: { itemId, quantity, person, note: trimmedOrNull(input.note), occurredAt: validTimestamp(input.occurredAt) },
    };
}

export function buildReceiptPayload(input: {
    itemId: unknown;
    quantity: unknown;
    purchasePrice: unknown;
    supplier?: unknown;
    note?: unknown;
    occurredAt?: string | null;
}): MovementPayloadResult<ReceiptPayload> {
    const itemId = Number(input.itemId);
    const quantity = validAmount(input.quantity);
    const purchasePrice = input.purchasePrice === null || input.purchasePrice === ''
        ? null
        : Number(input.purchasePrice);
    if (!Number.isInteger(itemId) || itemId <= 0) return { ok: false, error: 'item' };
    if (quantity === null) return { ok: false, error: 'quantity' };
    if (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0 || purchasePrice > 1_000_000_000)) {
        return { ok: false, error: 'price' };
    }
    return {
        ok: true,
        value: {
            itemId,
            quantity,
            purchasePrice,
            supplier: trimmedOrNull(input.supplier, 200),
            note: trimmedOrNull(input.note),
            occurredAt: validTimestamp(input.occurredAt),
        },
    };
}

export function buildIssueEditPatch(input: {
    quantity: unknown;
    person?: unknown;
    note?: unknown;
    occurredAt?: string | null;
}): MovementPayloadResult<IssueEditPatch> {
    const quantity = validAmount(input.quantity, true);
    if (quantity === null) return { ok: false, error: 'quantity' };
    const value: IssueEditPatch = {
        quantity,
        issued_to: trimmedOrNull(input.person, 200),
        note: trimmedOrNull(input.note),
    };
    const occurredAt = validTimestamp(input.occurredAt);
    if (occurredAt) value.issued_at = occurredAt;
    return { ok: true, value };
}

export function buildReceiptEditPatch(input: {
    quantity: unknown;
    purchasePrice: unknown;
    supplier?: unknown;
    note?: unknown;
    occurredAt?: string | null;
}): MovementPayloadResult<ReceiptEditPatch> {
    const quantity = validAmount(input.quantity, true);
    const purchasePrice = input.purchasePrice === null || input.purchasePrice === ''
        ? null
        : Number(input.purchasePrice);
    if (quantity === null) return { ok: false, error: 'quantity' };
    if (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0 || purchasePrice > 1_000_000_000)) {
        return { ok: false, error: 'price' };
    }
    const value: ReceiptEditPatch = {
        quantity,
        purchase_price_unit: purchasePrice,
        supplier: trimmedOrNull(input.supplier, 200),
        note: trimmedOrNull(input.note),
    };
    const occurredAt = validTimestamp(input.occurredAt);
    if (occurredAt) value.received_at = occurredAt;
    return { ok: true, value };
}

export function adjustedStockAfterMovementEdit(
    currentStock: unknown,
    previousQuantity: unknown,
    nextQuantity: unknown,
    kind: MovementKind,
): number | null {
    const current = Number(currentStock);
    const previous = Number(previousQuantity);
    const next = Number(nextQuantity);
    if (!['issue', 'receipt'].includes(kind) || ![current, previous, next].every(Number.isFinite) || current < 0 || previous < 0 || next < 0) return null;
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
