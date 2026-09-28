// Згенеровано з src/osbb-offline.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const OFFLINE_SCOPES = ["att", "garbage", "dispatcher", "elevator"];
function osbbOfflineMonthKey(scope, year, month) {
  if (!OFFLINE_SCOPES.includes(scope)) throw new TypeError("Invalid offline cache scope");
  if (!Number.isSafeInteger(year) || year < 2e3 || year > 2100) throw new TypeError("Invalid offline cache year");
  if (!Number.isSafeInteger(month) || month < 0 || month > 11) throw new TypeError("Invalid offline cache month");
  return `${scope}_${year}_${month}`;
}
function readOsbbOfflineValue(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
function writeOsbbOfflineValue(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function removeOsbbOfflineValue(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
  }
}
export {
  osbbOfflineMonthKey,
  readOsbbOfflineValue,
  removeOsbbOfflineValue,
  writeOsbbOfflineValue
};
