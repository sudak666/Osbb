// Згенеровано з src/sklad-domain.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
import { itemPriceValue } from "./sklad-pricing.js";
function normalizeSearchText(value) {
  return String(value ?? "").toLocaleLowerCase("uk-UA").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function valuesMatchSearch(values, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const searchableText = normalizeSearchText(values.filter(Boolean).join(" "));
  return normalizedQuery.split(" ").every((part) => searchableText.includes(part));
}
function isInternalItem(item) {
  return item.is_internal === true;
}
function isLowStockItem(item) {
  if (isInternalItem(item)) return false;
  if (item.min_quantity === null || item.min_quantity === void 0) return false;
  return item.quantity <= item.min_quantity;
}
function estimatedItemValue(item) {
  const quantity = Number(item.quantity);
  const price = Number(item.price_unit ?? 0);
  if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) return 0;
  return Math.round(quantity * price * 100) / 100;
}
function sortItemsByCategoryName(items) {
  return [...items].sort((a, b) => {
    const categoryCompare = normalizeSearchText(a.category || "").localeCompare(normalizeSearchText(b.category || ""), "uk-UA");
    if (categoryCompare !== 0) return categoryCompare;
    return normalizeSearchText(a.name).localeCompare(normalizeSearchText(b.name), "uk-UA");
  });
}
function filterSkladItems(items, options = {}) {
  return items.filter((item) => {
    const quantity = Number(item.quantity);
    if (options.category && item.category !== options.category) return false;
    if (options.stock === "zero" && quantity !== 0) return false;
    if (options.stock === "low" && !(quantity > 0 && quantity <= 3)) return false;
    if (options.stock === "ok" && quantity <= 3) return false;
    if (options.inStockOnly && quantity <= 0) return false;
    if (options.hideInternal && isInternalItem(item)) return false;
    if (!options.hideInternal && options.onlyInternal && !isInternalItem(item)) return false;
    return valuesMatchSearch([item.name, item.category, item.unit, item.price_source], options.query || "");
  });
}
function filterInventoryByValue(items, options = {}) {
  return items.filter((item) => {
    const quantity = Number(item.quantity || 0);
    if (options.category && item.category !== options.category) return false;
    if (options.internal === "balance" && isInternalItem(item)) return false;
    if (options.internal === "internal" && !isInternalItem(item)) return false;
    if (options.stock === "positive" && quantity <= 0) return false;
    if (options.stock === "low" && quantity > 3) return false;
    if (options.stock === "zero" && quantity !== 0) return false;
    if (options.stock === "normal" && quantity <= 3) return false;
    if (options.price === "priced" && itemPriceValue(item) === 0) return false;
    if (options.price === "unpriced" && itemPriceValue(item) > 0) return false;
    return true;
  });
}
function calculateInventoryHeaderStats(items) {
  return items.reduce((stats, item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    if (quantity > 0) stats.availableItems += 1;
    stats.totalUnits += quantity;
    stats.estimatedValue += quantity * itemPriceValue(item);
    return stats;
  }, { availableItems: 0, totalUnits: 0, estimatedValue: 0 });
}
export {
  calculateInventoryHeaderStats,
  estimatedItemValue,
  filterInventoryByValue,
  filterSkladItems,
  isInternalItem,
  isLowStockItem,
  normalizeSearchText,
  sortItemsByCategoryName,
  valuesMatchSearch
};
