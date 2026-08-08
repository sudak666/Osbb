import { loadStoredSupplierTags, saveStoredSupplierTags } from './sklad-client-state.js';
import { hasSupplierTag, MAX_SUPPLIER_TAGS, mergeSupplierTags, normalizeSupplierTag, supplierTagKey, supplierTagsFromResponse } from './sklad-suppliers.js';
void loadStoredSupplierTags; void saveStoredSupplierTags; void hasSupplierTag; void MAX_SUPPLIER_TAGS; void mergeSupplierTags; void normalizeSupplierTag; void supplierTagKey; void supplierTagsFromResponse;
export declare function createSkladSupplierController(options: Record<string, unknown>): {
  add(): Promise<void>; confirmRemove(): Promise<void>; loadCloud(): Promise<void>; render(): void;
  requestRemove(tag: string): void; select(button: HTMLElement): void; sync(targetId: string, value: string): void;
};
