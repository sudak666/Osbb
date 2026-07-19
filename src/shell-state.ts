export type ShellTabName = 'journal' | 'sklad';

export const TAB_SRC: Record<ShellTabName, string> = {
    journal: 'osbb/index.html?embed=1',
    sklad: 'sklad/index.html?embed=1'
};

export const AUTH_TTL_MS = 12 * 60 * 60 * 1000;
export const IDLE_LOCK_MS = 15 * 60 * 1000;

export interface ShellStateSnapshot {
    lockBuf: string;
    lockBusy: boolean;
    lockFails: number;
    loadedTabs: Readonly<Partial<Record<ShellTabName, boolean>>>;
}

export class ShellStore {
    #lockBuf = '';
    #lockBusy = false;
    #lockFails = 0;
    #loadedTabs: Partial<Record<ShellTabName, boolean>> = {};

    get lockBuf(): string {
        return this.#lockBuf;
    }

    get lockBusy(): boolean {
        return this.#lockBusy;
    }

    get lockFails(): number {
        return this.#lockFails;
    }

    pushDigit(digit: string): void {
        if (this.#lockBusy || this.#lockBuf.length >= 4) return;
        this.#lockBuf += digit;
    }

    deleteDigit(): void {
        if (this.#lockBusy) return;
        if (this.#lockBuf.length > 0) this.#lockBuf = this.#lockBuf.slice(0, -1);
    }

    clearPin(): void {
        this.#lockBuf = '';
    }

    setBusy(value: boolean): void {
        this.#lockBusy = value;
    }

    resetFailures(): void {
        this.#lockFails = 0;
    }

    recordFailure(): number {
        this.#lockFails += 1;
        return this.#lockFails;
    }

    resetLock(): void {
        this.#lockBuf = '';
        this.#lockBusy = false;
    }

    isTabLoaded(name: ShellTabName): boolean {
        return Boolean(this.#loadedTabs[name]);
    }

    markTabLoaded(name: ShellTabName): void {
        this.#loadedTabs[name] = true;
    }

    snapshot(): ShellStateSnapshot {
        return {
            lockBuf: this.#lockBuf,
            lockBusy: this.#lockBusy,
            lockFails: this.#lockFails,
            loadedTabs: { ...this.#loadedTabs }
        };
    }
}

export function isShellTabName(name: string | undefined): name is ShellTabName {
    return name === 'journal' || name === 'sklad';
}
