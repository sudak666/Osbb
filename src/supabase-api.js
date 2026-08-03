export const SUPABASE_URL = 'https://vkwkyhjjjmcpmiakxohw.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_KV2ZYS0ELpHPO9cX10Z9Tw_veUObkM9';

export function buildRpcUrl(fn, supabaseUrl = SUPABASE_URL) {
    return `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${encodeURIComponent(fn)}`;
}

export function parseRpcResponseText(text) {
    return text ? JSON.parse(text) : null;
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
        if (!r.ok) throw new Error(txt || r.statusText);
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
            throw new Error(`${response.status}: ${text || response.statusText}`);
        }
        return parseRpcResponseText(await response.text());
    }
    function from(table) {
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
                    resolve({ data: null, error: { code: 'FETCH_ERROR', message: error instanceof Error ? error.message : String(error) } });
                }
            },
        };
        return query;
    }
    return {
        rpc: (fn, params = {}) => request('POST', `${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fn)}`, { 'Content-Type': 'application/json' }, JSON.stringify(params)),
        from,
        storage: { from(bucket) {
            const base = `${supabaseUrl}/storage/v1/object`;
            return {
                async upload(path, blob, settings = {}) { await request('POST', `${base}/${bucket}/${path}`, { 'Content-Type': settings.contentType || 'image/jpeg', 'x-upsert': 'true' }, blob); return {}; },
                getPublicUrl(path) { return { data: { publicUrl: `${base}/public/${bucket}/${path}` } }; },
                async remove(paths) { try { await request('DELETE', `${base}/${bucket}`, { 'Content-Type': 'application/json' }, JSON.stringify({ prefixes: paths })); } catch {} return {}; },
            };
        } },
    };
}
