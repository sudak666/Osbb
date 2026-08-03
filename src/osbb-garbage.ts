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

export function garbageMonthKey(year: number, month: number): string {
    return `${year}-${month}`;
}

export function garbageMonthKeyCandidates(year: number, month: number): string[] {
    return [...new Set([
        garbageMonthKey(year, month),
        `${year}-${String(month).padStart(2, '0')}`,
    ])];
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
        output[day] = { time: row.time || '', worker: row.worker || '', types };
        migrated = true;
    }
    return { data: output, migrated };
}

export function garbageBins(types: GarbageTypes | null | undefined): number {
    return Number.parseInt(String(types?.bins ?? ''), 10) || 0;
}
