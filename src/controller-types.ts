// Спільні типи залежностей, які контролери отримують ззовні (DI). Лише типи —
// у згенерованому JS цей модуль порожній.

export type SyncStatusType = 'loading' | 'ok' | 'error';

export type WarnFn = (...args: unknown[]) => void;

export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export type ReadOfflineFn = (storage: KeyValueStorage, key: string) => unknown;
export type WriteOfflineFn = (storage: KeyValueStorage, key: string, value: unknown) => unknown;
export type RemoveOfflineFn = (storage: KeyValueStorage, key: string) => void;

export interface CalendarMonth {
    year: number;
    month: number;
}

/** Відповідь у форматі Supabase: { data, error }. */
export interface DbResult<T = unknown> {
    data: T | null;
    error: ({ code?: string; message?: string } & Record<string, unknown>) | null;
}

export type ToastFn = (message: string, type?: string) => void;

/** setActionButtonLoading: повертає функцію відновлення або null, якщо кнопка вже зайнята. */
export type SetButtonLoadingFn = (button: HTMLElement | null | undefined, label: string) => (() => void) | null;

export type DeletePinOutcome = { ok: boolean; reason?: string };
export type RequestDeletePinFn = (title: string, action: (pin: string) => Promise<DeletePinOutcome | undefined | void>) => void;

/**
 * Мінімальний структурний тип supabase-js клієнта, який використовують
 * контролери. Ланцюжки запитів типізовано вільно: точні типи рядків
 * перевіряють *FromResponse-парсери на вході даних.
 */
export interface SupabaseLike {
    from(table: string): any;
    rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: any }>;
    storage: { from(bucket: string): any };
    channel?(name: string): any;
}
