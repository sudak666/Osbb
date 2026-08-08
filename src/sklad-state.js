export function createInventoryCollectionState() {
    return {
        allItems: [],
        allLogs: [],
        allReceipts: [],
    };
}

function rows(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((row) => typeof row === 'object' && row !== null && !Array.isArray(row));
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function nullableString(value) {
    return typeof value === 'string' ? value : null;
}

function boundedText(value, maxLength) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized && normalized.length <= maxLength ? normalized : null;
}

function optionalText(value, maxLength) {
    if (value === null || value === undefined || value === '') return null;
    return boundedText(value, maxLength);
}

function nullableNumber(value) {
    return isFiniteNumber(value) ? value : null;
}

function isTimestamp(value) {
    return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value));
}

export function inventoryUnitFromRpcResponse(value, fallback) {
    if (!Array.isArray(value) || value.length === 0) return fallback;
    const row = value[0];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return fallback;
    const unit = row.unit;
    if (typeof unit !== 'string') return fallback;
    const normalized = unit.trim();
    return normalized && normalized.length <= 50 ? normalized : fallback;
}

export function deleteInventoryResultFromRpcResponse(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ok: false };
    if (value.ok === true) return { ok: true };
    if (value.ok !== false) return { ok: false };
    const reason = value.reason;
    return reason === 'bad_pin' || reason === 'negative_stock' || reason === 'not_found'
        ? { ok: false, reason }
        : { ok: false };
}

export function inventoryItemsFromResponse(value) {
    return rows(value).flatMap((row) => {
        const name = boundedText(row.name, 200);
        const unit = boundedText(row.unit, 50);
        if (!isFiniteNumber(row.id) || !name || !isFiniteNumber(row.quantity) || !unit) return [];
        return [{
            id: row.id,
            name,
            category: optionalText(row.category, 80),
            quantity: row.quantity,
            unit,
            min_quantity: nullableNumber(row.min_quantity),
            photo_url: nullableString(row.photo_url),
            created_at: isTimestamp(row.created_at) ? row.created_at : null,
            updated_at: isTimestamp(row.updated_at) ? row.updated_at : null,
            is_internal: row.is_internal === true,
            price_unit: nullableNumber(row.price_unit),
            price_source: optionalText(row.price_source, 80),
            price_url: nullableString(row.price_url),
            price_checked_at: isTimestamp(row.price_checked_at) ? row.price_checked_at : null,
            price_confidence: row.price_confidence === 'manual' || row.price_confidence === 'internet'
                || row.price_confidence === 'low' || row.price_confidence === 'medium' || row.price_confidence === 'high'
                ? row.price_confidence
                : null,
        }];
    });
}

export function inventoryItemIdFromInsertResponse(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return isFiniteNumber(value.id) ? value.id : null;
}

export function inventoryLogsFromResponse(value) {
    return rows(value).flatMap((row) => {
        const itemName = boundedText(row.item_name, 200);
        if (!isFiniteNumber(row.id) || !itemName || !isFiniteNumber(row.quantity) || !isTimestamp(row.issued_at)) return [];
        return [{
            id: row.id,
            item_id: nullableNumber(row.item_id),
            item_name: itemName,
            quantity: row.quantity,
            issued_to: optionalText(row.issued_to, 200),
            note: optionalText(row.note, 1000),
            issued_at: row.issued_at,
        }];
    });
}

export function inventoryReceiptsFromResponse(value) {
    return rows(value).flatMap((row) => {
        const itemName = boundedText(row.item_name, 200);
        if (!isFiniteNumber(row.id) || !itemName || !isFiniteNumber(row.quantity) || !isTimestamp(row.received_at)) return [];
        return [{
            id: row.id,
            item_id: nullableNumber(row.item_id),
            item_name: itemName,
            quantity: row.quantity,
            purchase_price_unit: nullableNumber(row.purchase_price_unit),
            supplier: optionalText(row.supplier, 200),
            note: optionalText(row.note, 1000),
            received_at: row.received_at,
        }];
    });
}
