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

export function createAutoLockController(
    onLock: () => void,
    delay = DEFAULT_AUTO_LOCK_MS,
    timers: AutoLockTimerApi = { setTimeout, clearTimeout },
): AutoLockController {
    if (typeof onLock !== 'function') throw new TypeError('Auto-lock callback is required');
    if (!Number.isSafeInteger(delay) || delay <= 0) throw new TypeError('Invalid auto-lock delay');

    let timer: number | null = null;

    const stop = (): void => {
        if (timer === null) return;
        timers.clearTimeout(timer);
        timer = null;
    };

    const lockNow = (): void => {
        stop();
        onLock();
    };

    const reset = (): void => {
        stop();
        timer = timers.setTimeout(lockNow, delay);
    };

    return { reset, lockNow, stop };
}
