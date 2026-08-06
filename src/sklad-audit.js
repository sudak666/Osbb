export function createAuditData(items, useCurrentQuantity = false) {
    return Object.fromEntries(items.map((item) => [String(item.id), useCurrentQuantity ? item.quantity : null]));
}

export function parseAuditQuantity(value) {
    const normalized = String(value ?? '').trim().replace(',', '.');
    if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
    const quantity = Number(normalized);
    return Number.isFinite(quantity) ? quantity : null;
}

export function calculateAuditSummary(items, auditData) {
    const countedItems = items.filter((item) => auditData[String(item.id)] !== null && auditData[String(item.id)] !== undefined);
    const differenceItems = countedItems.filter((item) => auditData[String(item.id)] !== item.quantity);
    const surplus = differenceItems.filter((item) => Number(auditData[String(item.id)]) > item.quantity).length;
    const shortage = differenceItems.length - surplus;
    const counted = countedItems.length;

    return {
        countedItems,
        differenceItems,
        counted,
        uncounted: items.length - counted,
        surplus,
        shortage,
        progress: Math.round((counted / Math.max(items.length, 1)) * 100),
    };
}
