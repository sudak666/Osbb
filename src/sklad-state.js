function tableRows(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((row) => typeof row === 'object' && row !== null && !Array.isArray(row));
}

export function inventoryItemsFromResponse(value) {
    return tableRows(value);
}

export function inventoryLogsFromResponse(value) {
    return tableRows(value);
}

export function inventoryReceiptsFromResponse(value) {
    return tableRows(value);
}
