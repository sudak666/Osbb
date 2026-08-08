export interface GarbageTypes {
    plastic?: number;
    glass?: number;
    bins?: number;
}

export interface GarbageRow {
    time?: string;
    worker?: string;
    types?: GarbageTypes;
    count?: unknown;
    note?: unknown;
    [key: string]: unknown;
}

export type GarbageMonthData = Record<string, GarbageRow>;

export interface GarbageMigrationResult {
    data: GarbageMonthData | null | undefined;
    migrated: boolean;
}

export interface GarbageMonthRow {
    month_key: string;
    data: GarbageMonthData;
}

function garbageCount(value: unknown): number | undefined {
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
}

function garbageTime(value: unknown): string {
    return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '';
}

function garbageWorker(value: unknown): string {
    if (typeof value !== 'string') return '';
    const worker = value.trim();
    return worker.length <= 100 ? worker : '';
}

export function normalizeGarbageMonth(value: unknown): GarbageMonthData {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const month: GarbageMonthData = {};
    for (const [day, entry] of Object.entries(value)) {
        const numericDay = Number(day);
        if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) continue;
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
        const row = entry as Record<string, unknown>;
        if (!row.types || typeof row.types !== 'object' || Array.isArray(row.types)) {
            month[day] = {
                time: garbageTime(row.time),
                worker: garbageWorker(row.worker),
                count: row.count,
                note: typeof row.note === 'string' ? row.note : '',
            };
            continue;
        }
        const sourceTypes = row.types as Record<string, unknown>;
        const types: GarbageTypes = {};
        for (const type of ['plastic', 'glass', 'bins'] as const) {
            const count = garbageCount(sourceTypes[type]);
            if (count !== undefined) types[type] = count;
        }
        month[day] = {
            time: garbageTime(row.time),
            worker: garbageWorker(row.worker),
            types,
        };
    }
    return month;
}

export function garbageMonthKey(year: number, month: number): string {
    return `${year}-${month}`;
}

export function garbageMonthKeyCandidates(year: number, month: number): string[] {
    return [...new Set([
        garbageMonthKey(year, month),
        `${year}-${String(month).padStart(2, '0')}`,
    ])];
}

export function garbageYearRowsFromResponse(value: unknown): GarbageMonthRow[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        if (typeof row.month_key !== 'string' || !/^\d{4}-(?:\d|0\d|1[01])$/.test(row.month_key)) return [];
        if (typeof row.data !== 'object' || row.data === null || Array.isArray(row.data)) return [];
        return [{ month_key: row.month_key, data: normalizeGarbageMonth(row.data) }];
    });
}

export function migrateGarbageData(data: GarbageMonthData | null | undefined): GarbageMigrationResult {
    if (!data) return { data, migrated: false };
    let migrated = false;
    const output: GarbageMonthData = { ...data };
    for (const [day, row] of Object.entries(output)) {
        if (!row || row.types) continue;
        if (row.count === undefined && row.note === undefined) continue;
        const count = Number.parseInt(String(row.count ?? ''), 10) || 0;
        const types: GarbageTypes = {};
        if (count > 0) {
            if (row.note === 'plastic') types.plastic = count;
            else if (row.note === 'glass') types.glass = count;
            else if (row.note === 'both') {
                types.plastic = count;
                types.glass = count;
            } else types.bins = count;
        }
        output[day] = { time: garbageTime(row.time), worker: garbageWorker(row.worker), types };
        migrated = true;
    }
    return { data: output, migrated };
}

export function garbageBins(types: GarbageTypes | null | undefined): number {
    return Number.parseInt(String(types?.bins ?? ''), 10) || 0;
}

export function garbageMonthBinsTotal(value: unknown): number {
    const { data } = migrateGarbageData(normalizeGarbageMonth(value));
    return Object.values(data || {}).reduce((total, row) => total + garbageBins(row.types), 0);
}
