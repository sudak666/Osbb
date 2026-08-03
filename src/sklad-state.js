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

function nullableNumber(value) {
    return isFiniteNumber(value) ? value : null;
}

export function inventoryItemsFromResponse(value) {
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

export function inventoryLogsFromResponse(value) {
    return rows(value).flatMap((row) => {
        if (!isFiniteNumber(row.id) || typeof row.item_name !== 'string' || !isFiniteNumber(row.quantity) || typeof row.issued_at !== 'string') return [];
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
        if (!isFiniteNumber(row.id) || typeof row.item_name !== 'string' || !isFiniteNumber(row.quantity) || typeof row.received_at !== 'string') return [];
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
