import { AUTH_TTL_MS } from './shell-state.ts';

const AUTH_KEY = 'auth';
const AUTH_AT_KEY = 'auth_at';

export interface AuthSessionStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export function setAuthSession(storage: AuthSessionStorage = sessionStorage, now = Date.now()): void {
    storage.setItem(AUTH_KEY, 'ok');
    storage.setItem(AUTH_AT_KEY, String(now));
}

export function clearAuthSession(storage: AuthSessionStorage = sessionStorage): void {
    storage.removeItem(AUTH_KEY);
    storage.removeItem(AUTH_AT_KEY);
}

export function isAuthSessionValid(storage: AuthSessionStorage = sessionStorage, now = Date.now()): boolean {
    if (storage.getItem(AUTH_KEY) !== 'ok') return false;
    const authAt = Number(storage.getItem(AUTH_AT_KEY) || 0);
    if (!authAt || now - authAt >= AUTH_TTL_MS) {
        clearAuthSession(storage);
        return false;
    }
    return true;
}
