export type WorkShiftType = 'day' | 'night' | 'night_half2' | 'rest';

export interface ShiftCounts {
    day: number;
    night: number;
    night_half2: number;
}

export interface WorkShiftRow {
    shift_date: string;
    sergiy: WorkShiftType[];
    oleksandr: WorkShiftType[];
    [key: string]: unknown;
}

export type WorkShiftRows = Record<string, WorkShiftRow>;

const WORK_SHIFT_TYPES: readonly WorkShiftType[] = ['day', 'night', 'night_half2', 'rest'];

function normalizeShiftTypes(value: unknown): WorkShiftType[] {
    if (!Array.isArray(value)) return [];
    return value.filter((type): type is WorkShiftType => typeof type === 'string' && WORK_SHIFT_TYPES.includes(type as WorkShiftType));
}

export function workShiftRowsFromResponse(value: unknown): WorkShiftRows {
    if (!Array.isArray(value)) return {};
    return Object.fromEntries(value.flatMap((row) => {
        if (typeof row !== 'object' || row === null || Array.isArray(row)) return [];
        const source = row as Record<string, unknown>;
        if (typeof source.shift_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(source.shift_date)) return [];
        return [[source.shift_date, {
            ...source,
            shift_date: source.shift_date,
            sergiy: normalizeShiftTypes(source.sergiy),
            oleksandr: normalizeShiftTypes(source.oleksandr),
        }]];
    }));
}

export const SHIFT_RATES: Readonly<Record<Exclude<WorkShiftType, 'rest'>, number>> = {
    day: 900,
    night: 900,
    night_half2: 450,
};

export function shiftDateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function shiftIsWorking(values: unknown): values is WorkShiftType[] {
    return Array.isArray(values) && values.some((value) => value !== 'rest');
}

export function shiftTypeDescription(values: unknown): string {
    if (!shiftIsWorking(values)) return 'вихідний';
    const hasFull = values.includes('day') || values.includes('night');
    const hasHalf = values.includes('night_half2');
    if (hasFull && hasHalf) return 'ціла і пів зміни';
    if (hasHalf) return 'пів зміни';
    return 'ціла зміна';
}

export function calculateShiftMoney(counts: ShiftCounts): number {
    return counts.day * SHIFT_RATES.day
        + counts.night * SHIFT_RATES.night
        + counts.night_half2 * SHIFT_RATES.night_half2;
}

export function shiftErrorMessage(error: unknown, fallback: string): string {
    const details = typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : String(error ?? '');
    if (details.includes('42P01') || details.includes('PGRST202') || details.includes('PGRST205')) return 'Застосуйте SQL-міграції 011–013 у Supabase';
    if (details.includes('23514')) return 'Supabase відхилив формат місяця — застосуйте міграцію 012';
    if (details.includes('401') || details.includes('403') || details.includes('42501')) return 'Немає дозволу на запис у Supabase';
    return fallback;
}
