export const MAX_SUPPLIER_TAGS = 12;
const MAX_SUPPLIER_TAG_LENGTH = 200;

export function normalizeSupplierTag(value: unknown): string {
    if (typeof value !== 'string') return '';
    const tag = value.trim().replace(/\s+/g, ' ');
    return tag.length <= MAX_SUPPLIER_TAG_LENGTH ? tag : '';
}

export function supplierTagKey(value: unknown): string {
    return normalizeSupplierTag(value).toLocaleLowerCase('uk-UA');
}

export function supplierTagsFromResponse(value: unknown, limit = 50): string[] {
    if (!Array.isArray(value)) return [];
    const names = value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const name = (entry as Record<string, unknown>).name;
        return typeof name === 'string' ? [name] : [];
    });
    return mergeSupplierTags([names], limit);
}

export function mergeSupplierTags(
    collections: readonly (readonly unknown[])[],
    limit = MAX_SUPPLIER_TAGS,
): string[] {
    if (!Array.isArray(collections)) return [];
    const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : MAX_SUPPLIER_TAGS;
    const tags: string[] = [];
    const known = new Set<string>();
    for (const collection of collections) {
        if (!Array.isArray(collection)) continue;
        for (const value of collection) {
            const tag = normalizeSupplierTag(value);
            const key = supplierTagKey(tag);
            if (!tag || known.has(key)) continue;
            known.add(key);
            tags.push(tag);
            if (tags.length >= normalizedLimit) return tags;
        }
    }
    return tags;
}

export function hasSupplierTag(tags: readonly unknown[], value: unknown): boolean {
    const key = supplierTagKey(value);
    return Boolean(key) && tags.some((tag) => supplierTagKey(tag) === key);
}
