const OFFLINE_SCOPES = ['att', 'garbage', 'dispatcher', 'elevator'];

export function osbbOfflineMonthKey(scope, year, month) {
    if (!OFFLINE_SCOPES.includes(scope)) throw new TypeError('Invalid offline cache scope');
    if (!Number.isSafeInteger(year) || year < 2000 || year > 2100) throw new TypeError('Invalid offline cache year');
    if (!Number.isSafeInteger(month) || month < 0 || month > 11) throw new TypeError('Invalid offline cache month');
    return `${scope}_${year}_${month}`;
}

export function readOsbbOfflineValue(storage, key) {
    try {
        const raw = storage.getItem(key);
        return raw === null ? null : JSON.parse(raw);
    } catch {
        return null;
    }
}

export function writeOsbbOfflineValue(storage, key, value) {
    try {
        storage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function removeOsbbOfflineValue(storage, key) {
    try { storage.removeItem(key); } catch {}
}
