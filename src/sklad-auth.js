import { createSkladAuthController } from './sklad-auth-controller.js';
import { createSupabaseRestClient } from './supabase-api.js';

export function startSkladAuth() {
    const db = createSupabaseRestClient();
    createSkladAuthController({
        document,
        storage: sessionStorage,
        rpc: async (attempt) => Boolean(await db.rpc('verify_pin', { attempt })),
    }).bind();
}

startSkladAuth();
