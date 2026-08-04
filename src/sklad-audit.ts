export interface AuditableItem {
    id: string | number;
    quantity: number;
}

export type AuditData = Record<string, number | null>;

export interface AuditSummary<T extends AuditableItem> {
    countedItems: T[];
    differenceItems: T[];
    counted: number;
    uncounted: number;
    surplus: number;
    shortage: number;
    progress: number;
}

export function auditIdFromInsertResponse(value: unknown): number | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const id = (value as Record<string, unknown>).id;
    return typeof id === 'number' && Number.isFinite(id) ? id : null;
}

export function createAuditData(items: readonly AuditableItem[], useCurrentQuantity = false): AuditData {
    return Object.fromEntries(items.map((item) => [String(item.id), useCurrentQuantity ? item.quantity : null]));
}

export function parseAuditQuantity(value: unknown): number | null {
    const normalized = String(value ?? '').trim().replace(',', '.');
    if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
    const quantity = Number(normalized);
    return Number.isFinite(quantity) ? quantity : null;
}

export function calculateAuditSummary<T extends AuditableItem>(
    items: readonly T[],
    auditData: AuditData,
): AuditSummary<T> {
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
