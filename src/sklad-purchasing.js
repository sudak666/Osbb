// Згенеровано з src/sklad-purchasing.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const round2 = (value) => Math.round(value * 100) / 100;
const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
function parseMinQuantity(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) return "invalid";
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed <= 1e6 ? parsed : "invalid";
}
function hasMinimums(items) {
  return items.some((item) => item.min_quantity !== null && item.min_quantity !== void 0 && item.is_internal !== true);
}
function isBelowMinimum(item) {
  if (item.is_internal === true || item.min_quantity === null || item.min_quantity === void 0) return false;
  return num(item.quantity) < num(item.min_quantity);
}
function buildPurchaseList(items, receipts = []) {
  const lastSupplier = /* @__PURE__ */ new Map();
  for (const receipt of receipts) {
    const supplier = String(receipt.supplier ?? "").trim();
    if (!supplier || receipt.item_id === null) continue;
    const at = Date.parse(String(receipt.received_at ?? "")) || 0;
    const key = String(receipt.item_id);
    const known = lastSupplier.get(key);
    if (!known || at >= known.at) lastSupplier.set(key, { at, supplier });
  }
  return items.filter(isBelowMinimum).map((item) => {
    const quantity = Math.max(0, num(item.quantity));
    const min = num(item.min_quantity);
    const need = round2(min - quantity);
    const price = num(item.price_unit);
    return {
      id: item.id,
      name: item.name,
      category: item.category || "Інше",
      unit: item.unit || "шт",
      quantity,
      min,
      need,
      price,
      supplier: lastSupplier.get(String(item.id))?.supplier ?? "",
      cost: round2(need * price)
    };
  }).sort((a, b) => a.category.localeCompare(b.category, "uk") || a.name.localeCompare(b.name, "uk"));
}
function purchaseListTotal(rows) {
  return rows.reduce((total, row) => {
    if (row.price > 0) total.cost = round2(total.cost + row.cost);
    else total.unpriced += 1;
    return total;
  }, { cost: 0, unpriced: 0 });
}
function buildPurchaseExportRows(rows) {
  return rows.map((row) => ({
    "Категорія": row.category,
    "Товар": row.name,
    "Залишок": row.quantity,
    "Мінімум": row.min,
    "Докупити": row.need,
    "Од.": row.unit,
    "Ціна за од., грн": row.price || "",
    "Сума, грн": row.price ? row.cost : "",
    "Останній постачальник": row.supplier
  }));
}
const MONTH_SHORT = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
function spendByMonth(receipts, issues, items, now, months = 12) {
  const priceById = new Map(items.map((item) => [String(item.id), num(item.price_unit)]));
  const buckets = /* @__PURE__ */ new Map();
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = monthKeyOf(date);
    buckets.set(key, { key, label: `${MONTH_SHORT[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`, purchased: 0, used: 0 });
  }
  const add = (at, amount, field) => {
    const time = Date.parse(String(at ?? ""));
    if (!Number.isFinite(time) || amount <= 0) return;
    const bucket = buckets.get(monthKeyOf(new Date(time)));
    if (bucket) bucket[field] += amount;
  };
  for (const receipt of receipts) {
    const price = num(receipt.purchase_price_unit) || (priceById.get(String(receipt.item_id)) ?? 0);
    add(receipt.received_at, Math.max(0, num(receipt.quantity)) * price, "purchased");
  }
  for (const issue of issues) {
    add(issue.issued_at, Math.max(0, num(issue.quantity)) * (priceById.get(String(issue.item_id)) ?? 0), "used");
  }
  return [...buckets.values()].map((bucket) => ({ ...bucket, purchased: Math.round(bucket.purchased), used: Math.round(bucket.used) }));
}
function usageByCategory(issues, items, since) {
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const totals = /* @__PURE__ */ new Map();
  for (const issue of issues) {
    const time = Date.parse(String(issue.issued_at ?? ""));
    if (!Number.isFinite(time) || time < since.getTime()) continue;
    const item = byId.get(String(issue.item_id));
    const amount = Math.max(0, num(issue.quantity)) * num(item?.price_unit);
    if (amount <= 0) continue;
    const category = item?.category || "Інше";
    totals.set(category, (totals.get(category) ?? 0) + amount);
  }
  return [...totals.entries()].map(([category, amount]) => ({ category, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount);
}
export {
  buildPurchaseExportRows,
  buildPurchaseList,
  hasMinimums,
  isBelowMinimum,
  parseMinQuantity,
  purchaseListTotal,
  spendByMonth,
  usageByCategory
};
