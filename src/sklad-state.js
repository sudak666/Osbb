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

export function inventoryItemFromInsertResponse(value) {
    return inventoryItemsFromResponse([value])[0] ?? null;
}

export function inventoryLogsFromResponse(value) {
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

export function inventoryReceiptsFromResponse(value) {
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
