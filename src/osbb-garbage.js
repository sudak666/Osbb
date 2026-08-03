export function garbageMonthKey(year, month) {
    return `${year}-${month}`;
}

export function garbageMonthKeyCandidates(year, month) {
    return [...new Set([
        garbageMonthKey(year, month),
        `${year}-${String(month).padStart(2, '0')}`,
    ])];
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
