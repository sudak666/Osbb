import { createSkladAuthController } from './sklad-auth-controller.ts';
import { createSupabaseRestClient } from './supabase-api.ts';

export function startSkladAuth(): void {
    const db = createSupabaseRestClient();
    createSkladAuthController({
        document,
        storage: sessionStorage,
        rpc: async (attempt) => Boolean(await db.rpc('verify_pin', { attempt })),
    }).bind();
}

startSkladAuth();
