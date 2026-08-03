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

function trimmedOrNull(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

export function buildIssuePayload(input) {
    const itemId = Number(input.itemId);
    const quantity = Number(input.quantity);
    const person = trimmedOrNull(input.person);
    if (!Number.isInteger(itemId) || itemId <= 0) return { ok: false, error: 'item' };
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'quantity' };
    if (!person) return { ok: false, error: 'person' };
    return {
        ok: true,
        value: { itemId, quantity, person, note: trimmedOrNull(input.note), occurredAt: input.occurredAt || null },
    };
}

export function buildReceiptPayload(input) {
    const itemId = Number(input.itemId);
    const quantity = Number(input.quantity);
    const purchasePrice = input.purchasePrice === null || input.purchasePrice === ''
        ? null
        : Number(input.purchasePrice);
    if (!Number.isInteger(itemId) || itemId <= 0) return { ok: false, error: 'item' };
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'quantity' };
    if (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) {
        return { ok: false, error: 'price' };
    }
    return {
        ok: true,
        value: {
            itemId,
            quantity,
            purchasePrice,
            supplier: trimmedOrNull(input.supplier),
            note: trimmedOrNull(input.note),
            occurredAt: input.occurredAt || null,
        },
    };
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
