export const PROMIN_BASE_URL = 'http://192.168.0.11';
export const PROMIN_PULT_POLL_INTERVAL_MS = 5_000;
export const PROMIN_OBOR_POLL_INTERVAL_MS = 2_000;
export const PROMIN_DU_PULSE_MS = 5_000;

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const stringValue = (value) => value == null ? '' : String(value);
const recordArray = (value) => Array.isArray(value) ? value.filter(isRecord) : [];
const errorFromUnknown = (error) => error instanceof Error ? error : new Error(String(error));

export function parseProminHouse(value) {
    if (!isRecord(value)) return null;
    const globalId = stringValue(value.GlobalID);
    if (!globalId) return null;
    return {
        globalId,
        caption: stringValue(value.Caption),
        alarmed: stringValue(value.Alarmed) === '-1',
        disconnected: stringValue(value.Color) === '12615935'
    };
}

export function parsePultState(value) {
    const payload = isRecord(value) ? value : {};
    return {
        pults: Array.isArray(payload.pults) ? payload.pults : [],
        houses: (Array.isArray(payload.streetAndHouses) ? payload.streetAndHouses : [])
            .map(parseProminHouse)
            .filter((house) => house !== null)
    };
}

export function parseEquipmentState(value) {
    const payload = isRecord(value) ? value : {};
    return {
        avariasAsHtml: stringValue(payload.AvariasAsHtml),
        temperatureAsHtml: stringValue(payload.TemperatureAsHtml),
        calls: recordArray(payload.Calls),
        updated: stringValue(payload.Updated),
        currentWindow: stringValue(payload.CurrentWindow)
    };
}

export function createProminClient(options = {}) {
    const baseUrl = (options.baseUrl ?? PROMIN_BASE_URL).replace(/\/$/, '');
    const fetcher = options.fetcher ?? fetch;
    const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

    async function getJson(path, params) {
        const url = new URL(path, `${baseUrl}/`);
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
        const response = await fetcher(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Промінь-3: HTTP ${response.status} ${response.statusText}`.trim());
        try {
            return await response.json();
        } catch (error) {
            throw new Error('Промінь-3 повернув некоректний JSON', { cause: error });
        }
    }

    async function getPultState(tabIndex = 0) {
        if (!Number.isInteger(tabIndex) || tabIndex < 0) throw new RangeError('tabIndex має бути невід’ємним цілим числом');
        return parsePultState(await getJson('/pultState', { tab: tabIndex }));
    }

    async function getEquipmentState(equipmentId) {
        const normalizedId = String(equipmentId || '').trim();
        if (!normalizedId) throw new TypeError('Потрібно вказати ID обладнання');
        return parseEquipmentState(await getJson('/oborState', { obor: normalizedId }));
    }

    async function executeDU(equipmentId, action) {
        const normalizedId = String(equipmentId || '').trim();
        if (!normalizedId) throw new TypeError('Потрібно вказати ID обладнання');
        if (action !== 'On' && action !== 'Off') throw new TypeError('action має бути On або Off');
        await getJson('/du', { action, state: 'Down', obor: normalizedId });
        await sleep(PROMIN_DU_PULSE_MS);
        await getJson('/du', { action, state: 'Up', obor: normalizedId });
    }

    return { getPultState, getEquipmentState, executeDU };
}

export function createProminPolling(client, handlers = {}) {
    let pultTimer = null;
    let equipmentTimer = null;
    let selectedEquipmentId = null;
    let pultRequestActive = false;
    let equipmentRequestActive = false;

    async function pollPults() {
        if (pultRequestActive) return;
        pultRequestActive = true;
        try { handlers.onPultState?.(await client.getPultState()); }
        catch (error) { handlers.onError?.(errorFromUnknown(error), 'pultState'); }
        finally { pultRequestActive = false; }
    }

    async function pollEquipment() {
        const equipmentId = selectedEquipmentId;
        if (!equipmentId || equipmentRequestActive) return;
        equipmentRequestActive = true;
        try {
            const state = await client.getEquipmentState(equipmentId);
            if (equipmentId === selectedEquipmentId) handlers.onEquipmentState?.(state, equipmentId);
        } catch (error) { handlers.onError?.(errorFromUnknown(error), 'oborState'); }
        finally { equipmentRequestActive = false; }
    }

    function start() {
        if (!pultTimer) {
            void pollPults();
            pultTimer = setInterval(() => void pollPults(), PROMIN_PULT_POLL_INTERVAL_MS);
        }
    }

    function selectEquipment(equipmentId) {
        selectedEquipmentId = equipmentId ? String(equipmentId).trim() || null : null;
        if (equipmentTimer) clearInterval(equipmentTimer);
        equipmentTimer = null;
        if (selectedEquipmentId) {
            void pollEquipment();
            equipmentTimer = setInterval(() => void pollEquipment(), PROMIN_OBOR_POLL_INTERVAL_MS);
        }
    }

    function stop() {
        if (pultTimer) clearInterval(pultTimer);
        if (equipmentTimer) clearInterval(equipmentTimer);
        pultTimer = null;
        equipmentTimer = null;
        selectedEquipmentId = null;
    }

    return { start, stop, selectEquipment, pollPults, pollEquipment };
}

export const prominClient = createProminClient();
