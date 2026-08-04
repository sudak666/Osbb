import type {
    PublicFunctionArgs,
    PublicFunctionName,
    PublicFunctionReturns,
    PublicTableInsert,
    PublicTableName,
    PublicTableRow,
    PublicTableUpdate,
} from './database.types.ts';

export type RpcParams = Record<string, unknown>;
export type RpcFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface RpcClientOptions {
    fetcher?: RpcFetch;
    supabaseUrl?: string;
    supabaseKey?: string;
}

export interface SupabaseRestClientOptions extends RpcClientOptions {}

export interface RestError {
    code: string;
    message?: string;
}

export interface RestResult<T> {
    data: T | null;
    error: RestError | null;
}

export interface RestQuery<Row, Insert, Update, Result = Row[]> extends PromiseLike<RestResult<Result>> {
    select(columns?: string): RestQuery<Row, Insert, Update, Result>;
    eq(column: keyof Row & string, value: unknown): RestQuery<Row, Insert, Update, Result>;
    order(column: keyof Row & string, settings?: { ascending?: boolean }): RestQuery<Row, Insert, Update, Result>;
    limit(value: number): RestQuery<Row, Insert, Update, Result>;
    single(): RestQuery<Row, Insert, Update, Row | null>;
    maybeSingle(): RestQuery<Row, Insert, Update, Row | null>;
    insert(data: Insert | readonly Insert[]): RestQuery<Row, Insert, Update, Row[]>;
    update(data: Update): RestQuery<Row, Insert, Update, Row[]>;
    upsert(data: Insert | Update | readonly (Insert | Update)[]): RestQuery<Row, Insert, Update, Row[]>;
    delete(): RestQuery<Row, Insert, Update, Row[]>;
}

export interface SupabaseRestClient {
    rpc<Fn extends PublicFunctionName>(fn: Fn, params: PublicFunctionArgs<Fn>): Promise<PublicFunctionReturns<Fn> | null>;
    rpc<T = unknown>(fn: string, params?: RpcParams): Promise<T | null>;
    rpcResult<Fn extends PublicFunctionName>(fn: Fn, params: PublicFunctionArgs<Fn>): Promise<RestResult<PublicFunctionReturns<Fn>>>;
    rpcResult<T = unknown>(fn: string, params?: RpcParams): Promise<RestResult<T>>;
    from<Table extends PublicTableName>(table: Table): RestQuery<
        PublicTableRow<Table>,
        PublicTableInsert<Table>,
        PublicTableUpdate<Table>
    >;
    storage: {
        from(bucket: string): {
            upload(path: string, blob: BodyInit, settings?: { contentType?: string; upsert?: boolean }): Promise<RestResult<{ path: string }>>;
            getPublicUrl(path: string): { data: { publicUrl: string } };
            remove(paths: string[]): Promise<Record<string, never>>;
        };
    };
}

interface RestQueryState {
    filters: string[];
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body: unknown;
    isSingle: boolean;
    isMaybeSingle: boolean;
    columns: string;
    isUpsert: boolean;
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

export function createSupabaseRestClient(options: SupabaseRestClientOptions = {}): SupabaseRestClient {
    const fetcher = options.fetcher ?? fetch;
    const supabaseUrl = (options.supabaseUrl ?? SUPABASE_URL).replace(/\/$/, '');
    const supabaseKey = options.supabaseKey ?? SUPABASE_KEY;
    const auth = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    async function request(method: string, url: string, headers: Record<string, string> = {}, body?: BodyInit) {
        const response = await fetcher(url, { method, headers: { ...auth, ...headers }, body });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`${response.status}: ${text || response.statusText}`);
        }
        return parseRpcResponseText(await response.text());
    }

    function from<Table extends PublicTableName>(table: Table) {
        const state: RestQueryState = { filters: [], method: 'GET', body: null, isSingle: false, isMaybeSingle: false, columns: '*', isUpsert: false };
        const query = {
            select(columns = '*') { state.columns = columns; return query; },
            eq(column: string, value: unknown) { state.filters.push(`${column}=eq.${encodeURIComponent(String(value))}`); return query; },
            order(column: string, settings?: { ascending?: boolean }) { state.filters.push(`order=${column}.${settings?.ascending === false ? 'desc' : 'asc'}`); return query; },
            limit(value: number) { state.filters.push(`limit=${value}`); return query; },
            single() { state.isSingle = true; return query; },
            maybeSingle() { state.isSingle = true; state.isMaybeSingle = true; return query; },
            insert(data: unknown) { state.method = 'POST'; state.body = data; return query; },
            update(data: unknown) { state.method = 'PATCH'; state.body = data; return query; },
            upsert(data: unknown) { state.method = 'POST'; state.body = data; state.isUpsert = true; return query; },
            delete() { state.method = 'DELETE'; return query; },
            async then(resolve: (result: { data: unknown; error: unknown }) => void) {
                try {
                    const params = [...state.filters];
                    if (state.method === 'GET') params.push(`select=${state.columns}`);
                    const url = `${supabaseUrl}/rest/v1/${table}${params.length ? `?${params.join('&')}` : ''}`;
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
        return query as unknown as RestQuery<PublicTableRow<Table>, PublicTableInsert<Table>, PublicTableUpdate<Table>>;
    }

    async function restRpc<Fn extends PublicFunctionName>(
        fn: Fn,
        params: PublicFunctionArgs<Fn>,
    ): Promise<PublicFunctionReturns<Fn> | null>;
    async function restRpc<T = unknown>(fn: string, params?: RpcParams): Promise<T | null>;
    async function restRpc<T = unknown>(fn: string, params: RpcParams = {}): Promise<T | null> {
        return request('POST', `${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fn)}`, { 'Content-Type': 'application/json' }, JSON.stringify(params)) as Promise<T | null>;
    }

    async function rpcResult<Fn extends PublicFunctionName>(
        fn: Fn,
        params: PublicFunctionArgs<Fn>,
    ): Promise<RestResult<PublicFunctionReturns<Fn>>>;
    async function rpcResult<T = unknown>(fn: string, params?: RpcParams): Promise<RestResult<T>>;
    async function rpcResult<T = unknown>(fn: string, params: RpcParams = {}): Promise<RestResult<T>> {
        try {
            const data = await restRpc<T>(fn, params);
            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: { code: 'FETCH_ERROR', message: error instanceof Error ? error.message : String(error) },
            };
        }
    }

    return {
        rpc: restRpc,
        rpcResult,
        from,
        storage: {
            from(bucket: string) {
                const base = `${supabaseUrl}/storage/v1/object`;
                return {
                    async upload(path: string, blob: BodyInit, settings: { contentType?: string; upsert?: boolean } = {}) {
                        try {
                            await request('POST', `${base}/${bucket}/${path}`, {
                                'Content-Type': settings.contentType || 'image/jpeg',
                                'x-upsert': String(settings.upsert !== false),
                            }, blob);
                            return { data: { path }, error: null };
                        } catch (error) {
                            return {
                                data: null,
                                error: { code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) },
                            };
                        }
                    },
                    getPublicUrl(path: string) { return { data: { publicUrl: `${base}/public/${bucket}/${path}` } }; },
                    async remove(paths: string[]) {
                        try { await request('DELETE', `${base}/${bucket}`, { 'Content-Type': 'application/json' }, JSON.stringify({ prefixes: paths })); } catch { /* сумісність із попереднім клієнтом */ }
                        return {};
                    },
                };
            },
        },
    };
}
