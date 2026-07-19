import type { PublicFunctionArgs, PublicFunctionName, PublicFunctionReturns } from './database.types.ts';

export type RpcParams = Record<string, unknown>;
export type RpcFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface RpcClientOptions {
    fetcher?: RpcFetch;
    supabaseUrl?: string;
    supabaseKey?: string;
}

export const SUPABASE_URL = 'https://vkwkyhjjjmcpmiakxohw.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_KV2ZYS0ELpHPO9cX10Z9Tw_veUObkM9';

export function buildRpcUrl(fn: string, supabaseUrl = SUPABASE_URL): string {
    return `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${encodeURIComponent(fn)}`;
}

export function parseRpcResponseText<T = unknown>(text: string): T | null {
    return text ? JSON.parse(text) as T : null;
}

export function createRpcClient(options: RpcClientOptions = {}) {
    const fetcher = options.fetcher ?? fetch;
    const supabaseUrl = options.supabaseUrl ?? SUPABASE_URL;
    const supabaseKey = options.supabaseKey ?? SUPABASE_KEY;

    async function typedRpc<Fn extends PublicFunctionName>(
        fn: Fn,
        params: PublicFunctionArgs<Fn>
    ): Promise<PublicFunctionReturns<Fn> | null>;
    async function typedRpc<T = unknown>(fn: string, params?: RpcParams): Promise<T | null>;
    async function typedRpc<T = unknown>(fn: string, params: RpcParams = {}): Promise<T | null> {
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
        return parseRpcResponseText<T>(txt);
    }

    return typedRpc;
}

export const rpc = createRpcClient();
