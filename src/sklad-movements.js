import { valuesMatchSearch } from './sklad-domain.js';

export function adjustedStockAfterMovementEdit(currentStock, previousQuantity, nextQuantity, kind) {
    const current = Number(currentStock);
    const previous = Number(previousQuantity);
    const next = Number(nextQuantity);
    if (!['issue', 'receipt'].includes(kind) || ![current, previous, next].every(Number.isFinite) || current < 0 || previous < 0 || next < 0) return null;
    const delta = kind === 'issue' ? previous - next : next - previous;
    const adjusted = Math.round((current + delta) * 100) / 100;
    return adjusted >= 0 ? adjusted : null;
}

function trimmedOrNull(value, maxLength = 1000) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized && normalized.length <= maxLength ? normalized : null;
}

function validAmount(value, allowZero = false) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount <= 1_000_000_000 && (allowZero ? amount >= 0 : amount > 0) ? amount : null;
}

function validTimestamp(value) {
    return typeof value === 'string' && value.length <= 100 && Number.isFinite(Date.parse(value)) ? value : null;
}

export function buildIssuePayload(input) {
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

export function buildReceiptPayload(input) {
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

export function buildIssueEditPatch(input) {
    const quantity = validAmount(input.quantity, true);
    if (quantity === null) return { ok: false, error: 'quantity' };
    const value = {
        quantity,
        issued_to: trimmedOrNull(input.person, 200),
        note: trimmedOrNull(input.note),
    };
    const occurredAt = validTimestamp(input.occurredAt);
    if (occurredAt) value.issued_at = occurredAt;
    return { ok: true, value };
}

export function buildReceiptEditPatch(input) {
    const quantity = validAmount(input.quantity, true);
    const purchasePrice = input.purchasePrice === null || input.purchasePrice === ''
        ? null
        : Number(input.purchasePrice);
    if (quantity === null) return { ok: false, error: 'quantity' };
    if (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0 || purchasePrice > 1_000_000_000)) {
        return { ok: false, error: 'price' };
    }
    const value = {
        quantity,
        purchase_price_unit: purchasePrice,
        supplier: trimmedOrNull(input.supplier, 200),
        note: trimmedOrNull(input.note),
    };
    const occurredAt = validTimestamp(input.occurredAt);
    if (occurredAt) value.received_at = occurredAt;
    return { ok: true, value };
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
