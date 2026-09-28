// Згенеровано з src/sklad-pricing.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: amount >= 100 ? 0 : 2
  }).format(amount);
}
function parseOptionalPrice(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const price = Number(raw);
  return Number.isFinite(price) && price > 0 && price <= 1e9 ? Math.round(price * 100) / 100 : Number.NaN;
}
function itemPriceValue(item) {
  const price = Number(item?.price_unit);
  return Number.isFinite(price) && price > 0 && price <= 1e9 ? price : 0;
}
function itemStockValue(item) {
  const quantity = Number(item?.quantity ?? 0);
  const value = itemPriceValue(item) * (Number.isFinite(quantity) && quantity >= 0 && quantity <= 1e9 ? quantity : 0);
  return Number.isFinite(value) ? value : 0;
}
export {
  formatMoney,
  itemPriceValue,
  itemStockValue,
  parseOptionalPrice
};
