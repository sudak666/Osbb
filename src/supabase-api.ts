import type { PublicFunctionArgs, PublicFunctionName, PublicFunctionReturns } from './database.types.ts';

export type RpcParams = Record<string, unknown>;

export const SUPABASE_URL = 'https://vkwkyhjjjmcpmiakxohw.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_KV2ZYS0ELpHPO9cX10Z9Tw_veUObkM9';

export async function rpc<Fn extends PublicFunctionName>(
    fn: Fn,
    params: PublicFunctionArgs<Fn>
): Promise<PublicFunctionReturns<Fn> | null>;
export async function rpc<T = unknown>(fn: string, params?: RpcParams): Promise<T | null>;
export async function rpc<T = unknown>(fn: string, params: RpcParams = {}): Promise<T | null> {
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
    return txt ? JSON.parse(txt) as T : null;
}
