export function createElevatorEntry(day, text, createdBy, options = {}) {
    const normalizedText = String(text ?? '').trim();
    if (!normalizedText || normalizedText.length > 1000) return null;

    const now = options.now ?? new Date();
    const numericDay = Number(day);
    const normalizedDay = Number.isInteger(numericDay) && numericDay > 0 ? numericDay : 1;
    const suffix = options.idSuffix ?? Math.random().toString(36).slice(2, 6);

    return {
        id: `e${now.getTime()}${suffix}`,
        day: normalizedDay,
        text: normalizedText,
        createdAt: now.toISOString(),
        createdBy: String(createdBy ?? '').trim().slice(0, 100),
    };
}

export function elevatorEntriesFromResponse(value) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        if (typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(entry.id) || !Number.isInteger(entry.day) || entry.day < 1 || entry.day > 31) return [];
        if (typeof entry.text !== 'string' || !entry.text.trim() || entry.text.trim().length > 1000) return [];
        return [{
            id: entry.id,
            day: entry.day,
            text: entry.text.trim(),
            createdAt: typeof entry.createdAt === 'string' && Number.isFinite(Date.parse(entry.createdAt)) ? entry.createdAt : '',
            createdBy: typeof entry.createdBy === 'string' && entry.createdBy.trim().length <= 100 ? entry.createdBy.trim() : '',
        }];
    });
}

export function removeElevatorEntry(entries, id) {
    return entries.filter((entry) => entry.id !== id);
}

export function sortElevatorEntries(entries) {
    return [...entries].sort((first, second) => first.day - second.day);
}
