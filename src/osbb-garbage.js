function garbageCount(value) {
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
}

export function normalizeGarbageMonth(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const month = {};
    for (const [day, entry] of Object.entries(value)) {
        const numericDay = Number(day);
        if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) continue;
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
        if (!entry.types || typeof entry.types !== 'object' || Array.isArray(entry.types)) {
            month[day] = { ...entry };
            continue;
        }
        const types = {};
        for (const type of ['plastic', 'glass', 'bins']) {
            const count = garbageCount(entry.types[type]);
            if (count !== undefined) types[type] = count;
        }
        month[day] = {
            time: typeof entry.time === 'string' ? entry.time : '',
            worker: typeof entry.worker === 'string' ? entry.worker : '',
            types,
        };
    }
    return month;
}

export function garbageMonthKey(year, month) {
    return `${year}-${month}`;
}

export function garbageMonthKeyCandidates(year, month) {
    return [...new Set([
        garbageMonthKey(year, month),
        `${year}-${String(month).padStart(2, '0')}`,
    ])];
}

export function garbageYearRowsFromResponse(value) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        if (typeof entry.month_key !== 'string' || !/^\d{4}-(?:\d|0\d|1[01])$/.test(entry.month_key)) return [];
        if (typeof entry.data !== 'object' || entry.data === null || Array.isArray(entry.data)) return [];
        return [{ month_key: entry.month_key, data: normalizeGarbageMonth(entry.data) }];
    });
}

export function migrateGarbageData(data) {
    if (!data) return { data, migrated: false };
    let migrated = false;
    const output = { ...data };
    for (const [day, row] of Object.entries(output)) {
        if (!row || row.types) continue;
        if (row.count === undefined && row.note === undefined) continue;
        const count = Number.parseInt(String(row.count ?? ''), 10) || 0;
        const types = {};
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

export function garbageBins(types) {
    return Number.parseInt(String(types?.bins ?? ''), 10) || 0;
}

export function garbageMonthBinsTotal(value) {
    const { data } = migrateGarbageData(normalizeGarbageMonth(value));
    return Object.values(data || {}).reduce((total, row) => total + garbageBins(row.types), 0);
}
