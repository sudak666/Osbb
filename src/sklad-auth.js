// Згенеровано з src/sklad-auth.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
import { createSkladAuthController } from "./sklad-auth-controller.js";
import { createSupabaseRestClient } from "./supabase-api.js";
function startSkladAuth() {
  const db = createSupabaseRestClient();
  createSkladAuthController({
    document,
    storage: sessionStorage,
    rpc: async (attempt) => Boolean(await db.rpc("verify_pin", { attempt }))
  }).bind();
}
startSkladAuth();
export {
  startSkladAuth
};
