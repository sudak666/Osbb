// Згенеровано з src/pin-entry.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const PIN_LENGTH = 4;
const MAX_PIN_LOCKOUT_MS = 5e3;
function appendPinDigit(value, digit) {
  if (value.length >= PIN_LENGTH || typeof digit !== "string" || !/^\d$/.test(digit)) return value;
  return value + digit;
}
function deletePinDigit(value) {
  return value.slice(0, -1);
}
function isPinComplete(value) {
  return value.length === PIN_LENGTH && /^\d+$/.test(value);
}
function applyPinKey(value, key) {
  if (key === "C") return "";
  if (key === "DEL") return deletePinDigit(value);
  return appendPinDigit(value, key);
}
function pinLockoutDelay(failedAttempts) {
  if (!Number.isFinite(failedAttempts) || failedAttempts <= 0) return 0;
  return Math.min(Math.trunc(failedAttempts) * 500, MAX_PIN_LOCKOUT_MS);
}
export {
  MAX_PIN_LOCKOUT_MS,
  PIN_LENGTH,
  appendPinDigit,
  applyPinKey,
  deletePinDigit,
  isPinComplete,
  pinLockoutDelay
};
