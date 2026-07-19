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
