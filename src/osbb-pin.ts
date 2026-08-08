export const PIN_LENGTH = 4;
export const MAX_PIN_LOCKOUT_MS = 5_000;

export function appendPinDigit(value: string, digit: unknown): string {
    if (value.length >= PIN_LENGTH || typeof digit !== 'string' || !/^\d$/.test(digit)) return value;
    return value + digit;
}

export function deletePinDigit(value: string): string {
    return value.slice(0, -1);
}

export function isPinComplete(value: string): boolean {
    return value.length === PIN_LENGTH && /^\d+$/.test(value);
}

export function pinLockoutDelay(failedAttempts: number): number {
    if (!Number.isFinite(failedAttempts) || failedAttempts <= 0) return 0;
    return Math.min(Math.trunc(failedAttempts) * 500, MAX_PIN_LOCKOUT_MS);
}
