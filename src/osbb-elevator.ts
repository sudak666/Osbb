export interface ElevatorEntry {
    id: string;
    day: number;
    text: string;
    createdAt: string;
    createdBy: string;
}

export interface ElevatorEntryOptions {
    now?: Date;
    idSuffix?: string;
}

export function createElevatorEntry(
    day: unknown,
    text: unknown,
    createdBy: unknown,
    options: ElevatorEntryOptions = {},
): ElevatorEntry | null {
    const normalizedText = String(text ?? '').trim();
    if (!normalizedText) return null;

    const now = options.now ?? new Date();
    const numericDay = Number(day);
    const normalizedDay = Number.isInteger(numericDay) && numericDay > 0 ? numericDay : 1;
    const suffix = options.idSuffix ?? Math.random().toString(36).slice(2, 6);

    return {
        id: `e${now.getTime()}${suffix}`,
        day: normalizedDay,
        text: normalizedText,
        createdAt: now.toISOString(),
        createdBy: String(createdBy ?? ''),
    };
}

export function elevatorEntriesFromResponse(value: unknown): ElevatorEntry[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        if (typeof row.id !== 'string' || !row.id || !Number.isInteger(row.day) || (row.day as number) < 1 || (row.day as number) > 31) return [];
        if (typeof row.text !== 'string' || !row.text.trim()) return [];
        return [{
            id: row.id,
            day: row.day as number,
            text: row.text.trim(),
            createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
            createdBy: typeof row.createdBy === 'string' ? row.createdBy : '',
        }];
    });
}

export function removeElevatorEntry(entries: readonly ElevatorEntry[], id: unknown): ElevatorEntry[] {
    return entries.filter((entry) => entry.id !== id);
}

export function sortElevatorEntries(entries: readonly ElevatorEntry[]): ElevatorEntry[] {
    return [...entries].sort((first, second) => first.day - second.day);
}
