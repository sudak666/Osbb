export const DEFAULT_AUTO_LOCK_MS = 30 * 60 * 1_000;

export interface AutoLockTimerApi {
    setTimeout(callback: () => void, delay: number): number;
    clearTimeout(handle: number): void;
}

export interface AutoLockController {
    reset(): void;
    lockNow(): void;
    stop(): void;
}

export function createAutoLockTimerApi(
    host: Pick<Window, 'setTimeout' | 'clearTimeout'>,
): AutoLockTimerApi {
    return {
        setTimeout: (callback, delay) => host.setTimeout(callback, delay),
        clearTimeout: (handle) => host.clearTimeout(handle),
    };
}

export function createAutoLockController(
    onLock: () => void,
    delay = DEFAULT_AUTO_LOCK_MS,
    timers?: AutoLockTimerApi,
): AutoLockController {
    if (typeof onLock !== 'function') throw new TypeError('Auto-lock callback is required');
    if (!Number.isSafeInteger(delay) || delay <= 0) throw new TypeError('Invalid auto-lock delay');
    const timerApi = timers ?? createAutoLockTimerApi(window);

    let timer: number | null = null;

    const stop = (): void => {
        if (timer === null) return;
        timerApi.clearTimeout(timer);
        timer = null;
    };

    const lockNow = (): void => {
        stop();
        onLock();
    };

    const reset = (): void => {
        stop();
        timer = timerApi.setTimeout(lockNow, delay);
    };

    return { reset, lockNow, stop };
}
