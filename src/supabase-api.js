export const SUPABASE_URL = 'https://vkwkyhjjjmcpmiakxohw.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_KV2ZYS0ELpHPO9cX10Z9Tw_veUObkM9';
const MAX_RESPONSE_TEXT_LENGTH = 1_000_000;
const MAX_ERROR_TEXT_LENGTH = 4_000;

function boundedErrorMessage(error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, MAX_ERROR_TEXT_LENGTH);
}

function assertIdentifier(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new TypeError(`Invalid ${label}`);
    return value;
}

function storagePath(value) {
    if (typeof value !== 'string' || !value || value.length > 1024) throw new TypeError('Invalid storage path');
    const segments = value.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new TypeError('Invalid storage path');
    return segments.map(encodeURIComponent).join('/');
}

export function buildRpcUrl(fn, supabaseUrl = SUPABASE_URL) {
    return `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${encodeURIComponent(fn)}`;
}

export function parseRpcResponseText(text) {
    if (typeof text !== 'string' || text.length > MAX_RESPONSE_TEXT_LENGTH) throw new RangeError('Supabase response is too large');
    return text ? JSON.parse(text) : null;
}

export function numericIdFromInsertResponse(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const id = value.id;
    return typeof id === 'number' && Number.isFinite(id) ? id : null;
}

export function createRpcClient(options = {}) {
    const fetcher = options.fetcher ?? fetch;
    const supabaseUrl = options.supabaseUrl ?? SUPABASE_URL;
    const supabaseKey = options.supabaseKey ?? SUPABASE_KEY;

    return async function rpc(fn, params = {}) {
        const r = await fetcher(buildRpcUrl(fn, supabaseUrl), {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        const txt = await r.text();
        if (txt.length > MAX_RESPONSE_TEXT_LENGTH) throw new RangeError('Supabase response is too large');
        if (!r.ok) throw new Error((txt || r.statusText).slice(0, MAX_ERROR_TEXT_LENGTH));
        return parseRpcResponseText(txt);
    };
}

export const rpc = createRpcClient();

export function createSupabaseRestClient(options = {}) {
    const fetcher = options.fetcher ?? fetch;
    const supabaseUrl = (options.supabaseUrl ?? SUPABASE_URL).replace(/\/$/, '');
    const supabaseKey = options.supabaseKey ?? SUPABASE_KEY;
    const auth = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };
    async function request(method, url, headers = {}, body) {
        const response = await fetcher(url, { method, headers: { ...auth, ...headers }, body });
        if (!response.ok) {
            const text = await response.text();
            if (text.length > MAX_RESPONSE_TEXT_LENGTH) throw new RangeError('Supabase response is too large');
            throw new Error(`${response.status}: ${(text || response.statusText).slice(0, MAX_ERROR_TEXT_LENGTH)}`);
        }
        const text = await response.text();
        return parseRpcResponseText(text);
    }
    function from(table) {
        assertIdentifier(table, 'table name');
        const state = { filters: [], method: 'GET', body: null, isSingle: false, isMaybeSingle: false, columns: '*', isUpsert: false };
        const query = {
            select(columns = '*') { state.columns = columns; return query; },
            eq(column, value) { state.filters.push(`${column}=eq.${encodeURIComponent(String(value))}`); return query; },
            order(column, settings) { state.filters.push(`order=${column}.${settings?.ascending === false ? 'desc' : 'asc'}`); return query; },
            limit(value) { state.filters.push(`limit=${value}`); return query; },
            single() { state.isSingle = true; return query; },
            maybeSingle() { state.isSingle = true; state.isMaybeSingle = true; return query; },
            insert(data) { state.method = 'POST'; state.body = data; return query; },
            update(data) { state.method = 'PATCH'; state.body = data; return query; },
            upsert(data) { state.method = 'POST'; state.body = data; state.isUpsert = true; return query; },
            delete() { state.method = 'DELETE'; return query; },
            async then(resolve) {
                try {
                    const params = [...state.filters];
                    if (state.method === 'GET') params.push(`select=${state.columns}`);
                    const url = `${supabaseUrl}/rest/v1/${table}${params.length ? `?${params.join('&')}` : ''}`;
                    const headers = { 'Content-Type': 'application/json' };
                    if (state.isUpsert) headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
                    else if (state.method === 'POST' || state.method === 'PATCH') headers['Prefer'] = 'return=representation';
                    const data = await request(state.method, url, headers, state.body ? JSON.stringify(state.body) : undefined);
                    if (state.isSingle) {
                        const row = Array.isArray(data) ? (data[0] ?? null) : null;
                        resolve({ data: row, error: row || state.isMaybeSingle ? null : { code: 'PGRST116' } });
                    } else resolve({ data: data || [], error: null });
                } catch (error) {
                    resolve({ data: null, error: { code: 'FETCH_ERROR', message: boundedErrorMessage(error) } });
                }
            },
        };
        return query;
    }
    async function rpcResult(fn, params = {}) {
        try {
            const data = await request('POST', `${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fn)}`, { 'Content-Type': 'application/json' }, JSON.stringify(params));
            return { data, error: null };
        } catch (error) {
            return { data: null, error: { code: 'FETCH_ERROR', message: boundedErrorMessage(error) } };
        }
    }
    return {
        rpc: (fn, params = {}) => request('POST', `${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fn)}`, { 'Content-Type': 'application/json' }, JSON.stringify(params)),
        rpcResult,
        from,
        storage: { from(bucket) {
            assertIdentifier(bucket, 'storage bucket');
            const base = `${supabaseUrl}/storage/v1/object`;
            return {
                async upload(path, blob, settings = {}) {
                    try {
                        const encodedPath = storagePath(path);
                        await request('POST', `${base}/${bucket}/${encodedPath}`, {
                            'Content-Type': settings.contentType || 'image/jpeg',
                            'x-upsert': String(settings.upsert !== false),
                        }, blob);
                        return { data: { path }, error: null };
                    } catch (error) {
                        return { data: null, error: { code: 'STORAGE_ERROR', message: boundedErrorMessage(error) } };
                    }
                },
                getPublicUrl(path) { return { data: { publicUrl: `${base}/public/${bucket}/${storagePath(path)}` } }; },
                async remove(paths) {
                    try {
                        if (!Array.isArray(paths) || paths.length > 100) throw new TypeError('Invalid storage paths');
                        paths.forEach(storagePath);
                        await request('DELETE', `${base}/${bucket}`, { 'Content-Type': 'application/json' }, JSON.stringify({ prefixes: paths }));
                    } catch {}
                    return {};
                },
            };
        } },
    };
}
