export const DEFAULT_AUTO_LOCK_MS = 30 * 60 * 1_000;

export function createAutoLockTimerApi(host) {
    return {
        setTimeout: (callback, delay) => host.setTimeout(callback, delay),
        clearTimeout: (handle) => host.clearTimeout(handle),
    };
}

export function createAutoLockController(onLock, delay = DEFAULT_AUTO_LOCK_MS, timers) {
    if (typeof onLock !== 'function') throw new TypeError('Auto-lock callback is required');
    if (!Number.isSafeInteger(delay) || delay <= 0) throw new TypeError('Invalid auto-lock delay');
    const timerApi = timers ?? createAutoLockTimerApi(window);

    let timer = null;

    const stop = () => {
        if (timer === null) return;
        timerApi.clearTimeout(timer);
        timer = null;
    };

    const lockNow = () => {
        stop();
        onLock();
    };

    const reset = () => {
        stop();
        timer = timerApi.setTimeout(lockNow, delay);
    };

    return { reset, lockNow, stop };
}
