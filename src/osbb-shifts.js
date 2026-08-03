const WORK_SHIFT_TYPES = ['day', 'night', 'night_half2', 'rest'];

function normalizeShiftTypes(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((type) => typeof type === 'string' && WORK_SHIFT_TYPES.includes(type));
}

export function workShiftRowsFromResponse(value) {
    if (!Array.isArray(value)) return {};
    return Object.fromEntries(value.flatMap((row) => {
        if (typeof row !== 'object' || row === null || Array.isArray(row)) return [];
        if (typeof row.shift_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.shift_date)) return [];
        return [[row.shift_date, {
            ...row,
            shift_date: row.shift_date,
            sergiy: normalizeShiftTypes(row.sergiy),
            oleksandr: normalizeShiftTypes(row.oleksandr),
        }]];
    }));
}

export const SHIFT_RATES = {
    day: 900,
    night: 900,
    night_half2: 450,
};

export function shiftDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function shiftIsWorking(values) {
    return Array.isArray(values) && values.some((value) => value !== 'rest');
}

export function shiftTypeDescription(values) {
    if (!shiftIsWorking(values)) return 'вихідний';
    const hasFull = values.includes('day') || values.includes('night');
    const hasHalf = values.includes('night_half2');
    if (hasFull && hasHalf) return 'ціла і пів зміни';
    if (hasHalf) return 'пів зміни';
    return 'ціла зміна';
}

export function calculateShiftMoney(counts) {
    return counts.day * SHIFT_RATES.day
        + counts.night * SHIFT_RATES.night
        + counts.night_half2 * SHIFT_RATES.night_half2;
}

export function shiftErrorMessage(error, fallback) {
    const details = typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : String(error ?? '');
    if (details.includes('42P01') || details.includes('PGRST202') || details.includes('PGRST205')) return 'Застосуйте SQL-міграції 011–013 у Supabase';
    if (details.includes('23514')) return 'Supabase відхилив формат місяця — застосуйте міграцію 012';
    if (details.includes('401') || details.includes('403') || details.includes('42501')) return 'Немає дозволу на запис у Supabase';
    return fallback;
}
