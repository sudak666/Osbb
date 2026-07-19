export const TAB_SRC = {
    journal: 'osbb/index.html?embed=1',
    sklad: 'sklad/index.html?embed=1'
};

export const AUTH_TTL_MS = 12 * 60 * 60 * 1000;
export const IDLE_LOCK_MS = 15 * 60 * 1000;

export class ShellStore {
    #lockBuf = '';
    #lockBusy = false;
    #lockFails = 0;
    #loadedTabs = {};

    get lockBuf() { return this.#lockBuf; }
    get lockBusy() { return this.#lockBusy; }
    get lockFails() { return this.#lockFails; }

    pushDigit(digit) {
        if (this.#lockBusy || this.#lockBuf.length >= 4) return;
        this.#lockBuf += digit;
    }

    deleteDigit() {
        if (this.#lockBusy) return;
        if (this.#lockBuf.length > 0) this.#lockBuf = this.#lockBuf.slice(0, -1);
    }

    clearPin() { this.#lockBuf = ''; }
    setBusy(value) { this.#lockBusy = value; }
    resetFailures() { this.#lockFails = 0; }

    recordFailure() {
        this.#lockFails += 1;
        return this.#lockFails;
    }

    resetLock() {
        this.#lockBuf = '';
        this.#lockBusy = false;
    }

    isTabLoaded(name) { return Boolean(this.#loadedTabs[name]); }
    markTabLoaded(name) { this.#loadedTabs[name] = true; }

    snapshot() {
        return {
            lockBuf: this.#lockBuf,
            lockBusy: this.#lockBusy,
            lockFails: this.#lockFails,
            loadedTabs: { ...this.#loadedTabs }
        };
    }
}

export function isShellTabName(name) {
    return name === 'journal' || name === 'sklad';
}
