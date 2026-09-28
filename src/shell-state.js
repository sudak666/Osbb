// Згенеровано з src/shell-state.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const TAB_SRC = {
  journal: "osbb/index.html?embed=1",
  sklad: "sklad/index.html?embed=1",
  promin: "promin/index.html?embed=1"
};
const AUTH_TTL_MS = 12 * 60 * 60 * 1e3;
const IDLE_LOCK_MS = 15 * 60 * 1e3;
class ShellStore {
  #lockBuf = "";
  #lockBusy = false;
  #lockFails = 0;
  #loadedTabs = {};
  get lockBuf() {
    return this.#lockBuf;
  }
  get lockBusy() {
    return this.#lockBusy;
  }
  get lockFails() {
    return this.#lockFails;
  }
  pushDigit(digit) {
    if (this.#lockBusy || this.#lockBuf.length >= 4 || typeof digit !== "string" || !/^\d$/.test(digit)) return;
    this.#lockBuf += digit;
  }
  deleteDigit() {
    if (this.#lockBusy) return;
    if (this.#lockBuf.length > 0) this.#lockBuf = this.#lockBuf.slice(0, -1);
  }
  clearPin() {
    this.#lockBuf = "";
  }
  setBusy(value) {
    this.#lockBusy = value;
  }
  resetFailures() {
    this.#lockFails = 0;
  }
  recordFailure() {
    this.#lockFails += 1;
    return this.#lockFails;
  }
  resetLock() {
    this.#lockBuf = "";
    this.#lockBusy = false;
  }
  isTabLoaded(name) {
    return isShellTabName(name) && Boolean(this.#loadedTabs[name]);
  }
  markTabLoaded(name) {
    if (isShellTabName(name)) this.#loadedTabs[name] = true;
  }
  snapshot() {
    return {
      lockBuf: this.#lockBuf,
      lockBusy: this.#lockBusy,
      lockFails: this.#lockFails,
      loadedTabs: { ...this.#loadedTabs }
    };
  }
}
function isShellTabName(name) {
  return name === "journal" || name === "sklad" || name === "promin";
}
export {
  AUTH_TTL_MS,
  IDLE_LOCK_MS,
  ShellStore,
  TAB_SRC,
  isShellTabName
};
