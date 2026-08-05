export const MAX_SUPPLIER_TAGS = 12;

export function normalizeSupplierTag(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function supplierTagKey(value) {
    return normalizeSupplierTag(value).toLocaleLowerCase('uk-UA');
}

export function supplierTagsFromResponse(value, limit = 50) {
    if (!Array.isArray(value)) return [];
    const names = value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        return typeof entry.name === 'string' ? [entry.name] : [];
    });
    return mergeSupplierTags([names], limit);
}

export function mergeSupplierTags(collections, limit = MAX_SUPPLIER_TAGS) {
    const tags = [];
    const known = new Set();
    for (const collection of collections) {
        for (const value of collection) {
            const tag = normalizeSupplierTag(value);
            const key = supplierTagKey(tag);
            if (!tag || known.has(key)) continue;
            known.add(key);
            tags.push(tag);
            if (tags.length >= limit) return tags;
        }
    }
    return tags;
}

export function hasSupplierTag(tags, value) {
    const key = supplierTagKey(value);
    return Boolean(key) && tags.some((tag) => supplierTagKey(tag) === key);
}
