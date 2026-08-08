export const OSBB_THEME_STORAGE_KEY = 'selected_theme';

export type OsbbTheme = 'theme-light' | 'theme-dark';

export interface OsbbClientStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export function normalizeOsbbTheme(value: unknown): OsbbTheme {
    return value === 'theme-dark' ? 'theme-dark' : 'theme-light';
}

export function loadOsbbTheme(storage: Pick<OsbbClientStorage, 'getItem'>): OsbbTheme {
    try { return normalizeOsbbTheme(storage.getItem(OSBB_THEME_STORAGE_KEY)); } catch { return 'theme-light'; }
}

export function saveOsbbTheme(storage: Pick<OsbbClientStorage, 'setItem'>, theme: unknown): OsbbTheme {
    const normalized = normalizeOsbbTheme(theme);
    try { storage.setItem(OSBB_THEME_STORAGE_KEY, normalized); } catch {}
    return normalized;
}

export function nextOsbbTheme(theme: unknown): OsbbTheme {
    return normalizeOsbbTheme(theme) === 'theme-dark' ? 'theme-light' : 'theme-dark';
}

export function formatTimeMaskValue(value: unknown): string {
    const digits = String(value ?? '').replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    const hours = Number(digits.slice(0, 2)) > 23 ? '23' : digits.slice(0, 2);
    const rawMinutes = digits.slice(2, 4);
    const minutes = rawMinutes.length === 2 && Number(rawMinutes) > 59 ? '59' : rawMinutes;
    return `${hours}:${minutes}`;
}

export function isCompleteTimeValue(value: unknown): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? ''));
}

export function shouldApplyRealtimeRefresh(currentTab: unknown, targetTab: unknown, activeTagName: unknown): boolean {
    if (typeof currentTab !== 'string' || currentTab !== targetTab) return false;
    const tagName = typeof activeTagName === 'string' ? activeTagName.toUpperCase() : '';
    return tagName !== 'INPUT' && tagName !== 'TEXTAREA';
}
