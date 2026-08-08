export const DEFAULT_AUTO_LOCK_MS = 30 * 60 * 1_000;

export function createAutoLockController(onLock, delay = DEFAULT_AUTO_LOCK_MS, timers = { setTimeout, clearTimeout }) {
    if (typeof onLock !== 'function') throw new TypeError('Auto-lock callback is required');
    if (!Number.isSafeInteger(delay) || delay <= 0) throw new TypeError('Invalid auto-lock delay');

    let timer = null;

    const stop = () => {
        if (timer === null) return;
        timers.clearTimeout(timer);
        timer = null;
    };

    const lockNow = () => {
        stop();
        onLock();
    };

    const reset = () => {
        stop();
        timer = timers.setTimeout(lockNow, delay);
    };

    return { reset, lockNow, stop };
}
