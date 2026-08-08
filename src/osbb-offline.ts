export type OsbbOfflineScope = 'att' | 'garbage' | 'dispatcher' | 'elevator';

export interface OsbbOfflineStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const OFFLINE_SCOPES: readonly OsbbOfflineScope[] = ['att', 'garbage', 'dispatcher', 'elevator'];

export function osbbOfflineMonthKey(scope: OsbbOfflineScope, year: number, month: number): string {
    if (!OFFLINE_SCOPES.includes(scope)) throw new TypeError('Invalid offline cache scope');
    if (!Number.isSafeInteger(year) || year < 2000 || year > 2100) throw new TypeError('Invalid offline cache year');
    if (!Number.isSafeInteger(month) || month < 0 || month > 11) throw new TypeError('Invalid offline cache month');
    return `${scope}_${year}_${month}`;
}

export function readOsbbOfflineValue(storage: OsbbOfflineStorage, key: string): unknown | null {
    try {
        const raw = storage.getItem(key);
        return raw === null ? null : JSON.parse(raw);
    } catch {
        return null;
    }
}

export function writeOsbbOfflineValue(storage: OsbbOfflineStorage, key: string, value: unknown): boolean {
    try {
        storage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function removeOsbbOfflineValue(storage: OsbbOfflineStorage, key: string): void {
    try { storage.removeItem(key); } catch {}
}
