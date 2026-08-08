export const PROMIN_BASE_URL = 'http://192.168.0.11';
export const PROMIN_PULT_POLL_INTERVAL_MS = 5_000;
export const PROMIN_OBOR_POLL_INTERVAL_MS = 2_000;
export const PROMIN_DU_PULSE_MS = 5_000;

export type ProminDuAction = 'On' | 'Off';
export type ProminCall = Record<string, string>;
export type ProminFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProminHouse {
    globalId: string;
    caption: string;
    alarmed: boolean;
    disconnected: boolean;
}

export interface ProminPultState {
    pults: unknown[];
    houses: ProminHouse[];
}

export interface ProminEquipmentState {
    avariasAsHtml: string;
    temperatureAsHtml: string;
    calls: ProminCall[];
    updated: string;
    currentWindow: string;
}

export interface ProminClientOptions {
    baseUrl?: string;
    fetcher?: ProminFetch;
    sleep?: (milliseconds: number) => Promise<void>;
}

export interface ProminPollingHandlers {
    onPultState?: (state: ProminPultState) => void;
    onEquipmentState?: (state: ProminEquipmentState, equipmentId: string) => void;
    onError?: (error: Error, source: 'pultState' | 'oborState') => void;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
    const text = String(value).trim();
    return text.length <= maxLength ? text : '';
}

function recordArray(value: unknown): UnknownRecord[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}

function errorFromUnknown(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

function parseProminRecord(value: unknown): Record<string, string> | null {
    if (!isRecord(value)) return null;
    return Object.fromEntries(Object.entries(value).slice(0, 20).flatMap(([key, field]) => {
        const safeKey = boundedString(key, 100);
        const safeValue = boundedString(field, 500);
        return safeKey && safeValue ? [[safeKey, safeValue]] : [];
    }));
}

export function parseProminHouse(value: unknown): ProminHouse | null {
    if (!isRecord(value)) return null;
    const globalId = boundedString(value.GlobalID, 100);
    if (!globalId) return null;
    return {
        globalId,
        caption: boundedString(value.Caption, 300),
        alarmed: boundedString(value.Alarmed, 20) === '-1',
        disconnected: boundedString(value.Color, 20) === '12615935'
    };
}

export function parsePultState(value: unknown): ProminPultState {
    const payload = isRecord(value) ? value : {};
    return {
        pults: recordArray(payload.pults).slice(0, 100).map(parseProminRecord).filter((entry): entry is Record<string, string> => entry !== null),
        houses: (Array.isArray(payload.streetAndHouses) ? payload.streetAndHouses : [])
            .map(parseProminHouse)
            .filter((house): house is ProminHouse => house !== null)
            .slice(0, 500)
    };
}

export function parseEquipmentState(value: unknown): ProminEquipmentState {
    const payload = isRecord(value) ? value : {};
    return {
        avariasAsHtml: boundedString(payload.AvariasAsHtml, 20_000),
        temperatureAsHtml: boundedString(payload.TemperatureAsHtml, 20_000),
        calls: recordArray(payload.Calls).slice(0, 200).map(parseProminRecord).filter((entry): entry is ProminCall => entry !== null),
        updated: boundedString(payload.Updated, 200),
        currentWindow: boundedString(payload.CurrentWindow, 200)
    };
}

export function createProminClient(options: ProminClientOptions = {}) {
    const baseUrl = (options.baseUrl ?? PROMIN_BASE_URL).replace(/\/$/, '');
    const fetcher = options.fetcher ?? fetch;
    const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

    async function getJson(path: string, params: Record<string, string | number>): Promise<unknown> {
        const url = new URL(path, `${baseUrl}/`);
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
        const response = await fetcher(url.toString(), {
            method: 'GET',
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error(`Промінь-3: HTTP ${response.status} ${response.statusText}`.trim());
        try {
            return await response.json() as unknown;
        } catch (error) {
            throw new Error('Промінь-3 повернув некоректний JSON', { cause: error });
        }
    }

    async function getPultState(tabIndex = 0): Promise<ProminPultState> {
        if (!Number.isInteger(tabIndex) || tabIndex < 0) throw new RangeError('tabIndex має бути невід’ємним цілим числом');
        return parsePultState(await getJson('/pultState', { tab: tabIndex }));
    }

    async function getEquipmentState(equipmentId: string): Promise<ProminEquipmentState> {
        const normalizedId = String(equipmentId || '').trim();
        if (!normalizedId || normalizedId.length > 100) throw new TypeError('Потрібно вказати валідний ID обладнання');
        return parseEquipmentState(await getJson('/oborState', { obor: normalizedId }));
    }

    async function executeDU(equipmentId: string, action: ProminDuAction): Promise<void> {
        const normalizedId = String(equipmentId || '').trim();
        if (!normalizedId || normalizedId.length > 100) throw new TypeError('Потрібно вказати валідний ID обладнання');
        if (action !== 'On' && action !== 'Off') throw new TypeError('action має бути On або Off');
        await getJson('/du', { action, state: 'Down', obor: normalizedId });
        await sleep(PROMIN_DU_PULSE_MS);
        await getJson('/du', { action, state: 'Up', obor: normalizedId });
    }

    return { getPultState, getEquipmentState, executeDU };
}

export type ProminClient = ReturnType<typeof createProminClient>;

export function createProminPolling(client: ProminClient, handlers: ProminPollingHandlers = {}) {
    let pultTimer: ReturnType<typeof setInterval> | null = null;
    let equipmentTimer: ReturnType<typeof setInterval> | null = null;
    let selectedEquipmentId: string | null = null;
    let pultRequestActive = false;
    let equipmentRequestActive = false;

    async function pollPults(): Promise<void> {
        if (pultRequestActive) return;
        pultRequestActive = true;
        try {
            handlers.onPultState?.(await client.getPultState());
        } catch (error) {
            handlers.onError?.(errorFromUnknown(error), 'pultState');
        } finally {
            pultRequestActive = false;
        }
    }

    async function pollEquipment(): Promise<void> {
        const equipmentId = selectedEquipmentId;
        if (!equipmentId || equipmentRequestActive) return;
        equipmentRequestActive = true;
        try {
            const state = await client.getEquipmentState(equipmentId);
            if (equipmentId === selectedEquipmentId) handlers.onEquipmentState?.(state, equipmentId);
        } catch (error) {
            handlers.onError?.(errorFromUnknown(error), 'oborState');
        } finally {
            equipmentRequestActive = false;
        }
    }

    function start(): void {
        if (!pultTimer) {
            void pollPults();
            pultTimer = setInterval(() => void pollPults(), PROMIN_PULT_POLL_INTERVAL_MS);
        }
    }

    function selectEquipment(equipmentId: string | null): void {
        const normalizedId = equipmentId ? String(equipmentId).trim() : '';
        selectedEquipmentId = normalizedId && normalizedId.length <= 100 ? normalizedId : null;
        if (equipmentTimer) clearInterval(equipmentTimer);
        equipmentTimer = null;
        if (selectedEquipmentId) {
            void pollEquipment();
            equipmentTimer = setInterval(() => void pollEquipment(), PROMIN_OBOR_POLL_INTERVAL_MS);
        }
    }

    function stop(): void {
        if (pultTimer) clearInterval(pultTimer);
        if (equipmentTimer) clearInterval(equipmentTimer);
        pultTimer = null;
        equipmentTimer = null;
        selectedEquipmentId = null;
    }

    return { start, stop, selectEquipment, pollPults, pollEquipment };
}

export const prominClient = createProminClient();
