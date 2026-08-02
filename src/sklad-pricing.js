export function formatMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return '—';
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH',
        maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
}

export function parseOptionalPrice(value) {
    const raw = String(value ?? '').trim().replace(',', '.');
    if (!raw) return null;
    const price = Number(raw);
    return Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : Number.NaN;
}

export function isPurchasePriceSchemaError(error) {
    const message = typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message).toLowerCase()
        : '';
    return ['purchase_price_unit', 'p_price_unit', 'receive_item']
        .some((field) => message.includes(field));
}

export function itemPriceValue(item) {
    const price = Number(item?.price_unit);
    return Number.isFinite(price) && price > 0 ? price : 0;
}

export function itemStockValue(item) {
    const quantity = Number(item?.quantity ?? 0);
    return itemPriceValue(item) * (Number.isFinite(quantity) ? quantity : 0);
}
