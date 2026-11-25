// Список закупівлі за мінімальними залишками та оцінка витрат складу
// (аудит листопада 2026, тиждень 4). Лише чисті функції — без DOM і мережі.

export interface PurchasingItem {
    id: number | string;
    name: string;
    category?: string | null;
    unit?: string | null;
    quantity: number;
    min_quantity?: number | null;
    price_unit?: number | null;
    is_internal?: boolean | null;
}

export interface ReceiptLike {
    item_id: number | string | null;
    quantity: number;
    supplier?: string | null;
    received_at?: string | null;
    purchase_price_unit?: number | null;
}

export interface IssueLike {
    item_id: number | string | null;
    quantity: number;
    issued_at?: string | null;
}

export interface PurchaseRow {
    id: number | string;
    name: string;
    category: string;
    unit: string;
    quantity: number;
    min: number;
    need: number;
    price: number;
    supplier: string;
    cost: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const num = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };

/** Розбирає введений мінімум: '' → null (не задано), невалідне → 'invalid'. */
export function parseMinQuantity(value: unknown): number | null | 'invalid' {
    const text = String(value ?? '').trim().replace(',', '.');
    if (!text) return null;
    if (!/^\d+(\.\d+)?$/.test(text)) return 'invalid';
    const parsed = Number(text);
    return Number.isFinite(parsed) && parsed <= 1_000_000 ? parsed : 'invalid';
}

export function hasMinimums(items: readonly PurchasingItem[]): boolean {
    return items.some((item) => item.min_quantity !== null && item.min_quantity !== undefined && item.is_internal !== true);
}

/** Товар нижче мінімуму: залишок менший за заданий мінімум (внутрішні не рахуються). */
export function isBelowMinimum(item: PurchasingItem): boolean {
    if (item.is_internal === true || item.min_quantity === null || item.min_quantity === undefined) return false;
    return num(item.quantity) < num(item.min_quantity);
}

/** Поріг «мало» для товарів без заданого мінімуму — так склад рахував до появи мінімумів. */
export const LOW_STOCK_FALLBACK = 3;

const hasMin = (item: PurchasingItem) => item.min_quantity !== null && item.min_quantity !== undefined;

/**
 * Товар закінчується (разом із нульовими залишками): із заданим мінімумом — залишок менший
 * за нього, без мінімуму — 3 і менше. Внутрішні не рахуються. Єдине правило для «Головної»,
 * шапки складу й звіту: раніше перший же заданий мінімум вимикав поріг «≤ 3» для решти
 * товарів, і лічильник показував 0 при десятках товарів, що закінчуються.
 */
export function isLowStock(item: PurchasingItem): boolean {
    if (item.is_internal === true) return false;
    const quantity = num(item.quantity);
    return hasMin(item) ? quantity < num(item.min_quantity) : quantity <= LOW_STOCK_FALLBACK;
}

/** Товари без мінімуму із залишком 3 і менше — від найменшого залишку. */
export function lowWithoutMinimum<T extends PurchasingItem>(items: readonly T[]): T[] {
    return items.filter((item) => item.is_internal !== true && !hasMin(item) && num(item.quantity) <= LOW_STOCK_FALLBACK)
        .sort((a, b) => num(a.quantity) - num(b.quantity));
}

/** Що докупити, щоб повернутися до мінімуму; постачальник — з останнього надходження. */
export function buildPurchaseList(items: readonly PurchasingItem[], receipts: readonly ReceiptLike[] = []): PurchaseRow[] {
    const lastSupplier = new Map<string, { at: number; supplier: string }>();
    for (const receipt of receipts) {
        const supplier = String(receipt.supplier ?? '').trim();
        if (!supplier || receipt.item_id === null) continue;
        const at = Date.parse(String(receipt.received_at ?? '')) || 0;
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
            category: item.category || 'Інше',
            unit: item.unit || 'шт',
            quantity,
            min,
            need,
            price,
            supplier: lastSupplier.get(String(item.id))?.supplier ?? '',
            cost: round2(need * price),
        };
    }).sort((a, b) => a.category.localeCompare(b.category, 'uk') || a.name.localeCompare(b.name, 'uk'));
}

export function purchaseListTotal(rows: readonly PurchaseRow[]): { cost: number; unpriced: number } {
    return rows.reduce((total, row) => {
        if (row.price > 0) total.cost = round2(total.cost + row.cost);
        else total.unpriced += 1;
        return total;
    }, { cost: 0, unpriced: 0 });
}

export function buildPurchaseExportRows(rows: readonly PurchaseRow[]): Record<string, string | number>[] {
    return rows.map((row) => ({
        'Категорія': row.category,
        'Товар': row.name,
        'Залишок': row.quantity,
        'Мінімум': row.min,
        'Докупити': row.need,
        'Од.': row.unit,
        'Ціна за од., грн': row.price || '',
        'Сума, грн': row.price ? row.cost : '',
        'Останній постачальник': row.supplier,
    }));
}

export interface MonthSpend { key: string; label: string; purchased: number; used: number }

const MONTH_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
const monthKeyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * Закуплено (надходження) і використано (видачі) по місяцях, у гривнях.
 * Ціна — ціна закупівлі з надходження, а якщо її немає — поточна ціна товару (оцінка).
 */
export function spendByMonth(
    receipts: readonly ReceiptLike[],
    issues: readonly IssueLike[],
    items: readonly PurchasingItem[],
    now: Date,
    months = 12,
): MonthSpend[] {
    const priceById = new Map(items.map((item) => [String(item.id), num(item.price_unit)]));
    const buckets = new Map<string, MonthSpend>();
    for (let offset = months - 1; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const key = monthKeyOf(date);
        buckets.set(key, { key, label: `${MONTH_SHORT[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`, purchased: 0, used: 0 });
    }
    const add = (at: string | null | undefined, amount: number, field: 'purchased' | 'used') => {
        const time = Date.parse(String(at ?? ''));
        if (!Number.isFinite(time) || amount <= 0) return;
        const bucket = buckets.get(monthKeyOf(new Date(time)));
        if (bucket) bucket[field] += amount;
    };
    for (const receipt of receipts) {
        const price = num(receipt.purchase_price_unit) || (priceById.get(String(receipt.item_id)) ?? 0);
        add(receipt.received_at, Math.max(0, num(receipt.quantity)) * price, 'purchased');
    }
    for (const issue of issues) {
        add(issue.issued_at, Math.max(0, num(issue.quantity)) * (priceById.get(String(issue.item_id)) ?? 0), 'used');
    }
    return [...buckets.values()].map((bucket) => ({ ...bucket, purchased: Math.round(bucket.purchased), used: Math.round(bucket.used) }));
}

/** На що йдуть матеріали: використано (видачі) за період по категоріях, грн, за спаданням. */
export function usageByCategory(
    issues: readonly IssueLike[],
    items: readonly PurchasingItem[],
    since: Date,
): { category: string; amount: number }[] {
    const byId = new Map(items.map((item) => [String(item.id), item]));
    const totals = new Map<string, number>();
    for (const issue of issues) {
        const time = Date.parse(String(issue.issued_at ?? ''));
        if (!Number.isFinite(time) || time < since.getTime()) continue;
        const item = byId.get(String(issue.item_id));
        const amount = Math.max(0, num(issue.quantity)) * num(item?.price_unit);
        if (amount <= 0) continue;
        const category = item?.category || 'Інше';
        totals.set(category, (totals.get(category) ?? 0) + amount);
    }
    return [...totals.entries()].map(([category, amount]) => ({ category, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount);
}
