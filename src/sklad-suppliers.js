// Згенеровано з src/sklad-suppliers.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const MAX_SUPPLIER_TAGS = 12;
const MAX_SUPPLIER_TAG_LENGTH = 200;
function normalizeSupplierTag(value) {
  if (typeof value !== "string") return "";
  const tag = value.trim().replace(/\s+/g, " ");
  return tag.length <= MAX_SUPPLIER_TAG_LENGTH ? tag : "";
}
function supplierTagKey(value) {
  return normalizeSupplierTag(value).toLocaleLowerCase("uk-UA");
}
function supplierTagsFromResponse(value, limit = 50) {
  if (!Array.isArray(value)) return [];
  const names = value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const name = entry.name;
    return typeof name === "string" ? [name] : [];
  });
  return mergeSupplierTags([names], limit);
}
function mergeSupplierTags(collections, limit = MAX_SUPPLIER_TAGS) {
  if (!Array.isArray(collections)) return [];
  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : MAX_SUPPLIER_TAGS;
  const tags = [];
  const known = /* @__PURE__ */ new Set();
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
function hasSupplierTag(tags, value) {
  const key = supplierTagKey(value);
  return Boolean(key) && tags.some((tag) => supplierTagKey(tag) === key);
}
export {
  MAX_SUPPLIER_TAGS,
  hasSupplierTag,
  mergeSupplierTags,
  normalizeSupplierTag,
  supplierTagKey,
  supplierTagsFromResponse
};
