import { deleteInventoryResultFromRpcResponse } from './sklad-state.js';
void deleteInventoryResultFromRpcResponse;
export type MovementPendingKey = 'deletingLogId' | 'editingLogId' | 'deletingReceiptId' | 'editingReceiptId';
export declare function createSkladMovementsController(options: Record<string, unknown>): {
  pending(kind: MovementPendingKey): number | null;
  runDelete(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; reason?: string }>;
  setPending(kind: MovementPendingKey, id: unknown): boolean;
};
