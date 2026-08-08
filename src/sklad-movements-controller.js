import { deleteInventoryResultFromRpcResponse } from './sklad-state.js';

export function createSkladMovementsController({ db, warn = console.warn }) {
  const state = {
    deletingLogId: null,
    editingLogId: null,
    deletingReceiptId: null,
    editingReceiptId: null,
  };

  async function runDelete(name, args) {
    try {
      const { data, error } = await db.rpc(name, args);
      if (error) {
        warn(name + ' failed', error);
        return { ok: false, reason: 'network' };
      }
      return deleteInventoryResultFromRpcResponse(data);
    } catch (error) {
      warn(name + ' failed', error);
      return { ok: false, reason: 'network' };
    }
  }

  function setPending(kind, id) {
    if (!Object.hasOwn(state, kind)) return false;
    state[kind] = Number.isFinite(Number(id)) && Number(id) > 0 ? Number(id) : null;
    return true;
  }

  function pending(kind) {
    return Object.hasOwn(state, kind) ? state[kind] : null;
  }

  return { pending, runDelete, setPending };
}
