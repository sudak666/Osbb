export const SUPABASE_URL = 'https://vkwkyhjjjmcpmiakxohw.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_KV2ZYS0ELpHPO9cX10Z9Tw_veUObkM9';

export async function rpc(fn, params = {}) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || r.statusText);
    return txt ? JSON.parse(txt) : null;
}
